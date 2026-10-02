-- =====================================================================
-- Тесты: подборки заданий по ссылке (sql/schema-collections.sql).
-- Запуск — scripts/test-rls.sh, после rls-tests.sql в той же базе.
-- =====================================================================

\set ON_ERROR_STOP on
\timing off
\o /dev/null

truncate _test_results;
create or replace function t_check(what text, ok boolean)
returns void language plpgsql as $$
begin
  perform t_record(what, coalesce(ok, false), case when ok then '' else 'не выполнено' end);
end $$;

delete from auth.users where email like '%@coll.test';
insert into auth.users (id, email, raw_user_meta_data) values
  ('c0000000-0000-0000-0000-00000000000a', 't1@coll.test', '{"name":"Анна Петровна","role":"teacher"}'),
  ('c0000000-0000-0000-0000-00000000000b', 't2@coll.test', '{"name":"Борис Иванович","role":"teacher"}'),
  ('c0000000-0000-0000-0000-00000000000c', 's1@coll.test', '{"name":"Саша Ученик","role":"student"}');

-- задания: выбор варианта (верный — 1), текст с ответом, открытое
\set tasks '''[{"id":"t1","type":"choice","text":"2+2?","options":["3","4","5"],"answer":1,"source":"bank:math:m1"},{"id":"t2","type":"text","text":"Половина от 1?","accept":["0,5","1/2"]},{"id":"t3","type":"text","text":"Опишите осень"}]'''

-- ---------------------------------------------------------------------
-- Учитель 1: категория и подборки
-- ---------------------------------------------------------------------
set role authenticated;
select t_login('c0000000-0000-0000-0000-00000000000a');
insert into task_categories (id, name, subject) values ('ca000000-0000-0000-0000-000000000001', 'Дроби', 'math');
insert into task_collections (id, category_id, title, description, subject, share_code, tasks, is_public)
values ('c1000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001', 'Дроби: разминка', 'Решите три задания', 'math', 'HACKED', :tasks::jsonb, true);
insert into task_collections (id, title, tasks, is_public)
values ('c1000000-0000-0000-0000-000000000002', 'Только для вошедших', :tasks::jsonb, false);
insert into task_collections (id, title, tasks, is_public, expires_at)
values ('c1000000-0000-0000-0000-000000000003', 'Прошлая неделя', :tasks::jsonb, true, now() - interval '1 day');
insert into task_collections (id, title, tasks, is_public)
values ('c1000000-0000-0000-0000-000000000004', 'Только выбор', '[{"id":"q1","type":"choice","text":"1+1?","options":["2","3"],"answer":0}]'::jsonb, true);
reset role;

select t_check('код подборки ставит сервер: 6 символов без I, O, 1, 0',
  (select bool_and(share_code ~ '^[A-HJ-NP-Z2-9]{6}$' and share_code <> 'HACKED') from task_collections where teacher_id = 'c0000000-0000-0000-0000-00000000000a'));
select t_check('коды разные', (select count(distinct share_code) = 4 from task_collections where teacher_id = 'c0000000-0000-0000-0000-00000000000a'));
select t_check('teacher_id по умолчанию — тот, кто вошёл',
  (select count(*) = 4 from task_collections where teacher_id = 'c0000000-0000-0000-0000-00000000000a'));

-- коды — в переменные psql
select share_code as code_pub from task_collections where id = 'c1000000-0000-0000-0000-000000000001' \gset
select share_code as code_priv from task_collections where id = 'c1000000-0000-0000-0000-000000000002' \gset
select share_code as code_old from task_collections where id = 'c1000000-0000-0000-0000-000000000003' \gset
select share_code as code_choice from task_collections where id = 'c1000000-0000-0000-0000-000000000004' \gset

set role authenticated;
select t_login('c0000000-0000-0000-0000-00000000000a');
select t_expect('учитель видит свои подборки', (select count(*) from task_collections), 4);
select t_expect('учитель видит свою категорию', (select count(*) from task_categories), 1);
select t_expect_rows_affected('код после создания не меняется',
  $q$ update task_collections set share_code = 'ZZZZZZ', title = 'Дроби: разминка' where id = 'c1000000-0000-0000-0000-000000000001' $q$, 1);
reset role;
select t_check('…и правда не поменялся', (select share_code = :'code_pub' from task_collections where id = 'c1000000-0000-0000-0000-000000000001'));

