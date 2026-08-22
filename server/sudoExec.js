"use strict";
const { execFile } = require("child_process");
const config = require("./config");

// Every privileged operation goes through this one root-owned wrapper script
// (see deploy/tmuxctl-useradmin) instead of calling useradd/userdel/passwd
// directly. sudoers grants NOPASSWD for this exact path only, so the blast
// radius of a bug here is whatever the wrapper script itself allows — not
// arbitrary root command execution.
function runUseradmin(args) {
  return new Promise((resolve, reject) => {
    execFile("sudo", ["-n", config.USERADMIN_WRAPPER, ...args], { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr;
        return reject(err);
      }
      resolve(stdout.trim());
    });
  });
}

module.exports = { runUseradmin };
