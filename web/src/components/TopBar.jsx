import React from "react";
import { useApp } from "../store.jsx";

const ROLE_LABEL = { admin: "관리자", operator: "운영자", viewer: "열람", none: "접근 없음" };

export default function TopBar({ onCreate }) {
  const { me, host, theme, toggleTheme, logout } = useApp();

  return (
    <div style={{ height: 48, flex: "0 0 48px", borderBottom: "1px solid var(--border)", background: "var(--panel)", display: "flex", alignItems: "center", padding: "0 12px", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--accent)", color: "var(--accentText)", fontFamily: "var(--mono)", fontWeight: 700, display: "grid", placeItems: "center", fontSize: 12 }}>t</div>
        <div style={{ fontWeight: 600, fontSize: 13, letterSpacing: "-.2px" }}>tmuxctl</div>
      </div>
      <div style={{ width: 1, height: 20, background: "var(--border)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 9px", borderRadius: 7, background: "var(--panel2)", border: "1px solid var(--border)" }}>
        <span className="dot" style={{ background: "var(--accent)", animation: "pulse 2.4s infinite" }} />
        <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{host ? host.label : "…"}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim2)" }}>{host ? host.os : ""}</span>
      </div>
      <div style={{ flex: 1 }} />
      {me.role !== "viewer" && (
        <button className="btn" onClick={onCreate}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 13 }}>+</span> 새 세션
        </button>
      )}
      <button className="btn ghost" title="테마" style={{ width: 30, height: 30, padding: 0 }} onClick={toggleTheme}>
        {theme === "dark" ? "☾" : "☀"}
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 6, borderLeft: "1px solid var(--border)" }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--panel3)", display: "grid", placeItems: "center", fontFamily: "var(--mono)", fontSize: 11, color: "var(--dim)" }}>
          {(me.username || "u").slice(0, 2)}
        </div>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{me.username}</div>
          <div style={{ fontSize: 9, color: "var(--dim2)" }}>{ROLE_LABEL[me.role]}</div>
        </div>
        <button className="btn" style={{ background: "none", padding: 4, fontSize: 11, color: "var(--dim2)", fontWeight: 400 }} onClick={logout}>
          종료
        </button>
      </div>
    </div>
  );
}
