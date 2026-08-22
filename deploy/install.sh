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

echo "==> installing sudo-whitelisted user-admin wrapper"
sudo install -o root -g root -m 0755 "$ROOT/deploy/tmuxctl-useradmin" /usr/local/sbin/tmuxctl-useradmin

echo "==> installing sudoers rule for $ME"
sed "s/__TMUXCTL_USER__/$ME/" "$ROOT/deploy/sudoers.d-tmuxctl" | sudo tee /etc/sudoers.d/tmuxctl >/dev/null
sudo chmod 0440 /etc/sudoers.d/tmuxctl
sudo visudo -cf /etc/sudoers.d/tmuxctl

if [[ "$(uname -s)" == "Linux" ]]; then
  echo "==> installing PAM service file (Linux)"
  sudo install -o root -g root -m 0644 "$ROOT/deploy/pam.d-tmuxctl" /etc/pam.d/tmuxctl
else
  echo "==> macOS detected — see deploy/pam.d-tmuxctl for the pam_opendirectory.so variant"
  echo "    you'll need to install it to /etc/pam.d/tmuxctl by hand (edit the auth/account lines)."
fi

echo "==> installing systemd --user unit"
mkdir -p "$HOME/.config/systemd/user"
sed "s#__TMUXCTL_ROOT__#$ROOT#" "$ROOT/deploy/tmuxctl.service" > "$HOME/.config/systemd/user/tmuxctl.service"
systemctl --user daemon-reload
echo "    to enable + start:  systemctl --user enable --now tmuxctl.service"
echo "    to survive logout:  loginctl enable-linger $ME"

echo "==> done"
