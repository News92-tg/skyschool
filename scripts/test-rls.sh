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
