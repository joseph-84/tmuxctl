#!/usr/bin/env node
// Invoked by a tmux `set-hook` (see server/tmuxconf.js) when the "세션 종료
// 알림" setting is on — tmux runs this as a detached shell command, so it
// can't call back into the running server process directly. It just appends
// straight to the same activity.json the running app reads, which is enough
// for the dashboard's "최근 활동" feed to pick it up on next refresh.
"use strict";
const activity = require("../server/activity");

const [, , kind, sessionName] = process.argv;
if (kind === "session-closed") {
  activity.record("tmux", `${sessionName} 세션 종료 감지 (session-closed hook)`, "exit");
}
