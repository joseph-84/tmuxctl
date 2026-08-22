"use strict";
const config = require("./config");
const { readJson, writeJson } = require("./jsonStore");

const MAX_ENTRIES = 200;

function list() {
  return readJson(config.ACTIVITY_FILE, []);
}

// kind is one of: new | kill | attach | exit | load | user | login | settings
function record(actor, text, kind) {
  const entries = list();
  entries.unshift({ time: new Date().toISOString(), actor, text, kind: kind || "new" });
  writeJson(config.ACTIVITY_FILE, entries.slice(0, MAX_ENTRIES));
}

module.exports = { list, record };
