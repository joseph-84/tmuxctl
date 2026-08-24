"use strict";
const config = require("./config");
const { readJson, writeJson } = require("./jsonStore");
const tmuxconf = require("./tmuxconf");
const activity = require("./activity");

// mouse defaults off: tmux mouse-reporting intercepts click-drag itself, so
// with it on, the ordinary "drag to select, Ctrl/Cmd+C to copy" a browser
// user expects doesn't work — the selection resets instead of highlighting.
// Off by default keeps normal browser text selection working out of the
// box; users who want tmux's mouse-driven pane switching/scroll can still
// flip this on in 설정.
const DEFAULTS = { mouse: false, vikeys: true, bigHistory: true, autoAttach: false, notify: false };
const LABELS = {
  mouse: { label: "마우스 모드", hint: "set -g mouse on" },
  vikeys: { label: "vi 키 바인딩", hint: "setw -g mode-keys vi" },
  bigHistory: { label: "긴 스크롤 버퍼", hint: "set -g history-limit 50000" },
  autoAttach: { label: "로그인 시 마지막 세션 자동 attach", hint: "tmuxctl.auto_attach = true" },
  notify: { label: "세션 종료 알림", hint: "session-closed hook" },
};

function load() {
  return { ...DEFAULTS, ...readJson(config.SETTINGS_FILE, {}) };
}

function registerRoutes(app, requireAuth, requireRole) {
  const canView = requireRole("admin", "operator", "viewer");
  const canEdit = requireRole("admin", "operator");

  app.get("/api/settings", requireAuth, canView, (req, res) => {
    const opts = load();
    res.json({
      opts,
      fields: Object.keys(DEFAULTS).map((k) => ({ key: k, value: opts[k], ...LABELS[k] })),
      conf: tmuxconf.buildLines(opts),
      confPath: tmuxconf.CONF_PATH,
    });
  });

  app.patch("/api/settings", requireAuth, canEdit, (req, res) => {
    const { key, value } = req.body || {};
    if (!(key in DEFAULTS)) return res.status(400).json({ error: "알 수 없는 설정: " + key });
    const opts = { ...load(), [key]: !!value };
    writeJson(config.SETTINGS_FILE, opts);
    tmuxconf.write(opts);
    activity.record(req.tmuxctlUser.username, `설정 변경: ${LABELS[key].label} → ${value ? "on" : "off"}`, "new");
    res.json({
      opts,
      fields: Object.keys(DEFAULTS).map((k) => ({ key: k, value: opts[k], ...LABELS[k] })),
      conf: tmuxconf.buildLines(opts),
    });
  });
}

module.exports = { registerRoutes, load };