-- ---------------------------------------------------------------------
-- Чужие: учитель 2, ученик, аноним
-- ---------------------------------------------------------------------
set role authenticated;
select t_login('c0000000-0000-0000-0000-00000000000b');
select t_expect('чужой учитель не видит подборки (а в них — ответы)', (select count(*) from task_collections), 0);
select t_expect('чужой учитель не видит категории', (select count(*) from task_categories), 0);
select t_expect_denied('нельзя положить подборку в чужую категорию',
  $q$ insert into task_collections (title, tasks, category_id) values ('x', '[{"id":"a","text":"b"}]', 'ca000000-0000-0000-0000-000000000001') $q$);
select t_expect_denied('нельзя создать подборку от чужого имени',
  $q$ insert into task_collections (teacher_id, title, tasks) values ('c0000000-0000-0000-0000-00000000000a', 'x', '[{"id":"a","text":"b"}]') $q$);
select t_expect_rows_affected('нельзя удалить чужую подборку',
  $q$ delete from task_collections where id = 'c1000000-0000-0000-0000-000000000001' $q$, 0);
select t_expect_denied('пустая подборка — ошибка', $q$ insert into task_collections (title, tasks) values ('x', '[]') $q$);
select t_expect_denied('больше 100 заданий — ошибка',
  $q$ insert into task_collections (title, tasks) select 'x', jsonb_agg(jsonb_build_object('id', i::text, 'text', 't')) from generate_series(1, 101) i $q$);
select t_login('c0000000-0000-0000-0000-00000000000c');
select t_expect('ученик не видит подборки напрямую', (select count(*) from task_collections), 0);
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t_expect_denied('аноним не читает таблицу подборок', $q$ select count(*) from task_collections $q$);
reset role;

-- ---------------------------------------------------------------------
-- Подборка по коду
-- ---------------------------------------------------------------------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
create temp table _r as select get_collection_by_code(lower(' ' || :'code_pub' || ' ')) as j;
reset role;
select t_check('по коду (в любом регистре, с пробелами): название, описание, учитель',
  (select j ->> 'title' = 'Дроби: разминка' and j ->> 'description' = 'Решите три задания' and j ->> 'teacher' = 'Анна Петровна' from _r));
select t_check('по коду: 3 задания, варианты на месте',
  (select jsonb_array_length(j -> 'tasks') = 3 and j -> 'tasks' -> 0 -> 'options' = '["3","4","5"]'::jsonb from _r));
select t_check('по коду: ПРАВИЛЬНЫХ ОТВЕТОВ НЕТ', (select position('"answer"' in (j -> 'tasks')::text) = 0
  and position('accept' in (j -> 'tasks')::text) = 0 and position('0,5' in j::text) = 0 from _r));
drop table _r;

set role anon;
select t_check('неизвестный код — not_found', get_collection_by_code('QQQQQQ') ->> 'error' = 'not_found');
select t_check('просроченная — expired', get_collection_by_code(:'code_old') ->> 'error' = 'expired');
select t_check('не публичная без входа — login_required', get_collection_by_code(:'code_priv') ->> 'error' = 'login_required');
select t_expect_denied('аноним не пишет ответы напрямую',
  $q$ insert into collection_submissions (collection_id, student_name, score) values ('c1000000-0000-0000-0000-000000000001', 'x', 100) $q$);
reset role;
set role authenticated;
select t_login('c0000000-0000-0000-0000-00000000000c');
select t_check('не публичная, но ученик вошёл — открывается', get_collection_by_code(:'code_priv') ->> 'title' = 'Только для вошедших');
select t_expect_denied('ученик не пишет ответы напрямую (иначе поставит себе 100%)',
  $q$ insert into collection_submissions (collection_id, student_id, student_name, score, percent, status) values ('c1000000-0000-0000-0000-000000000001', auth.uid(), 'x', 3, 100, 'checked') $q$);
reset role;

-- ---------------------------------------------------------------------
-- Отправка и автопроверка
-- ---------------------------------------------------------------------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
create temp table _s as select submit_collection(:'code_pub', '  Петя Иванов  ',
  '[{"task_id":"t1","answer":"1"},{"task_id":"t2","answer":" 0.5 "},{"task_id":"t3","answer":"Листья жёлтые"}]'::jsonb) as j;
reset role;
select t_check('ответ ученику: верно 2 из 3, одно открытое', (select j ->> 'ok' = 'true' and (j ->> 'correct')::int = 2 and (j ->> 'auto')::int = 2
  and (j ->> 'open')::int = 1 and (j ->> 'total')::int = 3 from _s));
drop table _s;
select t_check('записано: имя, балл 2, 66.7 %, ждёт учителя, без student_id',
  (select student_name = 'Петя Иванов' and score = 2 and percent = 66.7 and status = 'pending' and student_id is null
     from collection_submissions where collection_id = 'c1000000-0000-0000-0000-000000000001'));
