"use strict";
const fs = require("fs");
const path = require("path");
const express = require("express");
const config = require("./config");
const auth = require("./auth");
const tmuxRoutes = require("./tmuxRoutes");
const usersRoutes = require("./usersRoutes");
const settingsRoutes = require("./settingsRoutes");
const tmuxconf = require("./tmuxconf");
const pty = require("./pty");

fs.mkdirSync(config.DATA_DIR, { recursive: true });

// Applied on every boot, not only when a setting is changed via the UI —
// otherwise a session created before anyone ever opens 설정 never gets
// `set -g status off` etc., and shows tmux's own status line instead of
// (redundantly, alongside) the app's sidebar/tab chrome.
tmuxconf.write(settingsRoutes.load());

const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  // Hand-rolled instead of pulling in helmet for four headers: this serves
  // one same-origin SPA with no third-party embeds, so there's nothing left
  // for a CSP to meaningfully restrict beyond what these already cover —
  // clickjacking (the login page) and MIME-sniffing.
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});
app.use(express.json());
app.use(auth.sessionMiddleware);

auth.registerRoutes(app);
tmuxRoutes.registerRoutes(app, auth.requireAuth, auth.requireRole);
usersRoutes.registerRoutes(app, auth.requireAuth, auth.requireRole);
settingsRoutes.registerRoutes(app, auth.requireAuth, auth.requireRole);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "internal error" });
});

if (fs.existsSync(config.WEB_DIST)) {
  app.use(express.static(config.WEB_DIST));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/ws/")) return next();
    res.sendFile(path.join(config.WEB_DIST, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.status(200).send(
      "tmuxctl API server is running, but web/dist is not built yet.\n" +
        "Run `npm run setup:web && npm run build:web`, or `npm run dev:web` for local development."
    );
  });
}

const server = app.listen(config.PORT, () => {
  console.log(`tmuxctl listening on http://0.0.0.0:${config.PORT}`);
});

pty.attach(server);
