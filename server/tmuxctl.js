"use strict";
const { execFile } = require("child_process");

// Tab, not the more obvious \x1f (unit separator): tmux's format engine runs
// literal format-string text through a "vis" escaper that turns \x1f into
// the 4-byte literal "\037" in its output, silently breaking any split() on
// it. Tab passes through unescaped and won't appear in a session/window
// name (our own NAME_RE forbids it) or a pane's current command.
const SEP = "\t";
const NAME_RE = /^[A-Za-z0-9_.-]{1,64}$/;

function run(args) {
  return new Promise((resolve, reject) => {
    execFile("tmux", args, { maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr;
        return reject(err);
      }
      resolve(stdout);
    });
  });
}

function assertName(name, what) {
  if (!NAME_RE.test(name)) {
    const e = new Error(`invalid ${what || "name"}: ${name}`);
    e.status = 400;
    throw e;
  }
}

function isNoServerError(err) {
  const msg = (err.stderr || err.message || "").toLowerCase();
  return msg.includes("no server running") || msg.includes("no such file or directory") || msg.includes("error connecting");
}

async function listSessions() {
  const fields = ["#{session_name}", "#{session_created}", "#{session_attached}", "#{session_windows}"];
  try {
    const out = await run(["list-sessions", "-F", fields.join(SEP)]);
    return out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, created, attached, windows] = line.split(SEP);
        return {
          name,
          created: new Date(parseInt(created, 10) * 1000).toISOString(),
          attached: attached === "1",
          windowCount: parseInt(windows, 10) || 0,
        };
      });
  } catch (err) {
    if (isNoServerError(err)) return [];
    throw err;
  }
}

async function listWindows(session) {
  assertName(session, "session");
  const fields = ["#{window_index}", "#{window_name}", "#{window_active}", "#{window_panes}"];
  try {
    const out = await run(["list-windows", "-t", session, "-F", fields.join(SEP)]);
    return out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [index, name, active, panes] = line.split(SEP);
        return { index: parseInt(index, 10), name, active: active === "1", paneCount: parseInt(panes, 10) || 0 };
      });
  } catch (err) {
    if (isNoServerError(err)) return [];
    throw err;
  }
}

async function listPanes(session, windowIndex) {
  assertName(session, "session");
  const target = `${session}:${assertIndex(windowIndex)}`;
  const fields = ["#{pane_index}", "#{pane_active}", "#{pane_current_command}", "#{pane_width}", "#{pane_height}"];
  try {
    const out = await run(["list-panes", "-t", target, "-F", fields.join(SEP)]);
    return out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [index, active, cmd, w, h] = line.split(SEP);
        return { index: parseInt(index, 10), active: active === "1", command: cmd, size: `${w}x${h}` };
      });
  } catch (err) {
    if (isNoServerError(err)) return [];
    throw err;
  }
}

function assertIndex(idx) {
  const n = parseInt(idx, 10);
  if (!Number.isInteger(n) || n < 0 || String(n) !== String(idx).trim()) {
    const e = new Error("invalid window index: " + idx);
    e.status = 400;
    throw e;
  }
  return n;
}

async function sessionExists(session) {
  assertName(session, "session");
  try {
    await run(["has-session", "-t", session]);
    return true;
  } catch {
    return false;
  }
}

async function newSession({ name, cwd, command }) {
  assertName(name, "session name");
  const args = ["new-session", "-d", "-s", name];
  if (cwd) args.push("-c", cwd);
  if (command) args.push(command);
  await run(args);
}

async function killSession(session) {
  assertName(session, "session");
  await run(["kill-session", "-t", session]);
}

async function newWindow(session, { cwd, command } = {}) {
  assertName(session, "session");
  const args = ["new-window", "-t", session];
  if (cwd) args.push("-c", cwd);
  if (command) args.push(command);
  await run(args);
}

async function killWindow(session, windowIndex) {
  assertName(session, "session");
  await run(["kill-window", "-t", `${session}:${assertIndex(windowIndex)}`]);
}

async function selectWindow(session, windowIndex) {
  assertName(session, "session");
  await run(["select-window", "-t", `${session}:${assertIndex(windowIndex)}`]);
}

async function splitWindow(session, windowIndex, direction) {
  assertName(session, "session");
  const flag = direction === "v" ? "-v" : "-h";
  await run(["split-window", flag, "-t", `${session}:${assertIndex(windowIndex)}`]);
}

async function selectPane(session, windowIndex, paneIndex) {
  assertName(session, "session");
  await run(["select-pane", "-t", `${session}:${assertIndex(windowIndex)}.${assertIndex(paneIndex)}`]);
}

async function version() {
  try {
    const out = await run(["-V"]);
    return out.trim();
  } catch {
    return "unknown";
  }
}

module.exports = {
  NAME_RE,
  listSessions,
  listWindows,
  listPanes,
  sessionExists,
  newSession,
  killSession,
  newWindow,
  killWindow,
  selectWindow,
  splitWindow,
  selectPane,
  version,
};
