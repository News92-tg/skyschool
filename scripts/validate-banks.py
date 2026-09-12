#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Валидатор банков заданий SkyySchool.

Читает все data/bank-*.js и проверяет их на структурные и текстовые
ошибки — не на фактическую точность (даты, формулы: это может
проверить только человек или предметный эксперт, см. README ниже).

Как разбираются файлы
----------------------
Никакого JS-движка тут нет и не нужно: файлы устроены дисциплинированно
(объекты заданий без вложенных функций, без шаблонных строк), поэтому
banks парсятся собственным маленьким разборщиком на чистом Python (без
внешних зависимостей — это единственный скрипт в проекте на Python
и внешний рантайм ему не нужен, как и bundle.py).

Разборщик — не наивное регулярное выражение по всему файлу (оно бы
путалось на вложенных фигурных скобках вида text:{ru:'...',en:'...'}
внутри задания), а поиск строк с учётом кавычек и экранирования
('...', "...", с \\' и \\" внутри) плюс подсчёт глубины скобок. Это
даёт корректные границы каждого объекта задания, а извлечение
отдельных полей (id, answer, text.ru, ...) уже делается регулярками
внутри этих границ, как и просили.

Проверки
--------
* id уникальны внутри банка и между банками;
* answer — целое число, 0 <= answer < len(options);
* нет дубликатов среди options[].ru (иначе задание нельзя решить
  однозначно — так и должно быть у нормального теста);
* есть непустые text.ru и solution.ru у каждого задания;
* нет двойных пробелов и пустых строк в text.ru / solution.ru.

Использование
-------------
    python3 scripts/validate-banks.py            # только отчёт
    python3 scripts/validate-banks.py --fix       # + механическое
                                                   #   исправление (пока
                                                   #   только двойные
                                                   #   пробелы и пробелы
                                                   #   по краям строки)
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, 'data')


# ---------------------------------------------------------------- разбор

def _skip_string(s, i):
    """s[i] — открывающая кавычка (' или "). Возвращает индекс СРАЗУ
    ПОСЛЕ закрывающей кавычки, корректно пропуская \\' \\" \\\\ и т.д."""
    quote = s[i]
    i += 1
    n = len(s)
    while i < n:
        c = s[i]
        if c == '\\':
            i += 2
            continue
        if c == quote:
            return i + 1
        i += 1
    return n  # незакрытая строка — файл битый, но не зацикливаемся


def _find_matching_brace(s, open_idx, open_ch, close_ch):
    """s[open_idx] — открывающая скобка. Возвращает индекс СРАЗУ ПОСЛЕ
    парной закрывающей, пропуская содержимое строк (кавычки), чтобы
    скобки/кавычки внутри текста заданий не путали подсчёт глубины."""
    depth = 0
    i = open_idx
    n = len(s)
    while i < n:
        c = s[i]
        if c in ("'", '"'):
            i = _skip_string(s, i)
            continue
        if c == open_ch:
            depth += 1
        elif c == close_ch:
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return n


def _extract_top_level_objects(s):
    """Возвращает список «сырых» текстов {...}-объектов верхнего уровня
    внутри s (используется для массива tasks и для массива options)."""
    objs = []
    i, n = 0, len(s)
    while i < n:
        c = s[i]
        if c in ("'", '"'):
            i = _skip_string(s, i)
            continue
        if c == '{':
            end = _find_matching_brace(s, i, '{', '}')
            objs.append(s[i:end])
            i = end
            continue
        i += 1
    return objs


def _find_bracketed(s, key, open_ch, close_ch):
    """Ищет `key : <open_ch> ... <close_ch>` и возвращает содержимое
    между скобками (без самих скобок), либо None."""
    m = re.search(re.escape(key) + r'\s*:\s*' + re.escape(open_ch), s)
    if not m:
        return None
    open_idx = m.end() - 1
    end = _find_matching_brace(s, open_idx, open_ch, close_ch)
    return s[open_idx + 1:end - 1]


def _find_string_field(s, key):
    """Ищет `key : 'значение'` или `key : "значение"` НА ВЕРХНЕМ УРОВНЕ
    переданного фрагмента и возвращает декодированное значение,
    либо None, если поля нет."""
    m = re.search(re.escape(key) + r'\s*:\s*', s)
    if not m:
        return None
    i = m.end()
    if i >= len(s) or s[i] not in ("'", '"'):
        return None
    quote = s[i]
    end = _skip_string(s, i)
    raw = s[i + 1:end - 1]
    return (raw.replace('\\' + quote, quote)
               .replace('\\n', '\n')
               .replace('\\\\', '\\'))


def _find_int_field(s, key):
    m = re.search(re.escape(key) + r'\s*:\s*(-?\d+)', s)
    return int(m.group(1)) if m else None


def parse_bank_file(path):
    """Возвращает (bank_id, ruOnly, [task_dict, ...]) либо вызывает
    ValueError с понятным сообщением, если файл не похож на банк
    (например data/bank-kids.js — window.KIDS_TASKS, другая форма)."""
    text = open(path, encoding='utf-8').read()

    m = re.search(r'window\.BANKS\.(\w+)\s*=\s*\{', text)
    if not m:
        raise ValueError('не похоже на window.BANKS.<id> = {...} (пропускаю)')
    bank_id = m.group(1)
    body_start = m.end() - 1
    body_end = _find_matching_brace(text, body_start, '{', '}')
    body = text[body_start:body_end]

    ru_only = bool(re.search(r'ruOnly\s*:\s*true', body))

    tasks_blob = _find_bracketed(body, 'tasks', '[', ']')
    if tasks_blob is None:
        raise ValueError('не нашёл tasks: [...]')

    tasks = []
    for obj in _extract_top_level_objects(tasks_blob):
        task = {'_raw': obj}
        task['id'] = _find_string_field(obj, 'id')
        task['answer'] = _find_int_field(obj, 'answer')

        text_blob = _find_bracketed(obj, 'text', '{', '}')
        task['text_ru'] = _find_string_field(text_blob, 'ru') if text_blob is not None else None

        sol_blob = _find_bracketed(obj, 'solution', '{', '}')
        task['solution_ru'] = _find_string_field(sol_blob, 'ru') if sol_blob is not None else None

        opts_blob = _find_bracketed(obj, 'options', '[', ']')
        opts = []
        if opts_blob is not None:
            for o in _extract_top_level_objects(opts_blob):
                opts.append(_find_string_field(o, 'ru'))
        task['options_ru'] = opts

        tasks.append(task)

    return bank_id, ru_only, tasks


