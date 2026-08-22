import React, { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useApp } from "../store.jsx";
import { api } from "../api.js";

const TAG_DATA = "0";
const TAG_RESIZE = "1";

function XTermPane({ session, readOnly }) {
  const hostRef = useRef(null);
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const fitRef = useRef(null);

  useEffect(() => {
    const term = new XTerm({
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: 13,
      theme: { background: "#08090c", foreground: "#d6dbe4", cursor: "#6ee7a8" },
      disableStdin: readOnly,
      cursorBlink: !readOnly,
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/terminal?session=${encodeURIComponent(session)}`);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const sendSize = () => {
      if (ws.readyState === WebSocket.OPEN) ws.send(TAG_RESIZE + JSON.stringify({ cols: term.cols, rows: term.rows }));
    };

    ws.onopen = sendSize;
    ws.onmessage = (ev) => {
      const msg = typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data);
      if (msg[0] === TAG_DATA) term.write(msg.slice(1));
    };
    ws.onclose = () => {
      term.write("\r\n\x1b[90m[연결 종료 — 세션은 백그라운드에서 계속 실행됩니다]\x1b[0m\r\n");
    };

    // fit() measures cell size from whatever font is active right now. The
    // very first fit above almost always runs before the JetBrains Mono
    // webfont has finished loading, so it sizes the grid using the fallback
    // font's (wider/narrower) metrics — tmux then lays out panes for that
    // wrong column count, and once the real font swaps in every line is
    // misaligned against it, which reads as the screen "breaking" into
    // overlapping text. Re-fit and re-sync once the real font is ready.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        try {
          fit.fit();
        } catch {
          /* pane may already be gone */
        }
        sendSize();
      });
    }

    const dataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(TAG_DATA + data);
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit();
        sendSize();
      } catch {
        /* ignore transient measurement errors during teardown */
      }
    });
    resizeObserver.observe(hostRef.current);

    return () => {
      dataDisposable.dispose();
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };
  }, [session, readOnly]);

  return <div ref={hostRef} className="xterm-wrap" />;
}

export default function Terminal() {
  const { me, selected, sessions } = useApp();
  const [tree, setTree] = useState([]);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    async function load() {
      try {
        const windows = await api.get(`/api/sessions/${encodeURIComponent(selected)}/windows`);
        if (alive) setTree(windows);
      } catch {
        /* session may have just been killed — next poll or nav will settle */
      }
    }
    load();
    const t = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [selected]);

  if (!selected || !sessions.find((s) => s.name === selected)) {
    return (
      <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--dim2)", fontSize: 12.5 }}>
        왼쪽에서 세션을 선택하세요.
      </div>
    );
  }

  const canEdit = me.role !== "viewer";
  const activeWindow = tree.find((w) => w.active) || tree[0];

  async function act(fn) {
    try {
      await fn();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <div style={{ width: 214, flex: "0 0 214px", borderRight: "1px solid var(--border)", background: "var(--panel)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "11px 12px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, fontFamily: "var(--mono)", letterSpacing: ".09em", color: "var(--dim2)", textTransform: "uppercase" }}>윈도우 / 페인</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 12, marginTop: 5, color: "var(--accent)" }}>{selected}</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8, minHeight: 0 }}>
          {tree.map((w) => (
            <div key={w.index} style={{ marginBottom: 4 }}>
              <div
                onClick={() => canEdit && act(() => api.post(`/api/sessions/${encodeURIComponent(selected)}/windows/${w.index}/select`))}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, cursor: canEdit ? "pointer" : "default", background: w.active ? "var(--panel2)" : "transparent" }}
              >
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim2)" }}>{w.index}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: w.active ? "var(--accent)" : "var(--text)" }}>{w.name}</span>
                {canEdit && tree.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); act(() => api.del(`/api/sessions/${encodeURIComponent(selected)}/windows/${w.index}`)); }}
                    style={{ background: "none", border: 0, color: "var(--dim2)", cursor: "pointer", fontSize: 10 }}
                  >✕</button>
                )}
              </div>
              {w.panes.map((p) => (
                <div
                  key={p.index}
                  onClick={() => canEdit && act(() => api.post(`/api/sessions/${encodeURIComponent(selected)}/windows/${w.index}/panes/${p.index}/select`))}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 8px 5px 22px", borderRadius: 6, cursor: canEdit ? "pointer" : "default", background: w.active && p.active ? "var(--panel2)" : "transparent" }}
                >
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: w.active && p.active ? "var(--accent)" : "var(--dim)" }}>{w.index}.{p.index}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim2)", marginLeft: "auto" }}>{p.command}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        {canEdit && (
          <div style={{ borderTop: "1px solid var(--border)", padding: 8, display: "grid", gap: 5 }}>
            <button className="btn ghost" style={{ textAlign: "left", paddingLeft: 10 }} onClick={() => act(() => api.post(`/api/sessions/${encodeURIComponent(selected)}/windows`))}>＋ 새 윈도우</button>
            <button
              className="btn ghost" style={{ textAlign: "left", paddingLeft: 10 }}
              onClick={() => activeWindow && act(() => api.post(`/api/sessions/${encodeURIComponent(selected)}/windows/${activeWindow.index}/split`, { direction: "h" }))}
            >▯▯ 좌우 분할</button>
            <button
              className="btn ghost" style={{ textAlign: "left", paddingLeft: 10 }}
              onClick={() => activeWindow && act(() => api.post(`/api/sessions/${encodeURIComponent(selected)}/windows/${activeWindow.index}/split`, { direction: "v" }))}
            >▤ 상하 분할</button>
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--termbg)" }}>
        <XTermPane key={selected} session={selected} readOnly={!canEdit} />
      </div>
    </div>
  );
}
