#!/bin/sh
set -e

REPL_USER="${POSTGRES_REPLICATION_USER:-replicator}"
REPL_PASS="${POSTGRES_REPLICATION_PASSWORD:-replicator_pass}"

echo "[db-master] Configuring replication role '$REPL_USER' and pg_hba.conf..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$REPL_USER') THEN
            CREATE ROLE $REPL_USER WITH REPLICATION LOGIN ENCRYPTED PASSWORD '$REPL_PASS';
        END IF;
    END
    \$\$;
EOSQL

echo "host replication $REPL_USER 0.0.0.0/0 scram-sha-256" >> "$PGDATA/pg_hba.conf"