# ------------------------------------------------------------- проверки

DOUBLE_SPACE_RE = re.compile(r'  +')


def check_task(task, seen_ids_in_bank):
    """Возвращает список текстов ошибок (без префикса id) для одного
    задания. Пустой список — задание чистое."""
    errs = []
    tid = task['id'] or '???'

    if task['id'] in seen_ids_in_bank:
        errs.append('дубликат id внутри банка')
    seen_ids_in_bank.add(task['id'])

    opts = task['options_ru']
    if task['answer'] is None:
        errs.append('нет поля answer')
    elif not opts:
        errs.append('нет options')
    elif not (0 <= task['answer'] < len(opts)):
        errs.append(f"answer={task['answer']}, но options={len(opts)}")

    if opts:
        for i in range(len(opts)):
            for j in range(i + 1, len(opts)):
                if opts[i] is not None and opts[i] == opts[j]:
                    errs.append(f'дубликат options[{i}] и options[{j}]')

    if not task['text_ru']:
        errs.append('пустое text.ru')
    if not task['solution_ru']:
        errs.append('пустое solution.ru')

    for field_name, val in (('text.ru', task['text_ru']), ('solution.ru', task['solution_ru'])):
        if val and DOUBLE_SPACE_RE.search(val):
            errs.append(f'двойной пробел в {field_name}')
        if val and val != val.strip():
            errs.append(f'пробел по краю в {field_name}')

    return errs


def fix_double_spaces_in_file(path):
    """Механическое исправление: схлопывает двойные пробелы и обрезает
    пробелы по краям ВНУТРИ строковых значений text/solution полей —
    единственное, что можно чинить безопасно, не выдумывая содержание.
    Возвращает число исправленных мест."""
    text = open(path, encoding='utf-8').read()
    fixed = 0

    def repl(m):
        nonlocal fixed
        key, quote, body = m.group('key'), m.group('q'), m.group('body')
        new_body = re.sub(r'  +', ' ', body)
        # обрезаем пробелы по краям, только если они не часть \n-экранирования
        stripped = new_body.strip(' ')
        if stripped != new_body or new_body != body:
            fixed += 1
        return f'{key}:{quote}{stripped}{quote}'

    # ru:'...'/ru:"..." внутри text{...} и solution{...} — достаточно
    # ловить общий шаблон ru:'...' с учётом обеих кавычек и \' \" внутри
    pattern = re.compile(
        r'(?P<key>\bru)\s*:\s*(?P<q>[\'"])(?P<body>(?:\\.|(?!(?P=q)).)*)(?P=q)'
    )
    new_text = pattern.sub(repl, text)
    if fixed:
        open(path, 'w', encoding='utf-8').write(new_text)
    return fixed


# ------------------------------------------------------------------ run

def main():
    do_fix = '--fix' in sys.argv
    files = sorted(glob.glob(os.path.join(DATA_DIR, 'bank-*.js')))

    all_ids = {}  # id -> "bank-file.js" (для проверки дублей МЕЖДУ банками)
    total_tasks = 0
    total_errors = 0
    total_fixed = 0
    report_lines = []

    for path in files:
        fname = os.path.basename(path)

        try:
            bank_id, ru_only, tasks = parse_bank_file(path)
        except ValueError as e:
            report_lines.append(f'{fname}: пропущено ({e})')
            continue

        if do_fix:
            n = fix_double_spaces_in_file(path)
            if n:
                total_fixed += n
                # перечитываем после правки, чтобы отчёт был по факту
                bank_id, ru_only, tasks = parse_bank_file(path)

        seen_in_bank = set()
        file_errors = []
        for task in tasks:
            errs = check_task(task, seen_in_bank)
            tid = task['id'] or '???'
            if tid in all_ids:
                errs.append(f'дубликат id между банками (уже есть в {all_ids[tid]})')
            else:
                all_ids[tid] = fname
            for e in errs:
                file_errors.append((tid, e))

        total_tasks += len(tasks)
        total_errors += len(file_errors)

        if not file_errors:
            report_lines.append(f'{fname}: {len(tasks)} заданий, 0 ошибок')
        else:
            report_lines.append(f'{fname}: {len(tasks)} заданий, {len(file_errors)} ошибки:')
            for tid, e in file_errors:
                report_lines.append(f'  ⚠ {tid}: {e}')

    print('\n'.join(report_lines))
    print()
    print('=' * 60)
    print(f'Итого: {total_tasks} заданий во всех банках')
    print(f'Ошибок найдено: {total_errors}')
    if do_fix:
        print(f'Исправлено механически (пробелы): {total_fixed}')
    print('Фактическая точность (даты, формулы, орфография) этим скриптом')
    print('не проверяется — это находится за пределами того, что можно')
    print('проверить программно, и требует ручной/экспертной вычитки.')


if __name__ == '__main__':
    main()
