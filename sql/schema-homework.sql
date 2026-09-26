/* ============================================================
   SkyySchool — разбор домашки по фото: лимиты по предметам и
   задания от живого учителя.

   Выполнять в Supabase → SQL Editor. Файл идемпотентный, можно
   запускать повторно.

   ------------------------------------------------------------
   ПОЧЕМУ ЭТО ОТДЕЛЬНО ОТ schema-photo-limits.sql

   В проекте уже есть лимиты на фото: plan_limits, user_plans,
   photo_usage и функция photo_try_consume. Они считают проверки за
   день ОБЩИМ числом, без разбивки по предметам.

   Здесь заводится второй счётчик — по предметам, как и просил
   владелец. Честно скажу о последствии: на одну кнопку теперь
   смотрят два лимита, и они будут расходиться. Ученик, у которого по
   общему лимиту ещё есть попытки, может упереться в предметный, и
   наоборот. Чтобы это не превращалось в загадку, воркер проверяет
   ПРЕДМЕТНЫЙ лимит первым и в отказе прямо пишет, какой именно
   лимит сработал. Если однажды захочется свести их в один — merge
   делается добавлением колонки subject в photo_usage, а эта схема
   удаляется целиком.
   ------------------------------------------------------------ */

create extension if not exists pgcrypto;

/* ---------- 1. счётчик проверок по предметам ---------- */

create table if not exists public.homework_checks (
  user_id    uuid not null references auth.users(id) on delete cascade,
  subject    text not null,
  day        date not null default (now() at time zone 'utc')::date,
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, subject, day)
);

comment on table public.homework_checks is
  'Сколько разборов домашки по фото ученик сделал за день по каждому предмету.';

create index if not exists homework_checks_day_idx
  on public.homework_checks (day);

/* Сколько фото прошло через разбор — для статистики и для возврата.
   add column if not exists: если прошлая версия этого файла уже была
   выполнена, колонка добавится к существующей таблице. */
alter table public.homework_checks
  add column if not exists photos integer not null default 0;

comment on column public.homework_checks.count is
  'Число СЕАНСОВ проверки за день. Сеанс — одно нажатие «проверить», в нём от 1 до 5 фото (VIP — до 20).';
comment on column public.homework_checks.day is
  'Дата по МЕСТНОМУ времени ученика — счётчик обнуляется в его полночь, а не в полночь по UTC.';

/* ---------- 2. задания от живого учителя ---------- */

create table if not exists public.teacher_tasks (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  subject    text not null,
  task_text  text not null,
  created_at timestamptz not null default now()
);

comment on table public.teacher_tasks is
  'Задание, которое учитель раздаёт ученикам ссылкой вида ?task=<id>.';

create index if not exists teacher_tasks_teacher_idx
  on public.teacher_tasks (teacher_id, created_at desc);

/* ---------- 3. RLS ----------

   Включаем на обеих таблицах. Дальше — важное про доступ к заданию
   по ссылке, см. комментарий к homework_task_get(). */

alter table public.homework_checks enable row level security;
alter table public.teacher_tasks   enable row level security;

drop policy if exists hw_checks_own on public.homework_checks;
create policy hw_checks_own on public.homework_checks
  for select using (auth.uid() = user_id);
/* Писать напрямую нельзя НИКОМУ: счётчик меняется только функцией
   ниже. Иначе ученик просто обнулил бы себе count. */

drop policy if exists teacher_tasks_own on public.teacher_tasks;
create policy teacher_tasks_own on public.teacher_tasks
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

/* ---------- 4. выдача задания по ссылке ----------

   Ссылку открывает ученик, который может быть не залогинен вовсе.
   Соблазн — политика select using (true). Так делать нельзя: она
   разрешает не только «прочитать своё задание по id», но и вычитать
   таблицу целиком, то есть все задания всех учителей.

   Поэтому доступ даётся функцией, которая отдаёт РОВНО ОДНУ строку
   по точному id. Угадать uuid перебором нереально, а перечислить
   таблицу через функцию невозможно — она не умеет возвращать список. */

