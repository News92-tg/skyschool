#!/usr/bin/env bash
# =====================================================================
# Прогон тестов правил доступа (RLS) на временном локальном PostgreSQL.
#
# Зачем не «supabase start»: тому нужен Docker и несколько минут на
# первый запуск. Здесь поднимается голый PostgreSQL во временной папке,
# в него кладётся заглушка Supabase (sql/tests/00-supabase-stub.sql),
# схема проекта и тесты. Занимает секунды и ничего не оставляет после
# себя. Если Supabase CLI у вас уже стоит — путь через него описан
# в README, результат тот же.
#
# Запуск:  bash scripts/test-rls.sh
# Нужен:   PostgreSQL 14+ (пакет postgresql, команда initdb/pg_ctl)
# =====================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGDATA_DIR="$(mktemp -d /tmp/skyschool-pg.XXXXXX)"
PGPORT="${PGPORT:-55433}"
SOCKET_DIR="$PGDATA_DIR/sock"
DB="skyschool_rls_test"

# initdb и postgres отказываются работать из-под root. Если скрипт
# запущен от root, переключаемся на системного пользователя postgres.
RUNNER=""
if [ "$(id -u)" = "0" ]; then
  if id postgres >/dev/null 2>&1; then
    RUNNER="postgres"
    chown -R postgres "$PGDATA_DIR"
  else
    echo "Запущено от root, а пользователя postgres нет." >&2
    echo "Запустите скрипт от обычного пользователя." >&2
    exit 1
  fi
fi

# ищем initdb/pg_ctl: в PATH их часто нет, лежат в /usr/lib/postgresql/<версия>/bin
PGBIN=""
for candidate in $(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -rV) /usr/local/pgsql/bin ""; do
  if [ -x "${candidate}/initdb" ]; then PGBIN="${candidate}/"; break; fi
done
if [ -z "$PGBIN" ] && ! command -v initdb >/dev/null 2>&1; then
  echo "Не нашёл initdb. Установите PostgreSQL:" >&2
  echo "  Ubuntu/Debian:  sudo apt install postgresql" >&2
  echo "  macOS (brew):   brew install postgresql@16" >&2
  exit 1
fi

run() { if [ -n "$RUNNER" ]; then su "$RUNNER" -c "$1"; else bash -c "$1"; fi }

cleanup() {
  run "${PGBIN}pg_ctl -D '$PGDATA_DIR/data' stop -m immediate" >/dev/null 2>&1 || true
  rm -rf "$PGDATA_DIR"
}
trap cleanup EXIT

mkdir -p "$SOCKET_DIR"
[ -n "$RUNNER" ] && chown -R postgres "$PGDATA_DIR"

echo "→ поднимаю временный PostgreSQL (порт $PGPORT)…"
run "${PGBIN}initdb -D '$PGDATA_DIR/data' -A trust -U postgres" >/dev/null 2>&1
run "${PGBIN}pg_ctl -D '$PGDATA_DIR/data' -o '-p $PGPORT -k $SOCKET_DIR' -l '$PGDATA_DIR/pg.log' start" >/dev/null

PSQL="psql -h $SOCKET_DIR -p $PGPORT -U postgres -v ON_ERROR_STOP=1 -q"
run "$PSQL -c 'create database $DB'" >/dev/null

echo "→ заглушка Supabase…"
run "$PSQL -d $DB -f '$ROOT/sql/tests/00-supabase-stub.sql'" >/dev/null

echo "→ основная схема…"
run "$PSQL -d $DB -f '$ROOT/sql/schema.sql'" >/dev/null

echo "→ классы, тетрадь, статистика, фото…"
run "$PSQL -d $DB -f '$ROOT/sql/schema-classes.sql'" >/dev/null

echo "→ AI-учителя, отзывы, шахматные партии…"
run "$PSQL -d $DB -f '$ROOT/sql/schema-ai-teachers.sql'" >/dev/null

echo "→ подборки заданий по ссылке (дважды — файл должен переживать повторный запуск)…"
run "$PSQL -d $DB -f '$ROOT/sql/schema-collections.sql'" >/dev/null
run "$PSQL -d $DB -f '$ROOT/sql/schema-collections.sql'" >/dev/null

# права на таблицы, созданные после заглушки
run "$PSQL -d $DB -c 'grant select, insert, update, delete on all tables in schema public to authenticated'" >/dev/null

echo "→ тесты:"
echo
if run "psql -h $SOCKET_DIR -p $PGPORT -U postgres -d $DB -q -f '$ROOT/sql/tests/rls-tests.sql'"; then
  echo
  echo "Готово: правила доступа работают как задумано."
else
  echo
  echo "ТЕСТЫ НЕ ПРОШЛИ — смотрите таблицу выше." >&2
  exit 1
fi
echo
echo "→ тесты подборок:"
echo
if run "psql -h $SOCKET_DIR -p $PGPORT -U postgres -d $DB -q -f '$ROOT/sql/tests/collections-tests.sql'"; then
  echo
  echo "Готово: подборки работают как задумано."
else
  echo
  echo "ТЕСТЫ ПОДБОРОК НЕ ПРОШЛИ — смотрите таблицу выше." >&2
  exit 1
fi

