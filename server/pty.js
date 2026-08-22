"use strict";
const os = require("os");
const url = require("url");
const WebSocket = require("ws");
const nodePty = require("node-pty");
const tmuxctl = require("./tmuxctl");
const auth = require("./auth");
const activity = require("./activity");

// Wire protocol is deliberately tiny: every ws message's first byte is a tag
// so a control message (resize) can never be confused with literal terminal
// input/output, without needing a second socket or multiplexing library.
const TAG_DATA = "0";
const TAG_RESIZE = "1";

let liveConnections = 0;
function connectionCount() {
  return liveConnections;
}

function attach(server) {
  const wss = new WebSocket.Server({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname, query } = url.parse(req.url, true);
    if (pathname !== "/ws/terminal") return; // let other upgrade handlers (if any) see it

    auth.userFromCookieHeader(req.headers.cookie).then((user) => {
      if (!user || user.role === "none") {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      const session = query.session;
      if (!tmuxctl.NAME_RE.test(session || "")) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, { user, session });
      });
    });
  });

  wss.on("connection", (ws, { user, session }) => {
    liveConnections++;
    ws.on("close", () => {
      liveConnections--;
    });
    const readOnly = user.role === "viewer";
    let pty;
    try {
      // -A: attach if the session exists, otherwise create it — a safety
      // net for the case a session vanished between the sidebar list and
      // the click (killed from elsewhere). No -d/-D, so multiple browser
      // tabs (or multiple admins) can be attached to the same tmux session
      // at once, exactly like several terminals SSHed in and attached.
      pty = nodePty.spawn("tmux", ["new-session", "-A", "-s", session], {
        name: "xterm-256color",
        cols: 100,
        rows: 30,
        cwd: os.homedir(),
        env: process.env,
      });
    } catch (err) {
      ws.close(1011, "pty spawn failed: " + err.message);
      return;
    }

    pty.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(TAG_DATA + data);
    });
    pty.onExit(() => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    });

    ws.on("message", (raw) => {
      const msg = raw.toString();
      const tag = msg[0];
      const body = msg.slice(1);
      if (tag === TAG_RESIZE) {
        try {
          const { cols, rows } = JSON.parse(body);
          if (cols > 0 && rows > 0 && cols < 1000 && rows < 1000) pty.resize(cols, rows);
        } catch {
          /* ignore malformed resize payloads */
        }
      } else if (tag === TAG_DATA) {
        if (!readOnly) pty.write(body);
      }
    });

    ws.on("close", () => {
      // Kills only this pty *client* (equivalent to closing an ssh session
      // that had `tmux attach` running) — the tmux session itself, and
      // anything running inside it, keeps going on the server.
      try {
        pty.kill();
      } catch {
        /* already gone */
      }
    });

    activity.record(user.username, `${user.username} 이 ${session} 세션에 attach${readOnly ? " (read-only)" : ""}`, "attach");
  });
}

module.exports = { attach, connectionCount };
