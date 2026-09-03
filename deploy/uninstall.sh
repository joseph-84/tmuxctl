#!/usr/bin/env bash
# Reverses everything deploy/install.sh (and the host-setup step inside
# deploy/bootstrap.sh) did: stops/disables the systemd --user service, and
# removes the sudoers rule, the useradmin wrapper, and the PAM service file.
# Run as the same normal user that ran install.sh/bootstrap.sh (NOT root) —
# it calls sudo itself where needed.
#
#   cd /path/to/tmuxmgmt
#   ./deploy/uninstall.sh
#
# What this does NOT do (on purpose):
#   - Does not remove node/npm/tmux/build-essential/etc. — bootstrap.sh may
#     have installed these via apt, but they're shared system packages other
#     things could depend on; uninstall them yourself if you're sure.
#   - Does not delete node_modules/, web/dist/, or the repo checkout itself —
#     just `rm -rf` the directory once this script is done, if you want it gone.
#   - Does not delete data/ (sessions/roles/settings) unless you opt in below.
set -euo pipefail

if [[ "$(id -u)" -eq 0 ]]; then
  echo "run this as your normal login user, not root (it calls sudo itself where needed)" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ME="$(id -un)"

# ---- 1. systemd --user service (Linux) / launchd daemon (macOS) ----------
UNIT="$HOME/.config/systemd/user/tmuxctl.service"
DAEMON_PLIST="/Library/LaunchDaemons/com.tmuxctl.app.plist"
if [[ "$(uname -s)" == "Linux" ]] && command -v systemctl >/dev/null; then
  if systemctl --user list-unit-files tmuxctl.service >/dev/null 2>&1 \
     && systemctl --user list-unit-files tmuxctl.service | grep -q tmuxctl.service; then
    echo "==> stopping + disabling tmuxctl.service"
    systemctl --user disable --now tmuxctl.service 2>/dev/null || true
  fi
  if [[ -f "$UNIT" ]]; then
    rm -f "$UNIT"
    systemctl --user daemon-reload
    echo "==> removed $UNIT"
  fi
elif [[ "$(uname -s)" != "Linux" ]] && [[ -f "$DAEMON_PLIST" ]]; then
  echo "==> stopping + removing launchd daemon"
  sudo launchctl unload -w "$DAEMON_PLIST" 2>/dev/null || true
  sudo rm -f "$DAEMON_PLIST"
else
  echo "==> no service installed — nothing to do there"
fi

# loginctl linger affects the whole account, not just tmuxctl — only turn it
# off if the user explicitly confirms no other --user service on this account
# still needs it.
if command -v loginctl >/dev/null && loginctl show-user "$ME" -p Linger 2>/dev/null | grep -q "yes"; then
  answer="n"
  if [[ -t 0 ]]; then
    read -r -p "==> 로그인 세션 유지(linger)가 켜져 있습니다. 다른 --user 서비스가 없다면 끌까요? [y/N] " answer
  fi
  if [[ "$answer" =~ ^[Yy]$ ]]; then
    loginctl disable-linger "$ME" || true
    echo "==> linger 비활성화 완료"
  else
    echo "==> linger는 그대로 두었습니다"
  fi
fi

# ---- 2. sudoers rule ------------------------------------------------------
if [[ -f /etc/sudoers.d/tmuxctl ]]; then
  echo "==> removing /etc/sudoers.d/tmuxctl"
  sudo rm -f /etc/sudoers.d/tmuxctl
fi

# ---- 3. useradmin wrapper --------------------------------------------------
if [[ -f /usr/local/sbin/tmuxctl-useradmin ]]; then
  echo "==> removing /usr/local/sbin/tmuxctl-useradmin"
  sudo rm -f /usr/local/sbin/tmuxctl-useradmin
fi

# ---- 4. PAM service file ---------------------------------------------------
if [[ -f /etc/pam.d/tmuxctl ]]; then
  echo "==> removing /etc/pam.d/tmuxctl"
  sudo rm -f /etc/pam.d/tmuxctl
fi

# ---- 5. app data (sessions metadata, roles, settings) ---------------------
DATA_DIR="${TMUXCTL_DATA_DIR:-$ROOT/data}"
if [[ -d "$DATA_DIR" ]]; then
  answer="n"
  if [[ -t 0 ]]; then
    read -r -p "==> 앱 데이터 디렉터리($DATA_DIR)도 삭제할까요? (역할/설정 기록이 사라집니다) [y/N] " answer
  fi
  if [[ "$answer" =~ ^[Yy]$ ]]; then
    rm -rf "$DATA_DIR"
    echo "==> $DATA_DIR 삭제 완료"
  else
    echo "==> $DATA_DIR 는 그대로 두었습니다"
  fi
fi

echo "==> done. 아직 남아있는 것: node/npm/tmux 등 apt로 설치된 시스템 패키지, node_modules/, web/dist/, 저장소 자체."
echo "    저장소까지 지우려면: rm -rf $ROOT"
