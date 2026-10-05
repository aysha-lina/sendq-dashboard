#!/usr/bin/env bash
#
# SendQ one-command deploy (run from the repo root on the DEV machine).
#
#   ./deploy.sh frontend   build the SPA locally + publish it to the server
#   ./deploy.sh backend    push backend source + restart the API
#   ./deploy.sh all        backend, then frontend
#
# Golden rule: the frontend is built HERE and only the finished files are copied
# to the server. We never build on the 2GB box (vite OOM-wedges it).
#
# Override host/key/paths via env vars if they ever change:
#   SENDQ_HOST=192.168.90.103  SENDQ_KEY=~/.ssh/sendq_deploy  ./deploy.sh all
#
set -euo pipefail

HOST="${SENDQ_HOST:-192.168.90.103}"
KEY="${SENDQ_KEY:-$HOME/.ssh/sendq_deploy}"
USER_AT="root@${HOST}"
REMOTE_BACKEND="/root/backend"
REMOTE_STAGING="/root/dist-staging"
SSH="ssh -i $KEY -o BatchMode=yes -o ConnectTimeout=20"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

push_backend() {
  say "Backend: syncing source to ${USER_AT}:${REMOTE_BACKEND}"
  # tar-over-ssh avoids scp's "nested directory" footgun and skips node_modules.
  tar czf - -C "$ROOT/backend" src prisma package.json \
    | $SSH "$USER_AT" "tar xzf - --no-same-owner -C $REMOTE_BACKEND"
  say "Backend: install + prisma generate + restart (via redeploy.sh)"
  $SSH "$USER_AT" '~/redeploy.sh backend'
}

build_frontend() {
  say "Frontend: building locally"
  ( cd "$ROOT/frontend" && npm run build )
  [ -f "$ROOT/frontend/dist/index.html" ] || die "build produced no dist/index.html"
}

push_frontend() {
  build_frontend
  say "Frontend: uploading dist -> ${USER_AT}:${REMOTE_STAGING}"
  $SSH "$USER_AT" "rm -rf $REMOTE_STAGING && mkdir -p $REMOTE_STAGING"
  tar czf - -C "$ROOT/frontend/dist" . \
    | $SSH "$USER_AT" "tar xzf - --no-same-owner -C $REMOTE_STAGING"
  say "Frontend: publishing (via redeploy.sh)"
  $SSH "$USER_AT" '~/redeploy.sh frontend'
}

verify() {
  say "Verify"
  $SSH "$USER_AT" '
    printf "health: "; curl -s -o /dev/null -w "%{http_code}\n" http://localhost/health
    printf "root:   "; curl -s -o /dev/null -w "%{http_code}\n" http://localhost/
    printf "bundle: "; curl -s http://localhost/ | grep -o "index-[A-Za-z0-9]*\.css" | head -1
  '
}

case "${1:-}" in
  frontend) push_frontend; verify ;;
  backend)  push_backend;  verify ;;
  all)      push_backend; push_frontend; verify ;;
  *) die "usage: ./deploy.sh [frontend|backend|all]" ;;
esac

say "Done. Hard-refresh the browser (Ctrl+Shift+R) to bust the asset cache."
