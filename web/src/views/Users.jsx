import React, { useEffect, useState } from "react";
import { useApp } from "../store.jsx";
import { api } from "../api.js";

const ROLES = [
  { id: "admin", label: "관리자" },
  { id: "operator", label: "운영자" },
  { id: "viewer", label: "열람" },
  { id: "none", label: "접근 없음" },
];

export default function Users({ onAddUser }) {
  const { me, host, flash } = useApp();
  const [users, setUsers] = useState([]);

  async function load() {
    try {
      setUsers(await api.get("/api/users"));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  async function changeRole(name, role) {
    try {
      await api.patch(`/api/users/${encodeURIComponent(name)}/role`, { role });
      flash(`${name} → ${ROLES.find((r) => r.id === role).label}`);
      load();
    } catch (err) {
      flash(err.message);
    }
  }

  async function deleteUser(name) {
    if (!confirm(`${name} 계정을 삭제할까요? (userdel -r, 홈 디렉터리까지 삭제됩니다)`)) return;
    try {
      await api.del(`/api/users/${encodeURIComponent(name)}`);
      flash("userdel -r " + name);
      load();
    } catch (err) {
      flash(err.message);
    }
  }

  const isAdmin = me.role === "admin";

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-.3px" }}>사용자 관리</div>
        <div style={{ flex: 1 }} />
        {isAdmin && <button className="btn" onClick={onAddUser}>+ 사용자 생성</button>}
      </div>
      <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 18 }}>
        {host ? host.label : "이 서버"}의 시스템 계정(<span style={{ fontFamily: "var(--mono)" }}>/etc/passwd</span>, uid ≥ 1000)과 tmuxctl 역할입니다.
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr .5fr 1fr 1.1fr 1fr .6fr", padding: "9px 15px", fontSize: 10, fontFamily: "var(--mono)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--dim2)", borderBottom: "1px solid var(--border)" }}>
          <div>계정</div><div>uid</div><div>셸</div><div>역할</div><div>상태</div><div style={{ textAlign: "right" }}>동작</div>
        </div>
        {users.map((u) => (
          <div key={u.name} style={{ display: "grid", gridTemplateColumns: "1.3fr .5fr 1fr 1.1fr 1fr .6fr", padding: "10px 15px", borderBottom: "1px solid var(--border)", alignItems: "center", fontSize: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--panel3)", display: "grid", placeItems: "center", fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim)", flex: "0 0 24px" }}>
                {u.name.slice(0, 2)}
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{u.name}</div>
            </div>
            <div style={{ fontFamily: "var(--mono)", color: "var(--dim)" }}>{u.uid}</div>
            <div style={{ fontFamily: "var(--mono)", color: "var(--dim)", fontSize: 11 }}>{u.shell}</div>
            <div>
              {isAdmin ? (
                <select className="field-input" style={{ padding: "4px 7px", fontSize: 11 }} value={u.role} onChange={(e) => changeRole(u.name, e.target.value)}>
                  {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              ) : (
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--dim)" }}>{u.roleLabel}</span>
              )}
            </div>
            <div style={{ fontFamily: "var(--mono)", color: u.online ? "var(--accent)" : "var(--dim2)", fontSize: 11 }}>{u.status}</div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              {isAdmin && <button className="btn plain" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => deleteUser(u.name)}>삭제</button>}
            </div>
          </div>
        ))}
        {users.length === 0 && <div style={{ padding: "18px 15px", fontSize: 12, color: "var(--dim2)" }}>uid ≥ 1000 계정이 없습니다.</div>}
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11.5, color: "var(--dim2)", lineHeight: 1.65, maxWidth: 660 }}>
        <span style={{ fontFamily: "var(--mono)", color: "var(--warn)" }}>!</span>
        <span>
          역할은 tmuxctl 안에서만 적용됩니다. 열람 역할은 <span style={{ fontFamily: "var(--mono)" }}>read-only</span>로 attach 되고, 삭제는{" "}
          <span style={{ fontFamily: "var(--mono)" }}>userdel -r</span>을 실행하므로 홈 디렉터리까지 지워집니다.
        </span>
      </div>
    </div>
  );
}
