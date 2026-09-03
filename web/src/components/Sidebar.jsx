import React, { useEffect, useState } from "react";
import { useApp } from "../store.jsx";
import { api } from "../api.js";
import FileExplorer from "./FileExplorer.jsx";

const NAV = [
  { key: "dash", label: "대시보드", icon: "▦" },
  { key: "term", label: "터미널", icon: "▶" },
  { key: "users", label: "사용자", icon: "◍", adminOnly: true },
  { key: "server", label: "이 서버", icon: "⬢" },
  { key: "settings", label: "설정", icon: "⚙" },
];

function SectionHeader({ label, open, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{ margin: "10px 12px 6px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
    >
      <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--dim2)", width: 10 }}>{open ? "▾" : "▸"}</span>
      <div style={{ fontSize: 10, fontFamily: "var(--mono)", letterSpacing: ".1em", color: "var(--dim2)", textTransform: "uppercase" }}>{label}</div>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

export default function Sidebar({ onCreate }) {
  const { me, route, setRoute, sessions, refreshSessions, host, selected, selectSession, flash } = useApp();
  const [sessionsOpen, setSessionsOpen] = useState(() => localStorage.getItem("tmuxctl.sidebar.sessions") !== "0");
  const [filesOpen, setFilesOpen] = useState(() => localStorage.getItem("tmuxctl.sidebar.files") !== "0");

  useEffect(() => {
    localStorage.setItem("tmuxctl.sidebar.sessions", sessionsOpen ? "1" : "0");
  }, [sessionsOpen]);
  useEffect(() => {
    localStorage.setItem("tmuxctl.sidebar.files", filesOpen ? "1" : "0");
  }, [filesOpen]);

  async function killSession(e, name) {
    e.stopPropagation();
    if (!confirm(`${name} 세션을 종료할까요? (tmux kill-session)`)) return;
    try {
      await api.del(`/api/sessions/${encodeURIComponent(name)}`);
      flash("tmux kill-session -t " + name);
      refreshSessions();
    } catch (err) {
      flash(err.message);
    }
  }

  return (
    <div style={{ width: 262, flex: "0 0 262px", borderRight: "1px solid var(--border)", background: "var(--panel)", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "10px 10px 4px" }}>
        {NAV.filter((n) => !n.adminOnly || me.role === "admin").map((n) => {
          const active = route === n.key;
          const cur = sessions.find((s) => s.name === selected);
          return (
            <div
              key={n.key}
              onClick={() => setRoute(n.key)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "7px 9px", borderRadius: 7, cursor: "pointer",
                background: active ? "var(--panel3)" : "transparent", color: active ? "var(--text)" : "var(--dim)", marginBottom: 1,
              }}
            >
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, width: 14, textAlign: "center", color: active ? "var(--accent)" : "var(--dim2)" }}>{n.icon}</span>
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>{n.label}</span>
              <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim2)" }}>
                {n.key === "term" ? (cur ? cur.name : "") : n.key === "users" ? "" : ""}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ flex: sessionsOpen ? 1 : "0 0 auto", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <SectionHeader label="tmux 세션" open={sessionsOpen} onToggle={() => setSessionsOpen((v) => !v)} />
          {sessionsOpen && (
            <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px", minHeight: 0 }}>
              {sessions.map((s) => {
                const active = s.name === selected;
                return (
                  <div
                    key={s.name}
                    onClick={() => selectSession(s.name)}
                    style={{
                      border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                      background: active ? "var(--panel2)" : "transparent",
                      borderRadius: 9, padding: "9px 10px", marginBottom: 6, cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span className="dot" style={{ background: s.attached ? "var(--accent)" : "var(--dim2)" }} />
                      <div style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                      {me.role !== "viewer" && (
                        <button onClick={(e) => killSession(e, s.name)} title="kill-session" style={{ background: "none", border: 0, color: "var(--dim2)", cursor: "pointer", fontSize: 11, padding: "0 2px" }}>
                          ✕
                        </button>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 10, color: "var(--dim2)", fontFamily: "var(--mono)" }}>
                      <span>{s.windowCount}w</span>
                      <span>{s.paneCount}p</span>
                      <span style={{ marginLeft: "auto" }}>{s.age}</span>
                    </div>
                  </div>
                );
              })}
              {sessions.length === 0 && (
                <div style={{ textAlign: "center", padding: "22px 10px", fontSize: 11, color: "var(--dim2)", lineHeight: 1.7 }}>
                  이 호스트에 세션이 없습니다.
                  <br />
                  {me.role !== "viewer" && (
                    <span onClick={onCreate} style={{ color: "var(--accent)", cursor: "pointer" }}>
                      새 세션 만들기
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ flex: filesOpen ? 1 : "0 0 auto", display: "flex", flexDirection: "column", minHeight: 0, borderTop: "1px solid var(--border)" }}>
          <SectionHeader label="파일" open={filesOpen} onToggle={() => setFilesOpen((v) => !v)} />
          {filesOpen && (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "0 8px 8px" }}>
              <FileExplorer />
            </div>
          )}
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--border)", padding: "9px 12px", display: "flex", gap: 8, alignItems: "center", fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim2)" }}>
        <span>load {host ? host.load : "…"}</span>
        <span>·</span>
        <span>up {host ? host.uptime : "…"}</span>
      </div>
    </div>
  );
}