create or replace function public.homework_task_get(p_id uuid)
returns table (id uuid, subject text, task_text text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select t.id, t.subject, t.task_text, t.created_at
  from public.teacher_tasks t
  where t.id = p_id;
$$;

/* ---------- 5. сеансы ----------

   ЧТО СЧИТАЕТСЯ

   Сеанс — одно событие «проверить домашку по предмету»: ученик выбрал
   фото и нажал кнопку. В сеансе может быть несколько фото.

     бесплатно:  1 сеанс в день на предмет, до 5 фото в сеансе
     VIP:        сеансов без ограничений,  до 20 фото в сеансе

   VIP — любой действующий платный тариф из user_plans (если схема
   тарифов установлена). Отдельной сущности «VIP» в базе нет.

   ПОЛНОЧЬ ПО МЕСТНОМУ ВРЕМЕНИ

   Счётчик обнуляется в 00:00 по часовому поясу ученика. Пояс приходит
   с клиента, и соврать о нём можно. Насколько это опасно, посчитано:
   часовые пояса Земли лежат в пределах от UTC−12 до UTC+14, это 26
   часов. В любой момент времени подменой пояса можно попасть максимум
   в соседние сутки. Переставляя пояс, ученик может «занять» сеанс
   у завтрашнего дня, но завтра этот сеанс уже будет израсходован.
   Итого за всё время — не больше двух лишних сеансов на предмет, а не
   два в день. Хранить пояс в профиле и запрещать его менять ради
   этого незачем: сломалось бы у тех, кто действительно переехал.

   Время берётся с сервера (now()), с клиента — только название пояса.
   Перевести часы на телефоне и получить новый день нельзя. */

/* Старые сигнатуры из прошлой версии этого файла. Если она уже была
   выполнена, эти функции надо убрать: у PostgreSQL функции с разными
   аргументами — разные функции, и старая осталась бы висеть рядом с
   новой со старыми правами. */
drop function if exists public.homework_try_consume(text, integer);
drop function if exists public.homework_try_consume(text);
drop function if exists public.homework_refund(text);
drop function if exists public.homework_refund(uuid, text);
drop function if exists public.homework_my_usage();

/* Местная дата по названию пояса. Неизвестный пояс — UTC: лучше
   сбросить счётчик на несколько часов раньше, чем упасть. */
create or replace function public.homework_local_day(p_tz text)
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone coalesce(
            (select z.name from pg_timezone_names z where z.name = p_tz limit 1),
            'UTC'))::date;
$$;

