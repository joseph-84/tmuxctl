"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const BEGIN = "# >>> tmuxctl managed >>>";
const END = "# <<< tmuxctl managed <<<";
const CONF_PATH = path.join(os.homedir(), ".tmux.conf");
const NOTIFY_HOOK_SCRIPT = path.join(__dirname, "..", "scripts", "notify-hook.js");

function buildLines(opts) {
  const lines = [
    { text: "# managed by tmuxctl — edits inside this block are overwritten", color: "#6b7686" },
    { text: "set -g prefix C-a", color: "#d6dbe4" },
    { text: `set -g mouse ${opts.mouse ? "on" : "off"}`, color: "#9fe6c2" },
    { text: `setw -g mode-keys ${opts.vikeys ? "vi" : "emacs"}`, color: "#9fe6c2" },
    { text: `set -g history-limit ${opts.bigHistory ? "50000" : "2000"}`, color: "#9fe6c2" },
    { text: "set -g status-style bg=default,fg=green", color: "#d6dbe4" },
    { text: "set -g base-index 0", color: "#d6dbe4" },
    // tmuxctl's own UI (tab bar, status footer) replaces tmux's status
    // line inside the browser — this only affects sessions rendered
    // through tmuxctl, an SSH `tmux attach` still shows a blank bottom row.
    { text: "set -g status off", color: "#d6dbe4" },
  ];
  if (opts.notify) {
    lines.push({ text: "", color: "#d6dbe4" });
    lines.push({
      text: `set-hook -g session-closed "run-shell 'node ${NOTIFY_HOOK_SCRIPT} session-closed #{hook_session_name}'"`,
      color: "#9fe6c2",
    });
  }
  return lines;
}

function readManagedBlockOut(fullText) {
  const start = fullText.indexOf(BEGIN);
  const end = fullText.indexOf(END);
  if (start === -1 || end === -1) return fullText.trimEnd() + (fullText.trim() ? "\n\n" : "");
  return fullText.slice(0, start).trimEnd() + (fullText.slice(0, start).trim() ? "\n\n" : "");
}

function write(opts) {
  const existing = fs.existsSync(CONF_PATH) ? fs.readFileSync(CONF_PATH, "utf8") : "";
  const before = readManagedBlockOut(existing);
  const block = [BEGIN, ...buildLines(opts).map((l) => l.text), END].join("\n");
  fs.writeFileSync(CONF_PATH, before + block + "\n");
  // Best-effort live reload — fine if no tmux server is running yet.
  execFile("tmux", ["source-file", CONF_PATH], () => {});
}

module.exports = { buildLines, write, CONF_PATH };
