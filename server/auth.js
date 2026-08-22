"use strict";
const session = require("express-session");
const cookie = require("cookie");
const signature = require("cookie-signature");
const pam = require("authenticate-pam");
const config = require("./config");
const roles = require("./roles");
const osusers = require("./osusers");
const activity = require("./activity");
const presence = require("./presence");

function pamAuthenticate(username, password) {
  return new Promise((resolve, reject) => {
    pam.authenticate(username, password, (err) => (err ? reject(err) : resolve()), {
      serviceName: config.PAM_SERVICE,
    });
  });
}

const COOKIE_NAME = "tmuxctl.sid";
const sessionStore = new session.MemoryStore();

const sessionMiddleware = session({
  secret: config.SESSION_SECRET,
  name: COOKIE_NAME,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    // secure cookies require TLS in front of tmuxctl (e.g. nginx/caddy) —
    // see README "배포" section. Left off by default so plain-HTTP LAN use
    // (the common case for a single-box admin tool) isn't broken out of the box.
    secure: process.env.TMUXCTL_SECURE_COOKIE === "1",
    maxAge: 8 * 60 * 60 * 1000,
  },
});

function currentUser(req) {
  if (!req.session || !req.session.user) return null;
  return { username: req.session.user, uid: req.session.uid, role: roles.getRole(req.session.user) };
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "로그인이 필요합니다." });
  presence.touch(user.username);
  req.tmuxctlUser = user;
  next();
}

function requireRole(...allowed) {
  return (req, res, next) => {
    const user = req.tmuxctlUser || currentUser(req);
    if (!user) return res.status(401).json({ error: "로그인이 필요합니다." });
    if (!allowed.includes(user.role)) return res.status(403).json({ error: "권한이 없습니다." });
    req.tmuxctlUser = user;
    next();
  };
}

// Used by the WebSocket upgrade handler (server/pty.js), which never runs
// through Express middleware — it reads the same signed session cookie and
// looks the session up in the same MemoryStore the HTTP side uses.
function userFromCookieHeader(cookieHeader) {
  return new Promise((resolve) => {
    if (!cookieHeader) return resolve(null);
    const cookies = cookie.parse(cookieHeader);
    const raw = cookies[COOKIE_NAME];
    if (!raw || !raw.startsWith("s:")) return resolve(null);
    const sid = signature.unsign(raw.slice(2), config.SESSION_SECRET);
    if (!sid) return resolve(null);
    sessionStore.get(sid, (err, sess) => {
      if (err || !sess || !sess.user) return resolve(null);
      resolve({ username: sess.user, uid: sess.uid, role: roles.getRole(sess.user) });
    });
  });
}

function registerRoutes(app) {
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "아이디와 비밀번호를 입력하세요." });
    }
    if (!osusers.USERNAME_RE.test(username)) {
      return res.status(401).json({ error: "인증 실패" });
    }
    try {
      await pamAuthenticate(username, password);
    } catch {
      activity.record(username, "로그인 실패", "warn");
      return res.status(401).json({ error: "인증 실패" });
    }
    const osUser = osusers.getUser(username);
    if (!osUser) {
      return res.status(401).json({ error: "인증 실패" });
    }
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: "세션 생성 실패" });
      req.session.user = username;
      req.session.uid = osUser.uid;
      const role = roles.getRole(username);
      activity.record(username, `${username} 로그인 (${role})`, "attach");
      res.json({ username, uid: osUser.uid, role });
    });
  });

  app.post("/api/logout", (req, res) => {
    const user = req.session && req.session.user;
    req.session.destroy(() => {
      if (user) activity.record(user, `${user} 로그아웃`, "exit");
      res.clearCookie("tmuxctl.sid");
      res.json({ ok: true });
    });
  });

  app.get("/api/me", requireAuth, (req, res) => {
    res.json(req.tmuxctlUser);
  });
}

module.exports = {
  sessionMiddleware,
  currentUser,
  requireAuth,
  requireRole,
  registerRoutes,
  userFromCookieHeader,
};
