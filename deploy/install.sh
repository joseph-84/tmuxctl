#!/usr/bin/env bash
# One-time host setup for tmuxctl. Run as the *normal* user account that will
# own the tmuxctl process (NOT as root) — it uses `sudo` itself for the
# handful of steps that need root, and asks for your password interactively.
#
#   cd /path/to/tmuxmgmt
#   ./deploy/install.sh
set -euo pipefail

if [[ "$(id -u)" -eq 0 ]]; then
  echo "run this as your normal login user, not root (it calls sudo itself where needed)" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ME="$(id -un)"

# GID 0's group is named "root" on Linux but "wheel" on macOS/BSD — there is
# no group literally named "root" there, so `-g root` fails with
# "install: unknown group root".
ROOT_GROUP="root"
[[ "$(uname -s)" == "Linux" ]] || ROOT_GROUP="wheel"

echo "==> installing sudo-whitelisted user-admin wrapper"
# /usr/local/sbin doesn't exist by default on Apple Silicon Macs (Homebrew
# lives under /opt/homebrew instead), so `install` fails with a cryptic
# "No such file or directory" on its temp file — make sure the dir exists.
sudo mkdir -p /usr/local/sbin
sudo install -o root -g "$ROOT_GROUP" -m 0755 "$ROOT/deploy/tmuxctl-useradmin" /usr/local/sbin/tmuxctl-useradmin

echo "==> installing sudoers rule for $ME"
sed "s/__TMUXCTL_USER__/$ME/" "$ROOT/deploy/sudoers.d-tmuxctl" | sudo tee /etc/sudoers.d/tmuxctl >/dev/null
sudo chmod 0440 /etc/sudoers.d/tmuxctl
sudo visudo -cf /etc/sudoers.d/tmuxctl

if [[ "$(uname -s)" == "Linux" ]]; then
  echo "==> installing PAM service file (Linux)"
  sudo install -o root -g "$ROOT_GROUP" -m 0644 "$ROOT/deploy/pam.d-tmuxctl" /etc/pam.d/tmuxctl
else
  # SIP blocks creating new files under /etc/pam.d/ on macOS, even as root
  # (Apple locked this down after PAM-module password-capture malware) — so
  # there's no dedicated /etc/pam.d/tmuxctl there. server/config.js defaults
  # PAM_SERVICE to macOS's built-in "login" service instead, which already
  # authenticates via pam_opendirectory.so. Nothing to install here.
  echo "==> macOS: reusing the built-in \"login\" PAM service (SIP blocks new /etc/pam.d/ files) — nothing to install"
fi

if [[ "$(uname -s)" == "Linux" ]]; then
  echo "==> installing systemd --user unit"
  mkdir -p "$HOME/.config/systemd/user"
  sed "s#__TMUXCTL_ROOT__#$ROOT#" "$ROOT/deploy/tmuxctl.service" > "$HOME/.config/systemd/user/tmuxctl.service"
  systemctl --user daemon-reload
  echo "    to enable + start:  systemctl --user enable --now tmuxctl.service"
  echo "    to survive logout:  loginctl enable-linger $ME"
else
  echo "==> installing launchd daemon"
  # A LaunchAgent (~/Library/LaunchAgents) only reliably runs while $ME has
  # an actual GUI session logged in — on a Mac reached only over SSH, that
  # may never be true after a reboot. A LaunchDaemon starts at boot
  # regardless of login state, which is what "survives SSH disconnects and
  # reboots" needs; UserName in the plist still makes it run as $ME, not root.
  NODE_BIN="$(command -v node)"
  mkdir -p "$ROOT/data"
  sed -e "s#__TMUXCTL_ROOT__#$ROOT#g" -e "s#__NODE_BIN__#$NODE_BIN#g" -e "s#__TMUXCTL_USER__#$ME#g" \
    "$ROOT/deploy/com.tmuxctl.app.plist" | sudo tee /Library/LaunchDaemons/com.tmuxctl.app.plist >/dev/null
  sudo chown root:"$ROOT_GROUP" /Library/LaunchDaemons/com.tmuxctl.app.plist
  sudo chmod 0644 /Library/LaunchDaemons/com.tmuxctl.app.plist
  echo "    to enable + start:  sudo launchctl load -w /Library/LaunchDaemons/com.tmuxctl.app.plist"
  echo "    logs:               $ROOT/data/tmuxctl.log"
  echo "    (로그인 상태와 무관하게 부팅 시 자동 시작 — SSH 연결이 끊겨도 계속 돕니다)"
fi

echo "==> done"
