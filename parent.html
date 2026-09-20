-- =====================================================================
-- SkyySchool — доступ родителя к домашним заданиям
--
-- Это ДОПОЛНЕНИЕ, а не замена. Порядок применения:
--   1. sql/schema.sql          (тут появились homework и submissions)
--   2. sql/schema-classes.sql  (тут появились family_links и can_view_student())
--   3. sql/schema-parent.sql   ← этот файл
--
-- Выполнять можно повторно: всё через "drop policy if exists" перед
-- каждым "create policy", дублей не создаст.
--
-- Зачем отдельный файл, а не правка schema.sql на месте: политики
-- hw_read_own и sub_read объявлены в schema.sql, который уже применён
-- на живой базе — до того, как в schema-classes.sql появилась функция
-- can_view_student(). Тогда её просто не существовало, поэтому парой
-- политик родитель пройти не мог, что бы ни было в family_links.
-- Правим политику, а не таблицу: она просто объявляется заново поверх
-- старой версии (drop policy + create policy), данные не трогаются.
-- =====================================================================

-- ---------- homework: родитель тоже видит, что задано ----------
drop policy if exists hw_read_own on homework;
create policy hw_read_own on homework for select
  using (auth.uid() = teacher_id or can_view_student(student_id));

-- ---------- submissions: родитель видит, что сдано и с каким результатом ----------
drop policy if exists sub_read on submissions;
create policy sub_read on submissions for select
  using (
    can_view_student(student_id)
    or auth.uid() in (select teacher_id from homework where homework.id = submissions.homework_id)
  );
