-- =====================================================================
-- SkyySchool — демоданные для Supabase (необязательный шаг)
--
-- Честно предупреждаю, почему это не один клик: таблицы homework,
-- chess_tasks, messages и links в schema.sql привязаны внешним ключом
-- к profiles(id), а profiles(id) в свою очередь — к auth.users(id).
-- Создать «фейкового учителя» одной строкой INSERT нельзя: строка
-- в auth.users требует правильно захешированный пароль и связанные
-- служебные записи (identities), которые Supabase создаёт сам при
-- обычной регистрации. Вставлять их вручную — плохая идея: легко
-- получить аккаунт, которым нельзя будет войти, или дыру в безопасности.
--
-- Поэтому единственный надёжный путь — сначала завести 1–2 настоящих
-- аккаунта через сам сайт (это и есть предусмотренный сценарий:
-- вход/регистрация на странице учителей), а этот файл только
-- ДОЗАПОЛНЯЕТ их профиль демонстрационными данными: одно домашнее
-- задание, одну шахматную задачу и приветственное сообщение. Так
-- открывшийся первый раз сайт не выглядит пустым.
--
-- Как применить:
--   1. Откройте сайт (если ещё нет — сначала выполните schema.sql).
--   2. Зарегистрируйтесь как учитель — например email:
--        teacher.demo@skyyschool.local
--   3. Зарегистрируйтесь (в другой вкладке/браузере или выйдя из
--      первого аккаунта) как ученик — например:
--        student.demo@skyyschool.local
--   4. При необходимости поменяйте оба email ниже на те, что ввели.
--   5. Supabase → SQL Editor → New query → вставьте этот файл → Run.
--      Выполнять можно повторно — дублей не создаст.
-- =====================================================================

do $$
declare
  v_teacher uuid;
  v_student uuid;
  v_hw      uuid;
begin
  select id into v_teacher from profiles where email = 'teacher.demo@skyyschool.local' limit 1;
  select id into v_student from profiles where email = 'student.demo@skyyschool.local' limit 1;

  if v_teacher is null or v_student is null then
    raise notice 'Пропущено: сначала зарегистрируйте teacher.demo@skyyschool.local и student.demo@skyyschool.local через сам сайт (или поменяйте email в этом файле на свои), затем запустите seed.sql ещё раз.';
    return;
  end if;

  -- учитель и ученик становятся связаны (как после подписки на странице «Учителя»)
  insert into links (teacher_id, student_id, status)
  values (v_teacher, v_student, 'active')
  on conflict (teacher_id, student_id) do nothing;

  -- одно демонстрационное домашнее задание по математике
  -- (task_ids должны существовать в data/bank-math.js — m1..m15 есть в базовом наборе)
  select id into v_hw from homework
    where teacher_id = v_teacher and student_id = v_student and title = 'Демо: проценты и уравнения'
    limit 1;

  if v_hw is null then
    insert into homework (teacher_id, student_id, title, subject, task_ids, due_date, note)
    values (
      v_teacher, v_student,
      'Демо: проценты и уравнения',
      'math',
      array['m1','m2','m3','m4','m5'],
      (current_date + interval '7 days')::date,
      'Это демонстрационное задание — можно решить, чтобы посмотреть, как выглядит проверка учителем.'
    );
  end if;

  -- одна демонстрационная шахматная задача «от учителя»
  insert into chess_tasks (teacher_id, student_id, fen, solutions, note)
  select
    v_teacher, v_student,
    'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
    array['Nxe5'],
    'Демо-задача: найдите взятие пешки конём.'
  where not exists (
    select 1 from chess_tasks
    where teacher_id = v_teacher and student_id = v_student
      and note = 'Демо-задача: найдите взятие пешки конём.'
  );

  -- приветственное сообщение
  insert into messages (from_id, to_id, text)
  select v_teacher, v_student, 'Добро пожаловать! Я добавил(а) вам первое домашнее задание и шахматную задачу — загляните в разделы «Задания» и «Шахматы».'
  where not exists (
    select 1 from messages
    where from_id = v_teacher and to_id = v_student
      and text like 'Добро пожаловать!%'
  );

  raise notice 'Готово: связь учитель↔ученик, 1 домашнее задание, 1 шахматная задача, 1 сообщение.';
end $$;
