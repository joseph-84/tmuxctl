"use strict";
const fs = require("fs");
const { execFileSync } = require("child_process");

const USERNAME_RE = /^[a-z_][a-z0-9_-]{0,31}$/;

function assertUsername(name) {
  if (!USERNAME_RE.test(name)) {
    const e = new Error("invalid username: " + name);
    e.status = 400;
    throw e;
  }
}

// Parses /etc/passwd directly rather than shelling out to getent, so this
// works the same on a minimal container without nsswitch/getent configured.
function readPasswd() {
  const raw = fs.readFileSync("/etc/passwd", "utf8");
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [name, , uid, gid, gecos, home, shell] = line.split(":");
      return { name, uid: parseInt(uid, 10), gid: parseInt(gid, 10), gecos, home, shell };
    });
}

function getUser(username) {
  return readPasswd().find((u) => u.name === username) || null;
}

function listHumanUsers(minUid) {
  return readPasswd().filter((u) => u.uid >= minUid && u.uid < 65534);
}

function groupsOf(username) {
  try {
    const out = execFileSync("id", ["-nG", username], { encoding: "utf8" });
    return out.trim().split(/\s+/);
  } catch {
    return [];
  }
}

module.exports = { assertUsername, USERNAME_RE, readPasswd, getUser, listHumanUsers, groupsOf };