select t_check('по каждому заданию — ответ и верно/неверно/ждёт',
  (select answers -> 0 ->> 'correct' = 'true' and answers -> 1 ->> 'correct' = 'true' and jsonb_typeof(answers -> 2 -> 'correct') = 'null'
          and answers -> 2 ->> 'answer' = 'Листья жёлтые'
     from collection_submissions where collection_id = 'c1000000-0000-0000-0000-000000000001'));

-- разбор по заданиям для учителя (teacher-review.html)
select t_check('task_details: вопрос, ответ ученика (текст варианта), верно/неверно/ждёт',
  (select jsonb_array_length(task_details) = 3
          and task_details -> 0 ->> 'question' = '2+2?' and task_details -> 0 ->> 'student_answer' = '4'
          and (task_details -> 0 ->> 'student_choice')::int = 1 and task_details -> 0 ->> 'is_correct' = 'true'
          and task_details -> 0 -> 'options' = '["3","4","5"]'::jsonb
          and task_details -> 1 ->> 'student_answer' = ' 0.5 ' and task_details -> 1 ->> 'is_correct' = 'true'
          and task_details -> 2 ->> 'type' = 'text' and jsonb_typeof(task_details -> 2 -> 'is_correct') = 'null'
     from collection_submissions where collection_id = 'c1000000-0000-0000-0000-000000000001'));
select t_check('task_details: ПРАВИЛЬНЫХ ОТВЕТОВ НЕТ (строку читает и сам ученик)',
  (select position('0,5' in task_details::text) = 0 and position('1/2' in task_details::text) = 0
          and position('accept' in task_details::text) = 0 and position('correct_answer' in task_details::text) = 0
          and not (task_details -> 0 ? 'answer')
     from collection_submissions where collection_id = 'c1000000-0000-0000-0000-000000000001'));
select t_check('task_details совпадает с разбором из сохранённых ответов (им заполняются старые отправки)',
  (select task_details = collection_task_details(c.tasks, s.answers)
     from collection_submissions s join task_collections c on c.id = s.collection_id
    where s.collection_id = 'c1000000-0000-0000-0000-000000000001'));
select t_check('без класса — student_class пустой',
  (select student_class is null from collection_submissions where collection_id = 'c1000000-0000-0000-0000-000000000001'));

set role anon;
select t_check('повтор через секунду — too_fast', submit_collection(:'code_pub', 'Петя Иванов', '[]') ->> 'error' = 'too_fast');
select t_check('без имени — name_required', submit_collection(:'code_pub', '  ', '[]') ->> 'error' = 'name_required');
select t_check('в просроченную — expired', submit_collection(:'code_old', 'Петя', '[]') ->> 'error' = 'expired');
select t_check('в не публичную без входа — login_required', submit_collection(:'code_priv', 'Петя', '[]') ->> 'error' = 'login_required');
select t_check('ответы не массивом — bad_answers', submit_collection(:'code_choice', 'Коля', '{"x":1}') ->> 'error' = 'bad_answers');
select t_check('только выбор варианта — сразу checked', submit_collection(:'code_choice', 'Коля', '[{"task_id":"q1","answer":"0"}]') ->> 'correct' = '1');
reset role;
select t_check('…статус checked, 100 %', (select status = 'checked' and percent = 100 from collection_submissions where collection_id = 'c1000000-0000-0000-0000-000000000004'));
set role anon;
select t_check('с классом — принят (четвёртый параметр)', submit_collection(:'code_choice', 'Вера', '[{"task_id":"q1","answer":"1"}]', '  7   Б ') ->> 'correct' = '0');
select t_check('класс длиннее 20 знаков обрезается', submit_collection(:'code_choice', 'Гоша', '[]', repeat('Ж', 50)) ->> 'ok' = 'true');
select t_check('номер варианта «99999999999» — не ошибка, просто неверно', submit_collection(:'code_choice', 'Дима', '[{"task_id":"q1","answer":"99999999999"}]') ->> 'correct' = '0');
select t_expect_denied('аноним не вызывает служебную функцию разбора', $q$ select collection_task_details('[]', '[]') $q$);
-- так зовёт PostgREST: по именам. Три имени — прежняя функция, четыре —
-- новая; неоднозначности нет
select t_check('вызов по именам без класса (как со старой страницы) — работает',
  submit_collection(p_code => :'code_choice', p_student_name => 'Ира', p_answers => '[{"task_id":"q1","answer":"0"}]') ->> 'correct' = '1');
select t_check('вызов по именам с классом — работает',
  submit_collection(p_code => :'code_choice', p_student_name => 'Олег', p_answers => '[]', p_student_class => '5А') ->> 'ok' = 'true');
