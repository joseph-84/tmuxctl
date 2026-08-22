"use strict";
const os = require("os");
const { execFile } = require("child_process");
const tmuxctl = require("./tmuxctl");
const activity = require("./activity");
const pty = require("./pty");
const config = require("./config");

const SERVICE_ACCOUNT = os.userInfo().username;

function humanAge(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

async function sessionSummary(s) {
  const windows = await tmuxctl.listWindows(s.name);
  let paneCount = 0;
  for (const w of windows) paneCount += w.paneCount;
  return {
    name: s.name,
    attached: s.attached,
    created: s.created,
    age: humanAge(s.created),
    windowCount: windows.length,
    paneCount,
    owner: SERVICE_ACCOUNT,
  };
}

function registerRoutes(app, requireAuth, requireRole) {
  const canView = requireRole("admin", "operator", "viewer");
  const canEdit = requireRole("admin", "operator");

  app.get("/api/host", requireAuth, canView, async (req, res) => {
    res.json({
      label: os.hostname(),
      os: `${os.type()} ${os.release()}`,
      arch: os.arch(),
      load: os.loadavg()[0].toFixed(2),
      uptime: humanUptime(os.uptime()),
      tmuxVersion: await tmuxctl.version(),
    });
  });

  app.get("/api/server-info", requireAuth, canView, async (req, res) => {
    const serviceState = await new Promise((resolve) => {
      execFile("systemctl", ["--user", "is-active", "tmuxctl.service"], (err, stdout) => resolve((stdout || "").trim() || "unknown"));
    });
    res.json({
      info: [
        { k: "hostname", v: os.hostname() },
        { k: "os", v: `${os.type()} ${os.release()}` },
        { k: "kernel", v: `${os.release()} ${os.arch()}` },
        { k: "tmux", v: await tmuxctl.version() },
        { k: "load avg", v: os.loadavg().map((n) => n.toFixed(2)).join(" / ") },
        { k: "uptime", v: humanUptime(os.uptime()) },
        { k: "listen", v: `0.0.0.0:${config.PORT}` },
      ],
      daemon: [
        { k: "tmuxctl.service", v: serviceState, ok: serviceState === "active" },
        { k: "실행 계정", v: `${SERVICE_ACCOUNT} (uid ${process.getuid ? process.getuid() : "-"})`, ok: true },
        { k: "인증", v: "PAM · " + (process.env.TMUXCTL_PAM_SERVICE || "tmuxctl"), ok: true },
        { k: "websocket", v: `${pty.connectionCount()} connected`, ok: true },
      ],
    });
  });

  app.get("/api/sessions", requireAuth, canView, async (req, res) => {
    try {
      const sessions = await tmuxctl.listSessions();
      res.json(await Promise.all(sessions.map(sessionSummary)));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sessions", requireAuth, canEdit, async (req, res) => {
    const { name } = req.body || {};
    if (!tmuxctl.NAME_RE.test(name || "")) {
      return res.status(400).json({ error: "세션 이름 형식이 올바르지 않습니다." });
    }
    if (await tmuxctl.sessionExists(name)) {
      return res.status(409).json({ error: "이미 존재하는 세션입니다." });
    }
    try {
      await tmuxctl.newSession({ name, cwd: os.homedir() });
      activity.record(req.tmuxctlUser.username, `${req.tmuxctlUser.username} 이 ${name} 세션 생성`, "new");
      res.json(await sessionSummary({ name, attached: false, created: new Date().toISOString() }));
    } catch (err) {
      res.status(500).json({ error: "tmux new-session 실패: " + (err.stderr || err.message).trim() });
    }
  });

  app.delete("/api/sessions/:name", requireAuth, canEdit, async (req, res) => {
    try {
      await tmuxctl.killSession(req.params.name);
      activity.record(req.tmuxctlUser.username, `${req.tmuxctlUser.username} 이 ${req.params.name} 세션 종료 (kill-session)`, "exit");
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "tmux kill-session 실패: " + (err.stderr || err.message).trim() });
    }
  });

  app.get("/api/sessions/:name/windows", requireAuth, canView, async (req, res) => {
    try {
      const windows = await tmuxctl.listWindows(req.params.name);
      const withPanes = await Promise.all(
        windows.map(async (w) => ({ ...w, panes: await tmuxctl.listPanes(req.params.name, w.index) }))
      );
      res.json(withPanes);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sessions/:name/windows", requireAuth, canEdit, async (req, res) => {
    try {
      await tmuxctl.newWindow(req.params.name);
      activity.record(req.tmuxctlUser.username, `tmux new-window -t ${req.params.name}`, "new");
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/sessions/:name/windows/:index", requireAuth, canEdit, async (req, res) => {
    try {
      await tmuxctl.killWindow(req.params.name, req.params.index);
      activity.record(req.tmuxctlUser.username, `tmux kill-window -t ${req.params.name}:${req.params.index}`, "exit");
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sessions/:name/windows/:index/select", requireAuth, canEdit, async (req, res) => {
    try {
      await tmuxctl.selectWindow(req.params.name, req.params.index);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sessions/:name/windows/:index/panes/:pane/select", requireAuth, canEdit, async (req, res) => {
    try {
      await tmuxctl.selectPane(req.params.name, req.params.index, req.params.pane);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sessions/:name/windows/:index/split", requireAuth, canEdit, async (req, res) => {
    try {
      await tmuxctl.splitWindow(req.params.name, req.params.index, (req.body || {}).direction);
      activity.record(req.tmuxctlUser.username, `tmux split-window -${(req.body || {}).direction === "v" ? "v" : "h"} -t ${req.params.name}:${req.params.index}`, "new");
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/activity", requireAuth, canView, (req, res) => {
    res.json(require("./activity").list());
  });
}

function humanUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return `${d}d ${h}h`;
}

module.exports = { registerRoutes };