create or replace function public.homework_is_vip(p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan text;
begin
  /* Схема тарифов может быть не установлена — тогда все бесплатные. */
  begin
    select p.plan into v_plan
    from public.user_plans p
    where p.user_id = p_user
      and (p.valid_until is null or p.valid_until > now());
  exception when undefined_table or undefined_column then
    v_plan := null;
  end;
  return v_plan is not null and v_plan <> 'free';
end;
$$;

/* Начать сеанс.

   Лимиты — константы внутри функции, а не аргументы. Функцию вызывает
   сам ученик (через Worker его токеном), и число, пришедшее
   аргументом, он мог бы подменить.

   Число фото аргументом приходит, и это нормально: Worker передаёт то
   число, которое он реально отправит в модель. Ученик, вызвавший
   функцию напрямую с p_photos = 1, только потратит свой собственный
   сеанс.

   Выходной столбец называется local_day, а не day, НАМЕРЕННО: в
   PL/pgSQL выходные параметры видны как переменные, и столбец с тем же
   именем, что у колонки таблицы, делает ON CONFLICT (…, day)
   неоднозначным — функция падает с «column reference is ambiguous». */
create or replace function public.homework_try_consume(p_subject text, p_photos integer, p_tz text)
returns table (allowed boolean, reason text, used integer, day_limit integer,
               photo_limit integer, local_day date, vip boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  c_free_sessions constant integer := 1;
  c_free_photos   constant integer := 5;
  c_vip_photos    constant integer := 20;

  v_user  uuid    := auth.uid();
  v_subj  text    := lower(btrim(coalesce(p_subject, 'other')));
  v_n     integer := coalesce(p_photos, 0);
  v_vip   boolean;
  v_cap   integer;
  v_lim   integer;
  v_day   date;
  v_used  integer;
begin
  if v_user is null then
    return query select false, 'anonymous'::text, 0, c_free_sessions, c_free_photos, null::date, false;
    return;
  end if;

  v_vip := public.homework_is_vip(v_user);
  v_cap := case when v_vip then c_vip_photos else c_free_photos end;
  v_lim := case when v_vip then -1 else c_free_sessions end;   /* -1 = без лимита */
  v_day := public.homework_local_day(p_tz);

  /* Проверки числа фото — ДО списания. Отказ по ним сеанс не тратит:
     ученик уберёт лишние фото и отправит снова. */
  if v_n < 1 then
    return query select false, 'no_photos'::text, 0, v_lim, v_cap, v_day, v_vip;
    return;
  end if;
  if v_n > v_cap then
    return query select false, 'too_many_photos'::text, 0, v_lim, v_cap, v_day, v_vip;
    return;
  end if;

  insert into public.homework_checks (user_id, subject, day, count, photos)
  values (v_user, v_subj, v_day, 0, 0)
  on conflict on constraint homework_checks_pkey do nothing;

  /* FOR UPDATE держит строку до конца транзакции: два одновременных
     нажатия не проскочат вместе на один оставшийся сеанс. */
  select h.count into v_used
  from public.homework_checks h
  where h.user_id = v_user and h.subject = v_subj and h.day = v_day
  for update;

  if not v_vip and v_used >= c_free_sessions then
    return query select false, 'limit'::text, v_used, v_lim, v_cap, v_day, v_vip;
    return;
  end if;

  update public.homework_checks h
     set count = h.count + 1,
         photos = h.photos + v_n,
         updated_at = now()
   where h.user_id = v_user and h.subject = v_subj and h.day = v_day
  returning h.count into v_used;

  return query select true,
    (case when v_vip then 'subscription' else 'ok' end)::text,
    v_used, v_lim, v_cap, v_day, v_vip;
end;
$$;

/* Вернуть сеанс, когда модель не ответила.

   День принимается аргументом — тот, что вернул homework_try_consume,
   а не вычисляется заново. Разбор двадцати фото идёт десятки секунд,
   и если за это время у ученика наступила полночь, пересчёт даты
   вернул бы сеанс не тому дню: вчерашний так и остался бы
   израсходованным, а сегодняшний ушёл бы в минус.

   Личность — тоже аргументом, и это безопасно ровно потому, что
   вызвать функцию может только сервисная роль (см. права). Возврат
   УМЕНЬШАЕТ счётчик: в руках ученика это был бы безлимит. */
create or replace function public.homework_refund(p_user uuid, p_subject text, p_day date, p_photos integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null or p_day is null then return; end if;
  update public.homework_checks h
     set count  = greatest(0, h.count - 1),
         photos = greatest(0, h.photos - coalesce(p_photos, 0)),
         updated_at = now()
   where h.user_id = p_user
     and h.subject = lower(btrim(coalesce(p_subject, 'other')))
     and h.day = p_day;
end;
$$;

/* Что показать ученику ДО отправки: тариф, сколько фото можно,
   по каким предметам сеанс сегодня уже был. Ничего не списывает.
   Нужна, чтобы окно с тарифами открывалось сразу, а не после того,
   как ученик выбрал пять фото и дождался их сжатия. */
create or replace function public.homework_my_usage(p_tz text)
returns table (vip boolean, photo_limit integer, session_limit integer,
               local_day date, used_subjects text[])
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_vip  boolean;
  v_day  date := public.homework_local_day(p_tz);
begin
  if v_user is null then
    return query select false, 5, 1, v_day, array[]::text[];
    return;
  end if;
  v_vip := public.homework_is_vip(v_user);
  return query
    select v_vip,
           (case when v_vip then 20 else 5 end),
           (case when v_vip then -1 else 1 end),
           v_day,
           coalesce(array_agg(h.subject order by h.subject), array[]::text[])
    from public.homework_checks h
    where h.user_id = v_user and h.day = v_day and h.count > 0;
end;
$$;

/* ---------- 6. права ----------

   PostgreSQL по умолчанию выдаёт EXECUTE роли PUBLIC, а не только
   anon и authenticated. «revoke … from anon, authenticated» поэтому
   не закрывает НИЧЕГО. Отзываем у public и выдаём точечно. */

revoke all on function public.homework_local_day(text)                         from public;
revoke all on function public.homework_is_vip(uuid)                            from public;
revoke all on function public.homework_try_consume(text, integer, text)        from public;
revoke all on function public.homework_refund(uuid, text, date, integer)       from public;
revoke all on function public.homework_my_usage(text)                          from public;
revoke all on function public.homework_task_get(uuid)                          from public;

/* homework_is_vip и homework_local_day вызываются только изнутри
   других функций и отдельно никому не выдаются: иначе любой мог бы
   узнать, у кого из учеников платный тариф. */

/* Списание — от имени ученика: Worker передаёт его токен. */
grant execute on function public.homework_try_consume(text, integer, text)  to authenticated, service_role;
/* Возврат — только сервисной роли. */
grant execute on function public.homework_refund(uuid, text, date, integer) to service_role;
/* Остаток ученик смотрит сам. */
grant execute on function public.homework_my_usage(text)                    to authenticated;
/* Задание по ссылке открывается и без входа. */
grant execute on function public.homework_task_get(uuid)                    to anon, authenticated;

revoke all on table public.homework_checks from anon, authenticated;
grant select on table public.homework_checks to authenticated;   /* только своё, см. RLS */
grant all    on table public.teacher_tasks   to authenticated;   /* только своё, см. RLS */

/* ---------- 7. хранилище фото ----------

   ПОЧЕМУ ФОТО ИДУТ ЧЕРЕЗ ХРАНИЛИЩЕ, А НЕ ПРЯМО В ЗАПРОСЕ

   Первая мысль — положить все фото base64 в один запрос к Worker.
   Замер показал, что так нельзя: на бесплатном тарифе Cloudflare
   Workers лимит — 10 мс процессора на запрос, а только разбор и
   пересборка JSON с фотографиями съедают 16 мс для пяти фото и от 85
   до 350 мс для двадцати. Worker обрывался бы с ошибкой 1102.

   Поэтому ученик загружает фото сюда по одному, а Worker передаёт
   в модель короткие подписанные ссылки. Запрос к Worker крошечный,
   модель скачивает картинки сама. После разбора Worker фото удаляет —
   тетради детей хранить незачем.

   Бакет закрытый: ссылки на фото подписываются на 10 минут. Размер и
   тип файла проверяет само хранилище, а не только страница. */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('homework', 'homework', false, 1572864, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/* Ученик пишет только в папку со своим id: homework/<uid>/<файл>.
   Без этого условия один ученик мог бы подложить фото в папку
   другого, и Worker, проверяющий папку, пропустил бы их. */
drop policy if exists hw_photos_insert on storage.objects;
create policy hw_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'homework' and (storage.foldername(name))[1] = auth.uid()::text);

/* Читать и удалять своё — чтобы страница могла убрать уже
   загруженные фото, если загрузка оборвалась посередине.

   Чтение нужно не само по себе, а ради удаления. В PostgreSQL DELETE
   с условием видит только те строки, которые разрешено ЧИТАТЬ; без
   политики на select строки невидимы, и удалять оказывается нечего.
   Первая версия этого файла так и сделала — тест показал, что ученик
   не может стереть даже собственное фото. Supabase для удаления из
   хранилища тоже требует обе политики. */
drop policy if exists hw_photos_select on storage.objects;
create policy hw_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'homework' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists hw_photos_delete on storage.objects;
create policy hw_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'homework' and (storage.foldername(name))[1] = auth.uid()::text);
