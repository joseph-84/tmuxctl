"use strict";
const { execFileSync } = require("child_process");
const config = require("./config");
const { readJson, writeJson } = require("./jsonStore");

const ADMIN_GROUPS = ["sudo", "wheel", "admin"]; // Debian/Ubuntu, RHEL, macOS

function load() {
  return readJson(config.ROLES_FILE, {});
}

function save(map) {
  writeJson(config.ROLES_FILE, map);
}

function isInLocalAdminGroup(username) {
  try {
    const out = execFileSync("id", ["-nG", username], { encoding: "utf8" });
    const groups = out.trim().split(/\s+/);
    return groups.some((g) => ADMIN_GROUPS.includes(g));
  } catch {
    return false;
  }
}

// Deny-by-default: an account with no explicit role only gets in if it is a
// local OS admin (sudo/wheel/admin group), and that default is persisted the
// first time it's resolved so a later group change doesn't silently change
// someone's tmuxctl access underneath them.
function getRole(username) {
  const map = load();
  if (map[username]) return map[username];
  const role = isInLocalAdminGroup(username) ? "admin" : "none";
  map[username] = role;
  save(map);
  return role;
}

function setRole(username, role) {
  if (!["admin", "operator", "viewer", "none"].includes(role)) {
    throw new Error("invalid role: " + role);
  }
  const map = load();
  map[username] = role;
  save(map);
  return role;
}

function removeRole(username) {
  const map = load();
  delete map[username];
  save(map);
}

module.exports = { getRole, setRole, removeRole, isInLocalAdminGroup };
