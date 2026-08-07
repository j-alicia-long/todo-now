#!/usr/bin/env bash
# deploy-zo.sh — deploy the todo site to Zo from this (local) machine.
#
# Default mode: git pull on Zo. Zo's copy is a clone of the GitHub repo, so
# deploying is "pull the pushed main, then run ./redeploy.sh there" — via the
# Zo MCP bash tool. This is the foolproof path: it doesn't depend on the
# Mutagen file sync being healthy, and it keeps Zo's checkout up to date.
# NOTE: it deploys what's on GitHub main — commit & push first.
#
# Fallback mode (--sync): the older Mutagen-sync path. Writes a nonce file
# locally, waits until the file sync delivers it to Zo, then redeploys.
# Deploys the local working tree (including uncommitted changes), but only
# works while the Mutagen session is healthy.
#
#   ./scripts/deploy-zo.sh                 git-pull deploy, full (frontend + server.ts), ~6s blip
#   ./scripts/deploy-zo.sh --fast          git-pull deploy, frontend only, zero downtime
#   ./scripts/deploy-zo.sh --sync [--fast] Mutagen-sync deploy of the local tree
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

MODE="git"
FAST_FLAG=""
for arg in "$@"; do
  case "$arg" in
    --sync) MODE="sync" ;;
    --fast) FAST_FLAG="--fast" ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

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
trap 'rm -f "$ROOT/.deploy-nonce" /tmp/zo-deploy-args.json' EXIT

if [ "$MODE" = "git" ]; then
  # Deploys GitHub main. Warn if local state isn't what will ship.
  if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
    echo "⚠ Local tree has uncommitted changes — they will NOT deploy (git mode ships pushed main)."
  fi
  if [ -n "$(git -C "$ROOT" log --oneline origin/main..main 2>/dev/null)" ]; then
    echo "⚠ Local main has unpushed commits — push first or they will NOT deploy."
  fi

  echo "▶ Pulling main + running redeploy.sh${FAST_FLAG:+ $FAST_FLAG} on Zo…"
  zo_bash "cd '$REMOTE_DIR' && git pull --ff-only origin main && ./redeploy.sh $FAST_FLAG"
else
  echo "▶ Waiting for file sync to catch up…"
  NONCE="deploy-$(date +%s)-$$"
  echo "$NONCE" >"$ROOT/.deploy-nonce"

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
    echo "  Tip: the default git mode doesn't need the sync:  ./scripts/deploy-zo.sh $FAST_FLAG"
    exit 1
  fi
  echo "  synced ✓"

  echo "▶ Running redeploy.sh${FAST_FLAG:+ $FAST_FLAG} on Zo…"
  zo_bash "cd '$REMOTE_DIR' && ./redeploy.sh $FAST_FLAG"
fi

echo "✔ Deployed: https://todo-jlong.zocomputer.io/todo"
