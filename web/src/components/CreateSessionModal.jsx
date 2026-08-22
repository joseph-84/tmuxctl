import React, { useState } from "react";
import { useApp } from "../store.jsx";
import { api } from "../api.js";

export default function CreateSessionModal({ onClose }) {
  const { host, flash, refreshSessions, selectSession } = useApp();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const nameForPreview = name || "new-session";
  const preview = `$ tmux new-session -d -s ${nameForPreview} -c ~\n$ tmux attach -t ${nameForPreview}`;

  async function create() {
    setBusy(true);
    setError("");
    try {
      const s = await api.post("/api/sessions", { name: name || undefined });
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
      <div className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>새 tmux 세션</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim2)" }}>{host ? host.label : ""}</div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: 0, color: "var(--dim2)", cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>
        <div style={{ padding: 18, display: "grid", gap: 14 }}>
          <div>
            <div style={labelStyle}>세션 이름</div>
            <input
              className="field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="deploy"
              autoFocus
            />
          </div>
          <div style={{ background: "var(--termbg)", border: "1px solid var(--border)", borderRadius: 9, padding: "11px 12px", fontFamily: "var(--mono)", fontSize: 11.5, color: "#9fe6c2", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
            {preview}
          </div>
          {error && <div style={{ fontSize: 11.5, color: "var(--danger)", fontFamily: "var(--mono)" }}>{error}</div>}
        </div>
        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 9, justifyContent: "flex-end", background: "var(--panel2)" }}>
          <button className="btn plain" style={{ color: "var(--dim)" }} onClick={onClose}>취소</button>
          <button className="btn" onClick={create} disabled={busy || !name}>{busy ? "생성 중…" : "생성하고 attach"}</button>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 10.5, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--dim2)", marginBottom: 6 };
