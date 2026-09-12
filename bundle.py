#!/usr/bin/env python3
"""
Сборка однофайловой версии SkyySchool.

Задача: восемь отдельных страниц превратить в один HTML, где разделы
переключаются без перезагрузки. Три вещи, которые при наивной склейке
ломаются, и что с ними делается здесь:

1. Одинаковые id и классы на разных страницах (.tabs есть сразу в трёх).
   Решение: каждая страница живёт в своей секции, а её скрипт ищет
   элементы ТОЛЬКО внутри этой секции.

2. Одинаковые ключи словаря с разным смыслом: h1 у тренажёра и у
   главной — разный текст. Решение: словарь каждой страницы применяется
   в момент её показа, а не все сразу.

3. Стили страниц конфликтуют между собой. Решение: селекторы из
   страничных <style> получают префикс своей секции.
"""
import re, os, sys, json

SRC = '/home/claude/build/skyschool'
OUT = os.path.join(SRC, 'single.html')

PAGES = [
    ('index',     'index.html',     'navHome'),
    ('trainer',   'trainer.html',   'navLearn'),
    ('kids',      'kids.html',      'navKids'),
    ('chess',     'chess.html',     'navChess'),
    ('teachers',  'teachers.html',  'navTeachers'),
    ('homework',  'homework.html',  'navHomework'),
    ('life',      'life.html',      'navLife'),
    ('plan',      'plan.html',      'navPlan'),
    ('tools',     'tools.html',     'navTools'),
    ('photo',     'photo.html',     'navPhoto'),
]

SHARED_JS = [
    'assets/config.js', 'assets/core.js', 'assets/db.js', 'assets/auth.js',
    'assets/chess-engine.js', 'assets/chess-ai.js', 'assets/chess-review.js',
    'assets/match3.js', 'assets/python-editor.js',
    'data/ai-teachers.js', 'assets/ai-teachers.js',
    'data/bank-math.js', 'data/bank-informatics.js', 'data/bank-russian.js',
    'data/bank-physics.js', 'data/bank-biology.js', 'data/bank-chemistry.js',
    'data/bank-geography.js', 'data/bank-social.js', 'data/bank-history.js',
    'data/bank-english.js', 'data/bank-polish.js', 'data/bank-spanish.js', 'data/bank-german.js',
    'data/bank-kids.js', 'data/chess-lessons.js', 'data/chess-puzzles.js',
]

read = lambda p: open(os.path.join(SRC, p), encoding='utf-8').read()


def scope_css(css, prefix):
    """Каждому селектору добавляем префикс секции.

    Правила внутри @keyframes трогать нельзя — там не селекторы, а
    ключевые кадры (from/to/50%). @media разбираем рекурсивно."""
    out, i = [], 0
    while i < len(css):
        at = css.find('@', i)
        brace = css.find('{', i)

        if at != -1 and (brace == -1 or at < brace):
            # блок @media / @keyframes / @supports
            head_end = css.find('{', at)
            head = css[at:head_end]
            depth, j = 1, head_end + 1
            while j < len(css) and depth:
                if css[j] == '{': depth += 1
                elif css[j] == '}': depth -= 1
                j += 1
            body = css[head_end + 1:j - 1]
            if head.lstrip('@').split()[0].lower().endswith('keyframes'):
                out.append(head + '{' + body + '}')          # как есть
            else:
                out.append(head + '{' + scope_css(body, prefix) + '}')
            i = j
            continue

        if brace == -1:
            out.append(css[i:])
            break

        sel = css[i:brace].strip()
        end = css.find('}', brace)
        body = css[brace + 1:end]
        if sel:
            parts = []
            for one in sel.split(','):
                one = one.strip()
                if not one:
                    continue
                parts.append(one if one.startswith(prefix) else f'{prefix} {one}')
            out.append(',\n'.join(parts) + '{' + body + '}')
        i = end + 1
    return '\n'.join(out)


def scope_js(js, page_id):
    """Скрипт страницы ищет элементы только внутри своей секции.

    document.addEventListener трогать нельзя: события языка и данных
    приходят на документ. А вот поиск элементов и обработчики
    перерисовки — переводим на секцию."""

    # перерисовка по смене языка -> собственное событие секции
    js = js.replace("document.addEventListener('langchange',", "ROOT.addEventListener('pagerefresh',")

    # поиск элементов: только внутри секции
    js = js.replace('document.querySelectorAll(', 'ROOT.querySelectorAll(')
    js = js.replace('document.querySelector(', 'ROOT.querySelector(')
    js = re.sub(r"document\.getElementById\((['\"])([^'\"]+)\1\)",
                r"ROOT.querySelector('#\2')", js)
    js = re.sub(r"document\.getElementById\(", "byId(", js)

    # словарь страницы вместо глобальной инициализации
    js = js.replace('Sky.init(', 'PAGE_DICT(', 1)
    return js


