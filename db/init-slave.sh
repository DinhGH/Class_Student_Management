#!/bin/sh
set -e

MASTER_HOST="${DB_MASTER_HOST:-db-master}"
MASTER_PORT="${DB_MASTER_PORT:-5432}"
REPL_USER="${POSTGRES_REPLICATION_USER:-replicator}"
REPL_PASS="${POSTGRES_REPLICATION_PASSWORD:-replicator_pass}"
PG_USER="${POSTGRES_USER:-postgres}"

echo "[db-slave] Waiting for master ($MASTER_HOST:$MASTER_PORT)..."
until pg_isready -h "$MASTER_HOST" -p "$MASTER_PORT" -U "$PG_USER"; do
  sleep 2
done

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[db-slave] PGDATA is empty. Running pg_basebackup from $MASTER_HOST..."
  rm -rf "$PGDATA"/*

  attempt=1
  max_attempts=15
  until PGPASSWORD="$REPL_PASS" pg_basebackup -h "$MASTER_HOST" -p "$MASTER_PORT" -U "$REPL_USER" -D "$PGDATA" -Fp -Xs -P -R; do
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "[db-slave] pg_basebackup failed after $max_attempts attempts."
      exit 1
    fi
    echo "[db-slave] pg_basebackup attempt $attempt/$max_attempts failed, retrying in 2s..."
    attempt=$((attempt + 1))
    sleep 2
  done

  chown -R postgres:postgres "$PGDATA"
  chmod 0700 "$PGDATA"
  echo "[db-slave] Base backup completed successfully."
else
  echo "[db-slave] Existing PGDATA found, starting standby..."
fi

exec su-exec postgres postgres -c hot_standby=on