# Тарифы — на отдельной базе. На живой базе photo_checks устроена как в
# schema-photo-limits.sql (user_id), а schema-classes.sql выше создаёт
# другую (student_id); в одной базе обе не уживутся.
TDB="skyschool_tariffs_test"
run "$PSQL -c 'create database $TDB'" >/dev/null
echo
echo "→ тарифы: заглушка, лимиты фото, тарифы (дважды — файл должен переживать повторный запуск)…"
run "$PSQL -d $TDB -f '$ROOT/sql/tests/00-supabase-stub.sql'" >/dev/null
run "$PSQL -d $TDB -f '$ROOT/sql/schema.sql'" >/dev/null           # profiles и др., как в живой базе
run "$PSQL -d $TDB -f '$ROOT/sql/schema-photo-limits.sql'" >/dev/null
run "$PSQL -d $TDB -f '$ROOT/sql/schema-tariffs.sql'" >/dev/null
run "$PSQL -d $TDB -f '$ROOT/sql/schema-tariffs.sql'" >/dev/null
echo "→ проверка текстом и админка (тоже дважды)…"
for f in schema-text-check.sql schema-admin.sql schema-text-check.sql schema-admin.sql; do
  run "$PSQL -d $TDB -f '$ROOT/sql/$f'" >/dev/null
done
echo "→ админка: журнал, подписки, Telegram (дважды; прежние тесты админки идут уже поверх неё)…"
for f in schema-admin-automation.sql schema-admin-automation.sql; do
  run "$PSQL -d $TDB -f '$ROOT/sql/$f'" >/dev/null
done
echo "→ критерии оценивания (дважды)…"
for f in schema-criteria.sql schema-criteria.sql; do
  run "$PSQL -d $TDB -f '$ROOT/sql/$f'" >/dev/null
done
echo "→ подборки и инструменты учителя (дважды): профиль, онбординг, Telegram, аналитика…"
for f in schema-collections.sql schema-teacher-tools.sql schema-collections.sql schema-teacher-tools.sql; do
  run "$PSQL -d $TDB -f '$ROOT/sql/$f'" >/dev/null
done
echo "→ задания учителя: домашка по фото и «Мои задания» (дважды)…"
run "$PSQL -d $TDB -f '$ROOT/sql/tests/01-storage-stub.sql'" >/dev/null
for f in schema-homework.sql schema-teacher-tasks.sql schema-homework.sql schema-teacher-tasks.sql; do
  run "$PSQL -d $TDB -f '$ROOT/sql/$f'" >/dev/null
done
echo "→ «распознано неверно» в истории фото (дважды)…"
for f in schema-photo-flag.sql schema-photo-flag.sql; do
  run "$PSQL -d $TDB -f '$ROOT/sql/$f'" >/dev/null
done
echo "→ тесты тарифов:"
echo
if run "psql -h $SOCKET_DIR -p $PGPORT -U postgres -d $TDB -q -f '$ROOT/sql/tests/tariffs-tests.sql'"; then
  echo
  echo "Готово: тарифы и лимиты работают как задумано."
else
  echo
  echo "ТЕСТЫ ТАРИФОВ НЕ ПРОШЛИ — смотрите таблицу выше." >&2
  exit 1
fi
echo
echo "→ тесты проверки текстом и админки:"
echo
if run "psql -h $SOCKET_DIR -p $PGPORT -U postgres -d $TDB -q -f '$ROOT/sql/tests/text-admin-tests.sql'"; then
  echo
  echo "Готово: проверка текстом и админка работают как задумано."
else
  echo
  echo "ТЕСТЫ ТЕКСТА И АДМИНКИ НЕ ПРОШЛИ — смотрите таблицу выше." >&2
  exit 1
fi
echo
echo "→ тесты критериев оценивания:"
echo
if run "psql -h $SOCKET_DIR -p $PGPORT -U postgres -d $TDB -q -f '$ROOT/sql/tests/criteria-tests.sql'"; then
  echo
  echo "Готово: критерии оценивания пишутся как задумано."
else
  echo
  echo "ТЕСТЫ КРИТЕРИЕВ НЕ ПРОШЛИ — смотрите таблицу выше." >&2
  exit 1
fi
echo
echo "→ тесты админки (журнал, оплаты, подписки, Telegram):"
echo
if run "psql -h $SOCKET_DIR -p $PGPORT -U postgres -d $TDB -q -f '$ROOT/sql/tests/admin-automation-tests.sql'"; then
  echo
  echo "Готово: админка работает как задумано."
else
  echo
  echo "ТЕСТЫ АДМИНКИ НЕ ПРОШЛИ — смотрите таблицу выше." >&2
  exit 1
fi
echo
echo "→ тесты своих заданий учителя (teacher_tasks):"
echo
if run "psql -h $SOCKET_DIR -p $PGPORT -U postgres -d $TDB -q -f '$ROOT/sql/tests/teacher-tasks-tests.sql'"; then
  echo
  echo "Готово: свои задания учителя работают как задумано."
else
  echo
  echo "ТЕСТЫ СВОИХ ЗАДАНИЙ НЕ ПРОШЛИ — смотрите таблицу выше." >&2
  exit 1
fi
echo
echo "→ тесты инструментов учителя (онбординг, профиль, Telegram, работы, аналитика):"
echo
if run "psql -h $SOCKET_DIR -p $PGPORT -U postgres -d $TDB -q -f '$ROOT/sql/tests/teacher-tools-tests.sql'"; then
  echo
  echo "Готово: инструменты учителя работают как задумано."
else
  echo
  echo "ТЕСТЫ ИНСТРУМЕНТОВ УЧИТЕЛЯ НЕ ПРОШЛИ — смотрите таблицу выше." >&2
  exit 1
fi
echo
echo "→ тесты флага «распознано неверно» (photo_checks):"
echo
if run "psql -h $SOCKET_DIR -p $PGPORT -U postgres -d $TDB -q -f '$ROOT/sql/tests/photo-flag-tests.sql'"; then
  echo
  echo "Готово: флаг распознавания работает как задумано."
else
  echo
  echo "ТЕСТЫ ФЛАГА РАСПОЗНАВАНИЯ НЕ ПРОШЛИ — смотрите таблицу выше." >&2
  exit 1
fi
