#!/usr/bin/env bash
# One-shot production deploy on a fresh target machine. Run this ON the
# server that will actually host tmuxctl (Linux or macOS) — native modules
# (node-pty, authenticate-pam) are compiled here, so a tarball built on one
# machine/arch cannot just be copied to another; this script is what you run
# on each target instead.
#
#   cd /path/to/tmuxmgmt
#   ./deploy/bootstrap.sh
#
# Idempotent: safe to re-run after a `git pull` to redeploy an update.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "run this as the normal user that should own the tmuxctl process, not root" >&2
  exit 1
fi

command -v node >/dev/null || { echo "node not found — see README '요구 사항'" >&2; exit 1; }
command -v tmux >/dev/null || { echo "tmux not found — see README '요구 사항'" >&2; exit 1; }

echo "==> node $(node -v), tmux $(tmux -V)"

echo "==> installing backend dependencies (compiles node-pty, authenticate-pam)"
npm install --omit=dev

echo "==> building frontend"
npm run setup:web
npm run build:web

echo "==> host setup (sudoers wrapper, PAM service, systemd unit)"
"$ROOT/deploy/install.sh"

echo "==> enabling service"
systemctl --user daemon-reload
systemctl --user enable --now tmuxctl.service
loginctl enable-linger "$(id -un)" || true

echo "==> done — systemctl --user status tmuxctl.service"
