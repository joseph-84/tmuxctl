import React, { useState } from "react";
import { useApp } from "../store.jsx";
import { api } from "../api.js";

const SHELLS = ["/bin/zsh", "/bin/bash", "/usr/bin/fish", "/usr/sbin/nologin"];
const ROLES = [
  { id: "admin", label: "관리자" },
  { id: "operator", label: "운영자" },
  { id: "viewer", label: "열람" },
];

export default function AddUserModal({ onClose }) {
  const { flash } = useApp();
  const [name, setName] = useState("");
  const [shell, setShell] = useState("/bin/zsh");
  const [role, setRole] = useState("operator");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  const preview = `$ useradd -m -s ${shell} ${name || "<name>"}\n$ tmuxctl role set ${name || "<name>"} ${role}`;

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/api/users", { name, shell, role });
      setCreated(res);
      flash(`useradd -m ${name} 완료`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>시스템 사용자 생성</div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: 0, color: "var(--dim2)", cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>
        {created ? (
          <div style={{ padding: 18, display: "grid", gap: 12 }}>
            <div style={{ fontSize: 12.5 }}>
              <b style={{ fontFamily: "var(--mono)" }}>{created.name}</b> 계정이 생성되었습니다. 아래 임시 비밀번호는 다시 볼 수 없으니 지금 전달하세요 (최초 로그인 시 변경 필요).
            </div>
            <div style={{ background: "var(--termbg)", border: "1px solid var(--border)", borderRadius: 9, padding: "11px 12px", fontFamily: "var(--mono)", fontSize: 13, color: "#9fe6c2" }}>
              {created.tempPassword}
            </div>
          </div>
        ) : (
          <div style={{ padding: 18, display: "grid", gap: 13 }}>
            <div>
              <div style={labelStyle}>계정명</div>
              <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="jihoon" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>셸</div>
                <select className="field-input" value={shell} onChange={(e) => setShell(e.target.value)}>
                  {SHELLS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={labelStyle}>역할</div>
                <select className="field-input" value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ background: "var(--termbg)", border: "1px solid var(--border)", borderRadius: 9, padding: "11px 12px", fontFamily: "var(--mono)", fontSize: 11.5, color: "#9fe6c2", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
              {preview}
            </div>
            {error && <div style={{ fontSize: 11.5, color: "var(--danger)", fontFamily: "var(--mono)" }}>{error}</div>}
          </div>
        )}
        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 9, justifyContent: "flex-end", background: "var(--panel2)" }}>
          {created ? (
            <button className="btn" onClick={onClose}>닫기</button>
          ) : (
            <>
              <button className="btn plain" style={{ color: "var(--dim)" }} onClick={onClose}>취소</button>
              <button className="btn" onClick={submit} disabled={busy || !name}>{busy ? "생성 중…" : "생성"}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 10.5, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--dim2)", marginBottom: 6 };
