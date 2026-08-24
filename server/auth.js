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
const loginThrottle = require("./loginThrottle");

// osusers.USERNAME_RE is deliberately strict (lowercase, no dots) because it
// also gates useradd/userdel account *creation* on Linux. Login just needs
// to accept whatever an *existing* OS account is actually named — and macOS
// short names routinely contain dots (e.g. "junho.park") and mixed case,
// which USERNAME_RE would silently reject before PAM ever saw the request.
const LOGIN_USERNAME_RE = /^[A-Za-z0-9_.-]{1,64}$/;

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
    path: "/",
    // secure cookies require TLS in front of tmuxctl (e.g. nginx/caddy) —
    // see README "배포" section. Left off by default so plain-HTTP LAN use
    // (the common case for a single-box admin tool) isn't broken out of the box.
    secure: process.env.TMUXCTL_SECURE_COOKIE === "1",
    maxAge: 8 * 60 * 60 * 1000,
  },
});

if (process.env.TMUXCTL_SECURE_COOKIE !== "1") {
  console.warn(
    "[tmuxctl] TMUXCTL_SECURE_COOKIE is not set — the session cookie will be sent over plain HTTP. " +
      "Fine for local/LAN use; put a TLS reverse proxy in front and set TMUXCTL_SECURE_COOKIE=1 before exposing this beyond a trusted network."
  );
}

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
    if (!LOGIN_USERNAME_RE.test(username)) {
      console.error(`[tmuxctl] login rejected — username "${username}" doesn't match ${LOGIN_USERNAME_RE}`);
      return res.status(401).json({ error: "인증 실패" });
    }
    const lockedMs = loginThrottle.checkLocked(username);
    if (lockedMs > 0) {
      return res.status(429).json({ error: `로그인 시도가 너무 많습니다. ${Math.ceil(lockedMs / 60000)}분 후 다시 시도하세요.` });
    }
    try {
      await pamAuthenticate(username, password);
    } catch (err) {
      console.error(`[tmuxctl] PAM auth failed for ${username}:`, err && err.message ? err.message : err);
      loginThrottle.recordFailure(username);
      activity.record(username, "로그인 실패", "warn");
      return res.status(401).json({ error: "인증 실패" });
    }
    loginThrottle.recordSuccess(username);
    const osUser = osusers.resolveUser(username);
    if (!osUser) {
      console.error(`[tmuxctl] PAM auth OK for ${username} but no matching OS account (uid) found`);
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
