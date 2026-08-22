"use strict";
const config = require("./config");
const osusers = require("./osusers");
const roles = require("./roles");
const activity = require("./activity");
const { runUseradmin } = require("./sudoExec");
const { onlineUsers } = require("./presence");

const ROLE_LABEL = { admin: "관리자", operator: "운영자", viewer: "열람", none: "접근 없음" };
const ALLOWED_SHELLS = ["/bin/bash", "/bin/zsh", "/usr/bin/fish", "/usr/sbin/nologin"];

function serialize(u) {
  const role = roles.getRole(u.name);
  const online = onlineUsers().has(u.name);
  return {
    name: u.name,
    uid: u.uid,
    shell: u.shell,
    role,
    roleLabel: ROLE_LABEL[role],
    online,
    status: online ? "접속 중" : "오프라인",
  };
}

function registerRoutes(app, requireAuth, requireRole) {
  // Read access is intentionally broader than write: the dashboard's
  // "접속 중인 사용자" panel needs this for every role, but only admins may
  // create/delete accounts or change roles (enforced on each route below).
  app.get("/api/users", requireAuth, requireRole("admin", "operator", "viewer"), (req, res) => {
    const list = osusers.listHumanUsers(config.MIN_UID).map(serialize);
    res.json(list);
  });

  app.post("/api/users", requireAuth, requireRole("admin"), async (req, res) => {
    const { name, shell, role } = req.body || {};
    if (!osusers.USERNAME_RE.test(name || "")) {
      return res.status(400).json({ error: "계정명 형식이 올바르지 않습니다." });
    }
    if (!ALLOWED_SHELLS.includes(shell)) {
      return res.status(400).json({ error: "허용되지 않은 셸입니다." });
    }
    if (osusers.getUser(name)) {
      return res.status(409).json({ error: "이미 존재하는 계정입니다." });
    }
    try {
      const tempPassword = await runUseradmin(["add", name, shell]);
      roles.setRole(name, role && ROLE_LABEL[role] ? role : "operator");
      activity.record(req.tmuxctlUser.username, `${req.tmuxctlUser.username} 이 ${name} 계정 생성`, "new");
      res.json({ name, tempPassword });
    } catch (err) {
      res.status(500).json({ error: "useradd 실패: " + (err.stderr || err.message).trim() });
    }
  });

  app.delete("/api/users/:name", requireAuth, requireRole("admin"), async (req, res) => {
    const { name } = req.params;
    if (name === req.tmuxctlUser.username) {
      return res.status(400).json({ error: "자기 자신은 삭제할 수 없습니다." });
    }
    const u = osusers.getUser(name);
    if (!u || u.uid < config.MIN_UID) {
      return res.status(404).json({ error: "삭제할 수 없는 계정입니다." });
    }
    try {
      await runUseradmin(["del", name]);
      roles.removeRole(name);
      activity.record(req.tmuxctlUser.username, `${req.tmuxctlUser.username} 이 ${name} 계정 삭제 (userdel -r)`, "exit");
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "userdel 실패: " + (err.stderr || err.message).trim() });
    }
  });

  app.patch("/api/users/:name/role", requireAuth, requireRole("admin"), (req, res) => {
    const { name } = req.params;
    const { role } = req.body || {};
    if (!osusers.getUser(name)) return res.status(404).json({ error: "존재하지 않는 계정입니다." });
    try {
      roles.setRole(name, role);
      activity.record(req.tmuxctlUser.username, `${name} 역할 → ${ROLE_LABEL[role]}`, "new");
      res.json({ name, role });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
}

module.exports = { registerRoutes, ROLE_LABEL };
