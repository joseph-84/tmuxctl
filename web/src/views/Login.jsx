import React, { useState } from "react";
import { useApp } from "../store.jsx";

export default function Login() {
  const { login } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function doLogin() {
    if (!username || !password) return;
    setBusy(true);
    setError("");
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="app-root"
      style={{ display: "grid", placeItems: "center", background: "radial-gradient(120% 90% at 50% 0%, var(--panel2) 0%, var(--bg) 60%)" }}
    >
      <div style={{ width: 400, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 28, boxShadow: "0 24px 60px rgba(0,0,0,.45)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "var(--accent)", color: "var(--accentText)", fontFamily: "var(--mono)", fontWeight: 700, display: "grid", placeItems: "center", fontSize: 13 }}>t</div>
          <div style={{ fontWeight: 600, letterSpacing: "-.2px" }}>tmuxctl</div>
          <div style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim2)" }}>v0.1.0</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 11px", marginBottom: 14 }}>
          <span className="dot" style={{ background: "var(--accent)" }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{window.location.hostname}</span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim2)" }}>local</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--dim)", fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>시스템 계정</div>
        <input
          className="field-input"
          style={{ marginBottom: 8 }}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          autoFocus
        />
        <input
          className="field-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doLogin()}
          placeholder="password"
        />
        {error && <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--danger)", fontFamily: "var(--mono)" }}>{error}</div>}
        <button className="btn" style={{ width: "100%", marginTop: 16, padding: 11, fontSize: 13 }} onClick={doLogin} disabled={busy}>
          {busy ? "확인 중…" : "PAM 인증으로 로그인"}
        </button>
        <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11, color: "var(--dim2)", lineHeight: 1.6 }}>
          <span style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>›</span>
          <span>
            서버의 로컬 계정(<span style={{ fontFamily: "var(--mono)" }}>/etc/pam.d/tmuxctl</span>)으로 인증합니다. 별도 계정 생성 없음 — 셸 권한이 그대로 적용됩니다.
          </span>
        </div>
      </div>
    </div>
  );
}
