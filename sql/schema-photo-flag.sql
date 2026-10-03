/* ============================================================
   SkyySchool — «Это распознано неверно» в photo.html

   Проверку фото в photo_checks пишет Worker (sky_log_check), ученику
   таблица открыта только на чтение и удаление своих строк — менять
   их напрямую он не может и не должен (оценку, текст, токены). Для
   жалобы на распознавание нужна ровно одна правка: поставить флаг.
   Её делает функция photo_check_flag — только у своей проверки и
   только за последние сутки.

     ocr_flagged    boolean     — ученик отметил, что модель прочитала
                                  почерк неверно; оценка по такому
                                  тексту несправедлива
     ocr_flagged_at timestamptz — когда отметил

   Проверку ищем по ссылке на фото: Worker кладёт в image_url первую
   ссылку без подписи (?token=…), а путь в хранилище у каждой проверки
   свой (<user>/<сессия>/1.jpg). Поэтому страница передаёт ту же
   подписанную ссылку, что отдавала Worker, а функция отрезает подпись.
   Строку Worker пишет уже после ответа (ctx.waitUntil), так что
   false — «пока не нашли», страница пробует ещё раз.

   Выполнять после sql/schema-photo-limits.sql и sql/schema-tariffs.sql.
   Можно запускать повторно.
   ============================================================ */

begin;

alter table public.photo_checks add column if not exists ocr_flagged    boolean not null default false;
alter table public.photo_checks add column if not exists ocr_flagged_at timestamptz;

create or replace function public.photo_check_flag(p_image_url text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_url text := nullif(split_part(coalesce(p_image_url, ''), '?', 1), '');
  v_n   int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_url is null then
    return false;
  end if;

  update public.photo_checks
     set ocr_flagged = true,
         ocr_flagged_at = coalesce(ocr_flagged_at, now())
   where user_id = v_uid
     and image_url = v_url
     and created_at > now() - interval '1 day';
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

revoke all on function public.photo_check_flag(text) from public;
revoke all on function public.photo_check_flag(text) from anon;
grant execute on function public.photo_check_flag(text) to authenticated;

commit;
