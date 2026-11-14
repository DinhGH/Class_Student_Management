#!/bin/sh
set -e

echo "[$SERVER_NAME] Waiting for PostgreSQL master and pushing Prisma schema..."
attempt=1
max_attempts=15
until npx prisma db push --skip-generate; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "[$SERVER_NAME] Failed to push Prisma schema after $max_attempts attempts."
    exit 1
  fi
  echo "[$SERVER_NAME] Attempt $attempt/$max_attempts failed, retrying in 2s..."
  attempt=$((attempt + 1))
  sleep 2
done

echo "[$SERVER_NAME] Starting Express server..."
exec node index.js
