#!/usr/bin/env bash
# Redeploy the todo site from the terminal — no chat needed.
#
#   ./redeploy.sh          full redeploy (frontend + server.ts) — safest, ~6s blip
#   ./redeploy.sh --fast   frontend only, zero downtime (skips restart)
#
# Live URL: https://todo-jlong.zocomputer.io/todo
set -euo pipefail

DIR="/home/workspace/personal-os/02-projects/todo-app/todo"
PORT=57863
cd "$DIR"

echo "▶ Building production bundle…"
bun run build

if [ "${1:-}" = "--fast" ]; then
  # server.ts serves ./dist per request, so a rebuilt bundle is already live.
  echo "✅ Frontend redeployed (no restart): https://todo-jlong.zocomputer.io/todo"
  exit 0
fi

echo "▶ Restarting service (picks up server.ts / API changes)…"
# The supervisor auto-reruns `bun run prod` (rebuild + serve) after the kill.
pkill -f "bun run prod" || true

echo "▶ Waiting for the site to come back…"
for i in $(seq 1 40); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${PORT}/todo")" = "200" ]; then
    echo "✅ Live: https://todo-jlong.zocomputer.io/todo"
    exit 0
  fi
  sleep 1
done

echo "⚠ Didn't get HTTP 200 within 40s. Check logs:  tail -n 40 /dev/shm/todo.log /dev/shm/todo_err.log"
exit 1