reset role;
select t_check('…класс «7 Б» (пробелы схлопнуты), вариант «3» — неверно',
  (select student_class = '7 Б' and task_details -> 0 ->> 'student_answer' = '3' and task_details -> 0 ->> 'is_correct' = 'false'
     from collection_submissions where student_name = 'Вера'));
select t_check('…класс обрезан до 20, без ответа — student_answer пустой',
  (select char_length(student_class) = 20 and jsonb_typeof(task_details -> 0 -> 'student_answer') = 'null'
     from collection_submissions where student_name = 'Гоша'));

set role authenticated;
select t_login('c0000000-0000-0000-0000-00000000000c');
select t_check('вошедший ученик без имени — имя из профиля, ответы неверные',
  (submit_collection(:'code_priv', null, '[{"task_id":"t1","answer":"0"},{"task_id":"t2","answer":"2"}]') ->> 'correct') = '0');
reset role;
select t_check('…student_id и имя записаны, пустой ответ на открытое — ждёт',
  (select student_id = 'c0000000-0000-0000-0000-00000000000c' and student_name = 'Саша Ученик' and status = 'pending'
          and answers -> 2 ->> 'answer' = ''
     from collection_submissions where collection_id = 'c1000000-0000-0000-0000-000000000002'));

-- ---------------------------------------------------------------------
-- Кто что видит и проверка учителем
-- ---------------------------------------------------------------------
set role authenticated;
select t_login('c0000000-0000-0000-0000-00000000000c');
select t_expect('ученик видит только свою отправку', (select count(*) from collection_submissions), 1);
select t_expect_rows_affected('ученик не правит свой балл', $q$ update collection_submissions set score = 3 $q$, 0);
select t_login('c0000000-0000-0000-0000-00000000000b');
select t_expect('чужой учитель не видит отправок', (select count(*) from collection_submissions), 0);
select t_expect_denied('чужой учитель не проверяет',
  $q$ select review_collection_submission((select id from collection_submissions limit 1), '{}'::jsonb, 'x') $q$);
select t_login('c0000000-0000-0000-0000-00000000000a');
select t_expect('учитель видит все отправки по своим подборкам', (select count(*) from collection_submissions), 8);
create temp table _v as select review_collection_submission(
  (select id from collection_submissions where student_name = 'Петя Иванов'), '{"t3": true}'::jsonb, 'Хорошо описал!') as j;
select t_check('проверка учителем: открытое засчитано — 3/3, 100 %, checked, комментарий',
  (select (j ->> 'score')::int = 3 and (j ->> 'percent')::numeric = 100 and j ->> 'status' = 'checked' and j ->> 'teacher_comment' = 'Хорошо описал!' from _v));
drop table _v;
select t_check('…и в task_details открытое теперь «верно»',
  (select task_details -> 2 ->> 'is_correct' = 'true' and task_details -> 0 ->> 'is_correct' = 'true'
     from collection_submissions where student_name = 'Петя Иванов'));
select t_check('учитель может поправить и автопроверку',
  (review_collection_submission((select id from collection_submissions where student_name = 'Петя Иванов'), '{"t1": false}'::jsonb, null) ->> 'score')::int = 2);
select t_check('…task_details за ней следует: первое — неверно',
  (select task_details -> 0 ->> 'is_correct' = 'false' and task_details -> 2 ->> 'is_correct' = 'true'
     from collection_submissions where student_name = 'Петя Иванов'));
select t_expect_denied('учитель не вызывает служебную функцию разбора напрямую', $q$ select collection_task_details('[]', '[]') $q$);
select t_check('без оценки открытого — остаётся pending',
  review_collection_submission((select id from collection_submissions where student_name = 'Саша Ученик'), '{"t1": true}'::jsonb, null) ->> 'status' = 'pending');
select t_expect_rows_affected('учитель удаляет свою подборку', $q$ delete from task_collections where id = 'c1000000-0000-0000-0000-000000000001' $q$, 1);
select t_expect('…и её отправки ушли вместе с ней', (select count(*) from collection_submissions), 7);
reset role;
set role anon;
select t_expect_denied('аноним не вызывает проверку', $q$ select review_collection_submission(gen_random_uuid(), '{}'::jsonb, null) $q$);
reset role;

delete from auth.users where email like '%@coll.test';

\o
select case when ok then ' ✓ ' else ' ✗ ' end as " ", rpad(what, 60) as "проверка", details as "подробности"
  from _test_results order by n;
select count(*) as "всего", count(*) filter (where ok) as "прошло", count(*) filter (where not ok) as "провалено"
  from _test_results;
do $$
begin
  if exists (select 1 from _test_results where not ok) then
    raise exception 'Есть проваленные проверки подборок — см. таблицу выше';
  end if;
  raise notice 'Все проверки подборок пройдены.';
end $$;
