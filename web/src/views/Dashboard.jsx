import React, { useEffect, useState } from "react";
import { useApp } from "../store.jsx";
import { api } from "../api.js";

const KIND_COLOR = { new: "var(--accent)", warn: "var(--warn)", attach: "var(--dim)", exit: "var(--dim)", load: "var(--warn)" };

function timeOf(iso) {
  const d = new Date(iso);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

export default function Dashboard({ onCreate }) {
  const { me, host, sessions, refreshSessions, flash, selectSession } = useApp();
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [u, a] = await Promise.all([api.get("/api/users"), api.get("/api/activity")]);
        if (alive) {
          setUsers(u);
          setActivity(a);
        }
      } catch {
        /* ignore transient errors */
      }
    }
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  async function killSession(name) {
    if (!confirm(`${name} 세션을 종료할까요? (tmux kill-session)`)) return;
    try {
      await api.del(`/api/sessions/${encodeURIComponent(name)}`);
      flash("tmux kill-session -t " + name);
      refreshSessions();
    } catch (err) {
      flash(err.message);
    }
  }

  const totalPanes = sessions.reduce((n, s) => n + s.paneCount, 0);
  const onlineUsers = users.filter((u) => u.online);
  const stats = [
    { label: "활성 세션", value: sessions.length, unit: "개", sub: `${sessions.filter((s) => s.attached).length}개 attached` },
    { label: "윈도우", value: sessions.reduce((n, s) => n + s.windowCount, 0), unit: "", sub: `${totalPanes}개 페인` },
    { label: "접속 사용자", value: onlineUsers.length, unit: "명", sub: `${users.length}개 계정`, color: "var(--accent)" },
    { label: "load avg", value: host ? host.load : "-", unit: "1m", sub: `uptime ${host ? host.uptime : "-"}` },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-.3px" }}>대시보드</div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--dim2)" }}>{host ? `${host.label} · ${host.os}` : ""}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 22 }}>
        {stats.map((st) => (
          <div key={st.label} className="card" style={{ padding: "14px 15px" }}>
            <div style={{ fontSize: 10.5, fontFamily: "var(--mono)", letterSpacing: ".06em", color: "var(--dim2)", textTransform: "uppercase" }}>{st.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 9 }}>
              <div style={{ fontSize: 26, fontWeight: 600, fontFamily: "var(--mono)", letterSpacing: "-1px", color: st.color || "var(--text)" }}>{st.value}</div>
              <div style={{ fontSize: 11, color: "var(--dim2)" }}>{st.unit}</div>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--dim)", marginTop: 6 }}>{st.sub}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "12px 15px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>세션</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim2)" }}>tmux list-sessions</div>
          <div style={{ flex: 1 }} />
          {me.role !== "viewer" && (
            <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 11 }} onClick={onCreate}>+ 새 세션</button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr .7fr .7fr 1fr 1fr .8fr", padding: "8px 15px", fontSize: 10, fontFamily: "var(--mono)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--dim2)", borderBottom: "1px solid var(--border)" }}>
          <div>세션</div><div>윈도우</div><div>페인</div><div>소유자</div><div>생성</div><div style={{ textAlign: "right" }}>동작</div>
        </div>
        {sessions.map((s) => (
          <div key={s.name} style={{ display: "grid", gridTemplateColumns: "1.4fr .7fr .7fr 1fr 1fr .8fr", padding: "11px 15px", borderBottom: "1px solid var(--border)", alignItems: "center", fontSize: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span className="dot" style={{ background: s.attached ? "var(--accent)" : "var(--dim2)" }} />
              <span onClick={() => selectSession(s.name)} style={{ fontFamily: "var(--mono)", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
              <span style={{ fontSize: 9.5, fontFamily: "var(--mono)", padding: "2px 5px", borderRadius: 4, background: s.attached ? "var(--accent2)" : "var(--panel2)", color: s.attached ? "var(--accent)" : "var(--dim2)" }}>
                {s.attached ? "attached" : "detached"}
              </span>
            </div>
            <div style={{ fontFamily: "var(--mono)", color: "var(--dim)" }}>{s.windowCount}</div>
            <div style={{ fontFamily: "var(--mono)", color: "var(--dim)" }}>{s.paneCount}</div>
            <div style={{ fontFamily: "var(--mono)", color: "var(--dim)" }}>{s.owner}</div>
            <div style={{ fontFamily: "var(--mono)", color: "var(--dim2)", fontSize: 11 }}>{s.age} 전</div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button className="btn ghost" style={{ padding: "4px 9px", fontSize: 11 }} onClick={() => selectSession(s.name)}>attach</button>
              {me.role !== "viewer" && (
                <button className="btn plain" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => killSession(s.name)}>kill</button>
              )}
            </div>
          </div>
        ))}
        {sessions.length === 0 && <div style={{ padding: "18px 15px", fontSize: 12, color: "var(--dim2)" }}>세션이 없습니다.</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card" style={{ padding: 15 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>최근 활동</div>
          {activity.slice(0, 8).map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--border)", alignItems: "baseline" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--dim2)", width: 44, flex: "0 0 44px" }}>{timeOf(a.time)}</div>
              <div style={{ flex: 1, fontSize: 12, color: "var(--dim)", lineHeight: 1.5 }}>{a.text}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: KIND_COLOR[a.kind] || "var(--dim)" }}>{a.kind}</div>
            </div>
          ))}
          {activity.length === 0 && <div style={{ fontSize: 12, color: "var(--dim2)" }}>아직 기록된 활동이 없습니다.</div>}
        </div>
        <div className="card" style={{ padding: 15 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>접속 중인 사용자</div>
          {onlineUsers.map((u) => (
            <div key={u.name} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--panel3)", display: "grid", placeItems: "center", fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim)" }}>
                {u.name.slice(0, 2)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{u.name}</div>
              </div>
              <div style={{ fontSize: 10, fontFamily: "var(--mono)", padding: "2px 6px", borderRadius: 4, background: "var(--panel2)", color: "var(--dim)" }}>{u.roleLabel}</div>
            </div>
          ))}
          {onlineUsers.length === 0 && <div style={{ fontSize: 12, color: "var(--dim2)" }}>현재 접속 중인 사용자가 없습니다.</div>}
        </div>
      </div>
    </div>
  );
}