def build():
    # ---------- общий CSS ----------
    css = [read('assets/sky.css')]

    # ---------- секции страниц ----------
    sections, scripts = [], []
    for pid, fname, navkey in PAGES:
        html = read(fname)

        # стили страницы -> с префиксом секции
        for m in re.finditer(r'<style>(.*?)</style>', html, re.S):
            css.append(f'/* ---- {pid} ---- */\n' + scope_css(m.group(1), f'#page-{pid}'))

        # разметка страницы
        body = re.search(r'<main class="wrap">(.*?)</main>', html, re.S).group(1)
        sections.append(f'<section class="page wrap" id="page-{pid}" hidden>\n{body}\n</section>')

        # скрипт страницы — последний <script> без src
        code = re.findall(r'<script>\n?(.*?)</script>', html, re.S)[-1]
        code = scope_js(code, pid)
        scripts.append(f"""
/* ==================== раздел: {pid} ==================== */
PAGES['{pid}'] = (function () {{
  const ROOT = document.getElementById('page-{pid}');
  const byId = id => ROOT.querySelector('#' + id);
  let DICT = {{}};
  const PAGE_DICT = d => {{ DICT = d; }};

{code}

  return {{
    dict: () => DICT,
    refresh: () => {{
      Sky.extendDict(DICT);
      Sky.applyI18n(ROOT);
      ROOT.dispatchEvent(new CustomEvent('pagerefresh'));
    }}
  }};
}})();
""")

    shared = '\n'.join(f'/* ===== {p} ===== */\n' + read(p) for p in SHARED_JS)

    nav = ''.join(
        f'<a href="#{pid}" data-page="{pid}" data-navkey="{navkey}"></a>'
        for pid, _, navkey in PAGES
    )

    return f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>SkyySchool</title>
<meta name="description" content="Подготовка к ЕГЭ и ОГЭ, шахматы, развивающие игры для младших, режим дня и занятия с учителями.">
<meta name="theme-color" content="#f6faff">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
{chr(10).join(css)}
/* однофайловая сборка: секции переключаются без перезагрузки */
.page[hidden]{{display:none !important}}
</style>
</head>
<body>
<header id="appHeader"></header>
<main id="pages">
{chr(10).join(sections)}
</main>
<footer id="appFooter"></footer>

<script>
{shared}
</script>

<script>
'use strict';
/* Шапка и подвал общие для всех разделов, поэтому рисуются один раз. */
Sky.init({{}});

const PAGES = {{}};
</script>

<script>
{''.join(scripts)}
</script>

<script>
'use strict';
(function () {{
  const IDS = {json.dumps([p[0] for p in PAGES])};
  const NAV = {json.dumps({p[0]: p[2] for p in PAGES})};

  /* Меню в шапке рисует ядро, но здесь адреса другие: не отдельные
     файлы, а якоря одного документа. Поэтому подменяем ссылки после
     каждой перерисовки шапки. */
  function fixNav() {{
    const nav = document.querySelector('.appnav');
    if (!nav) return;
    const signedIn = !!(Sky.db && Sky.db.me && Sky.db.me());
    const here = location.hash.replace('#', '') || 'index';
    nav.innerHTML = IDS
      .filter(id => id !== 'homework' || signedIn)
      .map(id => `<a href="#${{id}}"${{id === here ? ' aria-current="page"' : ''}}>${{Sky.t(NAV[id])}}</a>`)
      .join('');
  }}

  /* Ссылки внутри разделов ведут на .html — превращаем их в якоря. */
  function fixLinks(root) {{
    root.querySelectorAll('a[href$=".html"], a[href*=".html?"]').forEach(a => {{
      const raw = a.getAttribute('href');
      const [file, query] = raw.split('?');
      const id = file.replace('.html', '');
      if (IDS.includes(id)) a.setAttribute('href', '#' + id + (query ? '?' + query : ''));
    }});
  }}

  let current = null;

  function show(id) {{
    if (!IDS.includes(id)) id = 'index';
    IDS.forEach(x => {{
      const el = document.getElementById('page-' + x);
      if (el) el.hidden = (x !== id);
    }});
    current = id;
    /* словарь раздела применяется в момент показа: у разных разделов
       одинаковые ключи с разным текстом */
    if (PAGES[id] && PAGES[id].refresh) PAGES[id].refresh();
    fixNav();
    fixLinks(document.getElementById('page-' + id));
    document.title = (Sky.t(NAV[id]) || 'SkyySchool') + ' — SkyySchool';
    window.scrollTo({{ top: 0 }});
  }}

  /* параметры вида #trainer?subject=math */
  function currentQuery() {{
    const h = location.hash.replace('#', '');
    const q = h.split('?')[1];
    return new URLSearchParams(q || '');
  }}
  window.SKY_QUERY = currentQuery;

  window.addEventListener('hashchange', () => {{
    show(location.hash.replace('#', '').split('?')[0] || 'index');
  }});
  document.addEventListener('headerready', fixNav);
  document.addEventListener('authchange', fixNav);
  document.addEventListener('langchange', () => {{ if (current) show(current); }});

  show(location.hash.replace('#', '').split('?')[0] || 'index');
}})();
</script>
</body>
</html>
"""


def to_artifact(html):
    """Артефакт сам оборачивает содержимое в каркас документа, поэтому
    свои <!doctype>, <html>, <head> и <body> нужно снять, оставив
    заголовок, стили и содержимое."""
    head = html.split('<head>', 1)[1].split('</head>', 1)[0]
    body = html.split('<body>', 1)[1].rsplit('</body>', 1)[0]

    title = re.search(r'<title>(.*?)</title>', head, re.S).group(1)
    fonts = re.findall(r'<link href="https://fonts\.googleapis[^>]*>', head)
    style = re.search(r'<style>(.*?)</style>', head, re.S).group(1)

    return (f'<title>{title}</title>\n' + '\n'.join(fonts) +
            f'\n<style>\n{style}\n</style>\n' + body)


if __name__ == '__main__':
    html = build()
    open(OUT, 'w', encoding='utf-8').write(html)
    print(f'собрано: {OUT}  ({len(html)/1024:.0f} КБ)')

    art = to_artifact(html)
    art_path = '/home/claude/build/skyschool-artifact.html'
    open(art_path, 'w', encoding='utf-8').write(art)
    print(f'для публикации: {art_path}  ({len(art)/1024:.0f} КБ)')
    for tag in ('<!doctype', '<html', '<head>', '<body>'):
        assert tag not in art.lower(), f'осталась обёртка: {tag}'
    print('обёртка документа снята ✓')
