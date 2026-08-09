#!/usr/bin/env bash
# deploy-zo.sh — deploy the todo site to Zo from this (local) machine.
#
# Zo's copy is a clone of the GitHub repo at /home/workspace/repos/todo
# (outside the Mutagen-synced personal-os tree), so deploying is "sync Zo's
# checkout to the pushed main, then run ./redeploy.sh there" — via the Zo MCP
# bash tool. Uses fetch + reset --hard (not pull): GitHub main is the source
# of truth. Unexpected local changes in the deploy clone are logged and
# auto-stashed (recoverable via `git stash list` on Zo) before the reset.
# NOTE: it deploys what's on GitHub main — commit & push first.
#
#   ./scripts/deploy-zo.sh          full deploy (frontend + server.ts), ~6s blip
#   ./scripts/deploy-zo.sh --fast   frontend only, zero downtime
#
# Requires: mcporter (npm i -g mcporter) and a Zo API token.
#   ZO_TOKEN_FILE  path to token file (default: ~/.config/ai-cost-tracker/zo_token)
#
# Live URL: https://todo-jlong.zocomputer.io/todo
set -euo pipefail

REMOTE_DIR="/home/workspace/repos/todo"
MCP_URL="https://api.zo.computer/mcp"
TOKEN_FILE="${ZO_TOKEN_FILE:-$HOME/.config/ai-cost-tracker/zo_token}"
TOKEN="$(cat "$TOKEN_FILE")"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

FAST_FLAG=""
for arg in "$@"; do
  case "$arg" in
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
trap 'rm -f /tmp/zo-deploy-args.json' EXIT

# Deploys GitHub main. Warn if local state isn't what will ship.
if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  echo "⚠ Local tree has uncommitted changes — they will NOT deploy (this ships pushed main)."
fi
if [ -n "$(git -C "$ROOT" log --oneline origin/main..main 2>/dev/null)" ]; then
  echo "⚠ Local main has unpushed commits — push first or they will NOT deploy."
fi

echo "▶ Syncing Zo checkout to origin/main + running redeploy.sh${FAST_FLAG:+ $FAST_FLAG}…"
zo_bash "cd '$REMOTE_DIR' && git status --short && git stash push --include-untracked -m pre-deploy-autostash && git fetch origin main && git reset --hard FETCH_HEAD && ./redeploy.sh $FAST_FLAG"

echo "✔ Deployed: https://todo-jlong.zocomputer.io/todo"
