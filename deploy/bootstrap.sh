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

# ---- 1. prerequisites (README '요구 사항') ------------------------------
ensure_prereqs_linux() {
  local missing_bins=() apt_pkgs=()

  command -v node >/dev/null || { missing_bins+=(node); apt_pkgs+=(nodejs); }
  command -v npm >/dev/null || { missing_bins+=(npm); apt_pkgs+=(npm); }
  command -v tmux >/dev/null || { missing_bins+=(tmux); apt_pkgs+=(tmux); }
  command -v gcc >/dev/null || { missing_bins+=(gcc); apt_pkgs+=(build-essential); }
  command -v python3 >/dev/null || { missing_bins+=(python3); apt_pkgs+=(python3); }
  [[ -f /usr/include/security/pam_appl.h ]] || { missing_bins+=(libpam0g-dev); apt_pkgs+=(libpam0g-dev); }

  if [[ ${#missing_bins[@]} -eq 0 ]]; then
    echo "==> prerequisites already installed (node, npm, tmux, gcc, python3, libpam0g-dev)"
    return
  fi

  echo "==> missing: ${missing_bins[*]}"
  if ! command -v apt-get >/dev/null; then
    echo "no apt-get on this system — install manually: ${missing_bins[*]} (see README '요구 사항')" >&2
    exit 1
  fi

  # dedupe (build-essential/nodejs/npm can repeat if multiple bins map to one pkg)
  local uniq_pkgs
  uniq_pkgs=$(printf '%s\n' "${apt_pkgs[@]}" | sort -u | tr '\n' ' ')
  echo "==> installing via apt: $uniq_pkgs (sudo password may be prompted)"
  sudo apt-get update
  # shellcheck disable=SC2086
  sudo apt-get install -y $uniq_pkgs
}

ensure_prereqs_macos() {
  if ! xcode-select -p >/dev/null 2>&1; then
    echo "Xcode Command Line Tools not found. Run 'xcode-select --install', finish the GUI prompt, then re-run this script." >&2
    exit 1
  fi
  if ! command -v tmux >/dev/null; then
    if command -v brew >/dev/null; then
      echo "==> installing tmux via brew"
      brew install tmux
    else
      echo "tmux not found and Homebrew isn't installed — install tmux manually (see README '요구 사항')" >&2
      exit 1
    fi
  fi
  command -v node >/dev/null || { echo "node not found — install Node.js 18+ (see README '요구 사항')" >&2; exit 1; }
  command -v npm >/dev/null || { echo "npm not found (node is installed without npm?) — install Node.js 18+ from nodejs.org, it bundles npm" >&2; exit 1; }
  echo "==> prerequisites OK (Xcode CLT, tmux, node, npm)"
}

case "$(uname -s)" in
  Linux) ensure_prereqs_linux ;;
  Darwin) ensure_prereqs_macos ;;
  *) echo "unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac

echo "==> node $(node -v), npm $(npm -v), tmux $(tmux -V)"

# ---- 2. build ------------------------------------------------------------
echo "==> installing backend dependencies (compiles node-pty, authenticate-pam)"
npm install --omit=dev

echo "==> building frontend"
npm run setup:web
npm run build:web

# ---- 3. host setup (sudoers wrapper, PAM service, systemd unit) ---------
echo "==> host setup (sudoers wrapper, PAM service, systemd unit)"
"$ROOT/deploy/install.sh"

# ---- 4. optionally enable as a startup service --------------------------
if [[ "$(uname -s)" == "Linux" ]]; then
  answer="n"
  if [[ -t 0 ]]; then
    read -r -p "==> 로그인 시 자동 시작되는 시작 프로그램(systemd --user)으로 등록할까요? [y/N] " answer
  fi
  if [[ "$answer" =~ ^[Yy]$ ]]; then
    systemctl --user daemon-reload
    systemctl --user enable --now tmuxctl.service
    loginctl enable-linger "$(id -un)" || true
    echo "==> 등록 완료 — systemctl --user status tmuxctl.service"
  else
    systemctl --user daemon-reload
    echo "==> 시작 프로그램에 등록하지 않았습니다. 지금 한 번만 실행하려면:"
    echo "      systemctl --user start tmuxctl.service"
    echo "    나중에 자동 시작을 켜려면:"
    echo "      systemctl --user enable --now tmuxctl.service && loginctl enable-linger \$(id -un)"
  fi
else
  answer="n"
  if [[ -t 0 ]]; then
    read -r -p "==> 로그인 상태와 무관하게 부팅 시 자동 시작되는 시작 프로그램(launchd)으로 등록할까요? [y/N] " answer
  fi
  if [[ "$answer" =~ ^[Yy]$ ]]; then
    sudo launchctl load -w /Library/LaunchDaemons/com.tmuxctl.app.plist
    echo "==> 등록 완료 — 로그: $ROOT/data/tmuxctl.log"
    echo "    http://localhost:4390"
  else
    echo "==> 시작 프로그램에 등록하지 않았습니다. 지금 한 번만 실행하려면:"
    echo "      cd $ROOT && npm start"
    echo "    나중에 자동 시작을 켜려면:"
    echo "      sudo launchctl load -w /Library/LaunchDaemons/com.tmuxctl.app.plist"
  fi
fi

echo "==> done"
