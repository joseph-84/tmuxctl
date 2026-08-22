"use strict";
const path = require("path");
const os = require("os");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = process.env.TMUXCTL_DATA_DIR || path.join(ROOT, "data");

module.exports = {
  ROOT,
  DATA_DIR,
  PORT: parseInt(process.env.PORT || "4390", 10),
  SESSION_SECRET: process.env.TMUXCTL_SESSION_SECRET || "change-me-in-production-" + os.hostname(),
  PAM_SERVICE: process.env.TMUXCTL_PAM_SERVICE || "tmuxctl",
  // useradd/userdel/passwd are never called directly — only through this
  // root-owned wrapper script, installed by deploy/install.sh, and whitelisted
  // in /etc/sudoers.d/tmuxctl for exactly this path with NOPASSWD.
  USERADMIN_WRAPPER: process.env.TMUXCTL_USERADMIN_WRAPPER || "/usr/local/sbin/tmuxctl-useradmin",
  MIN_UID: parseInt(process.env.TMUXCTL_MIN_UID || "1000", 10),
  ROLES_FILE: path.join(DATA_DIR, "roles.json"),
  SETTINGS_FILE: path.join(DATA_DIR, "settings.json"),
  ACTIVITY_FILE: path.join(DATA_DIR, "activity.json"),
  WEB_DIST: path.join(ROOT, "web", "dist"),
};
