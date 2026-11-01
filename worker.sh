#!/usr/bin/env bash
# Starts the locked-down Claude worker session and tells it to process the queue.
# Usage: ./worker.sh            (process the queue)
#        ./worker.sh "<prompt>" (start with your own instruction instead)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/web"

# Use the Node version pinned in .nvmrc.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use >/dev/null

exec claude --settings ../.claude/worker-settings.json "${1:-process the queue}"
