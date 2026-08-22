"use strict";
const fs = require("fs");
const path = require("path");

// Minimal synchronous JSON file store. Data volume here is tiny (a role map,
// a settings object, an activity log) and access is infrequent, so sync I/O
// keeps the logic simple and avoids read/write races without a lock file.
function readJson(file, fallback) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

module.exports = { readJson, writeJson };
