import React, { useState } from "react";
import { useApp } from "../store.jsx";
import { api } from "../api.js";

const TEMPLATES = [
  { id: "plain", label: "단일 페인", desc: "윈도우 1개, 셸만" },
  { id: "dev", label: "개발", desc: "3분할 (좌 1 · 우 2)" },
  { id: "ops", label: "운영", desc: "shell + htop 윈도우" },
];

export default function CreateSessionModal({ onClose }) {
  const { host, flash, refreshSessions, selectSession } = useApp();
  const [name, setName] = useState("");
  const [cwd, setCwd] = useState("~");
  const [command, setCommand] = useState("");
  const [template, setTemplate] = useState("dev");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const nameForPreview = name || "new-session";
  let preview = `$ tmux new-session -d -s ${nameForPreview} -c ${cwd}`;
  if (command) preview += ` '${command}'`;
  if (template === "dev") preview += `\n$ tmux split-window -h -t ${nameForPreview}\n$ tmux split-window -v -t ${nameForPreview}`;
  if (template === "ops") preview += `\n$ tmux new-window -t ${nameForPreview} -n htop 'htop'`;
  preview += `\n$ tmux attach -t ${nameForPreview}`;

  async function create() {
    setBusy(true);
    setError("");
    try {
      const s = await api.post("/api/sessions", { name: name || undefined, cwd, command, template });
      flash(`tmux new-session -s ${s.name} → attached`);
      await refreshSessions();
      selectSession(s.name);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>새 tmux 세션</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim2)" }}>{host ? host.label : ""}</div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: 0, color: "var(--dim2)", cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>
        <div style={{ padding: 18, display: "grid", gap: 14 }}>
          <div>
            <div style={labelStyle}>세션 이름</div>
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="deploy" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={labelStyle}>작업 디렉터리</div>
              <input className="field-input" value={cwd} onChange={(e) => setCwd(e.target.value)} />
            </div>
            <div>
              <div style={labelStyle}>시작 명령 (선택)</div>
              <input className="field-input" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npm run dev" />
            </div>
          </div>
          <div>
            <div style={{ ...labelStyle, marginBottom: 7 }}>레이아웃 템플릿</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {TEMPLATES.map((t) => {
                const active = template === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setTemplate(t.id)}
                    style={{
                      border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                      background: active ? "var(--accent2)" : "var(--panel2)",
                      borderRadius: 9, padding: 10, cursor: "pointer",
                    }}
                  >
                    <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: active ? "var(--accent)" : "var(--text)" }}>{t.label}</div>
                    <div style={{ fontSize: 10, color: "var(--dim2)", marginTop: 4, lineHeight: 1.5 }}>{t.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ background: "var(--termbg)", border: "1px solid var(--border)", borderRadius: 9, padding: "11px 12px", fontFamily: "var(--mono)", fontSize: 11.5, color: "#9fe6c2", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
            {preview}
          </div>
          {error && <div style={{ fontSize: 11.5, color: "var(--danger)", fontFamily: "var(--mono)" }}>{error}</div>}
        </div>
        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 9, justifyContent: "flex-end", background: "var(--panel2)" }}>
          <button className="btn plain" style={{ color: "var(--dim)" }} onClick={onClose}>취소</button>
          <button className="btn" onClick={create} disabled={busy}>{busy ? "생성 중…" : "생성하고 attach"}</button>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 10.5, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--dim2)", marginBottom: 6 };
