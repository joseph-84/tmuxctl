"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");
const activity = require("./activity");

// No sandbox root on purpose: the logged-in account already has a real
// shell (server/pty.js) that can read/write anything it has OS permission
// to — this just gives that same access a point-and-click UI instead of
// `cd`/`cat`/`scp`. The filesystem's own permissions are the only boundary,
// same as the terminal.
const DEFAULT_ROOT = os.homedir();

function resolvePath(p) {
  return path.resolve(typeof p === "string" && p ? p : DEFAULT_ROOT);
}

function listDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = entries.map((e) => {
    const full = path.join(dir, e.name);
    let isDir = e.isDirectory();
    let size = 0;
    let mtime = null;
    try {
      const st = fs.statSync(full); // follows symlinks so links to dirs sort/behave right
      isDir = st.isDirectory();
      size = st.size;
      mtime = st.mtime.toISOString();
    } catch {
      /* broken symlink, or removed mid-listing — still show the name */
    }
    return { name: e.name, isDir, size, mtime };
  });
  out.sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)));
  return out;
}

function registerRoutes(app, requireAuth, requireRole) {
  // Mirrors the terminal's own viewer/editor split: viewer can look and
  // download (same as watching a read-only attach), only operator/admin
  // can change anything on disk.
  const canView = requireRole("admin", "operator", "viewer");
  const canEdit = requireRole("admin", "operator");

  app.get("/api/files", requireAuth, canView, (req, res) => {
    const dir = resolvePath(req.query.path);
    let stat;
    try {
      stat = fs.statSync(dir);
    } catch {
      return res.status(404).json({ error: "존재하지 않는 경로입니다." });
    }
    if (!stat.isDirectory()) return res.status(400).json({ error: "디렉터리가 아닙니다." });
    try {
      res.json({ path: dir, parent: path.dirname(dir) === dir ? null : path.dirname(dir), entries: listDir(dir) });
    } catch (err) {
      res.status(err.code === "EACCES" ? 403 : 500).json({ error: "목록을 읽을 수 없습니다: " + err.message });
    }
  });

  app.get("/api/files/download", requireAuth, canView, (req, res) => {
    const file = resolvePath(req.query.path);
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      return res.status(404).json({ error: "존재하지 않는 파일입니다." });
    }
    if (!stat.isFile()) return res.status(400).json({ error: "파일이 아닙니다." });
    res.download(file, path.basename(file), (err) => {
      if (err && !res.headersSent) res.status(500).json({ error: "다운로드 실패: " + err.message });
    });
  });

  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        try {
          const dir = resolvePath(req.query.path);
          if (!fs.statSync(dir).isDirectory()) return cb(new Error("업로드 대상이 디렉터리가 아닙니다."));
          cb(null, dir);
        } catch (err) {
          cb(err);
        }
      },
      // Filenames come straight from the client — take only the basename so
      // a crafted name like "../../etc/cron.d/x" can't write outside the
      // destination directory resolved above.
      filename: (req, file, cb) => cb(null, path.basename(file.originalname)),
    }),
    limits: { fileSize: 200 * 1024 * 1024, files: 20 },
  });

  app.post("/api/files/upload", requireAuth, canEdit, (req, res) => {
    upload.array("files")(req, res, (err) => {
      if (err) return res.status(400).json({ error: "업로드 실패: " + err.message });
      const dir = resolvePath(req.query.path);
      activity.record(req.tmuxctlUser.username, `${req.tmuxctlUser.username} 이 ${dir}에 파일 ${req.files.length}개 업로드`, "new");
      res.json({ ok: true, uploaded: req.files.map((f) => f.filename) });
    });
  });

  app.delete("/api/files", requireAuth, canEdit, (req, res) => {
    const file = resolvePath(req.query.path);
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      return res.status(404).json({ error: "존재하지 않는 파일입니다." });
    }
    // Deliberately files only — a stray click deleting a whole directory
    // tree is a much worse mistake than a single file; use the terminal for that.
    if (!stat.isFile()) return res.status(400).json({ error: "파일만 삭제할 수 있습니다 (폴더는 터미널에서 삭제하세요)." });
    try {
      fs.unlinkSync(file);
      activity.record(req.tmuxctlUser.username, `${req.tmuxctlUser.username} 이 ${file} 삭제`, "exit");
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "삭제 실패: " + err.message });
    }
  });
}

module.exports = { registerRoutes, DEFAULT_ROOT };
