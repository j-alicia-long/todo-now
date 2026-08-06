#!/usr/bin/env bash
# deploy-zo.sh — deploy the todo site to Zo from this (local) machine.
#
# Repurposed from ai-carbon-footprint's scripts/deploy-zo.sh, but this app
# doesn't need per-file uploads: the personal-os tree is Mutagen-synced to
# Zo, so local edits arrive there automatically. This script just
#   1. verifies the sync has caught up (writes a nonce file locally and
#      waits until it appears on Zo), then
#   2. runs the existing ./redeploy.sh on Zo via the Zo MCP bash tool.
#
#   ./scripts/deploy-zo.sh          full redeploy (frontend + server.ts), ~6s blip
#   ./scripts/deploy-zo.sh --fast   frontend only, zero downtime
#
# Requires: mcporter (npm i -g mcporter) and a Zo API token.
#   ZO_TOKEN_FILE  path to token file (default: ~/.config/ai-cost-tracker/zo_token)
#
# Live URL: https://todo-jlong.zocomputer.io/todo
set -euo pipefail

REMOTE_DIR="/home/workspace/personal-os/02-projects/todo-app/todo"
MCP_URL="https://api.zo.computer/mcp"
TOKEN_FILE="${ZO_TOKEN_FILE:-$HOME/.config/ai-cost-tracker/zo_token}"
TOKEN="$(cat "$TOKEN_FILE")"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAST_FLAG="${1:-}"

zo_bash() {
  # Run a command on Zo via the MCP bash tool; print its stdout.
  node -e '
    const args = { cmd: process.argv[1], description: "todo deploy" };
    process.stdout.write(JSON.stringify(args));
  ' "$1" >/tmp/zo-deploy-args.json
  mcporter call "$MCP_URL.bash" \
    --header "Authorization=Bearer $TOKEN" \
    --args "$(cat /tmp/zo-deploy-args.json)"
}

echo "▶ Waiting for file sync to catch up…"
NONCE="deploy-$(date +%s)-$$"
echo "$NONCE" >"$ROOT/.deploy-nonce"
trap 'rm -f "$ROOT/.deploy-nonce" /tmp/zo-deploy-args.json' EXIT

synced=""
for i in $(seq 1 30); do
  if zo_bash "cat '$REMOTE_DIR/.deploy-nonce' 2>/dev/null" | grep -q "$NONCE"; then
    synced=1
    break
  fi
  sleep 2
done
if [ -z "$synced" ]; then
  echo "⚠ Sync didn't catch up within 60s — is the Mutagen session healthy?"
  exit 1
fi
echo "  synced ✓"

echo "▶ Running redeploy.sh${FAST_FLAG:+ $FAST_FLAG} on Zo…"
zo_bash "cd '$REMOTE_DIR' && ./redeploy.sh $FAST_FLAG"

echo "✔ Deployed: https://todo-jlong.zocomputer.io/todo"
