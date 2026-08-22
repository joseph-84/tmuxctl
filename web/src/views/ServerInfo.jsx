import React, { useEffect, useState } from "react";
import { useApp } from "../store.jsx";
import { api } from "../api.js";

export default function ServerInfo() {
  const { host } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const d = await api.get("/api/server-info");
        if (alive) setData(d);
      } catch {
        /* ignore */
      }
    }
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px" }}>
      <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-.3px", marginBottom: 4 }}>이 서버</div>
      <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 18 }}>
        tmuxctl 은 이 머신에서 직접 실행되며, 로그인한 계정의 권한으로 로컬 tmux 서버 소켓에만 접근합니다.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 900 }}>
        <div className="card" style={{ padding: "6px 15px 12px" }}>
          {(data ? data.info : []).map((i) => (
            <div key={i.k} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--dim2)", fontFamily: "var(--mono)", width: 120, flex: "0 0 120px", textTransform: "uppercase", letterSpacing: ".05em" }}>{i.k}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{i.v}</div>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 15 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 5 }}>동작 방식</div>
          <div style={{ fontSize: 12, color: "var(--dim)", lineHeight: 1.75 }}>
            tmuxctl 데몬이 이 서버에서 <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>systemd --user</span> 로 돌고, 브라우저와는 websocket 한 개로 연결됩니다. 세션·윈도우·페인은 모두 로컬{" "}
            <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>tmux</span> 명령을 그대로 호출한 결과이므로, SSH 로 들어와{" "}
            <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>tmux attach</span> 한 것과 같은 세션을 봅니다.
          </div>
          <div style={{ marginTop: 14, paddingTop: 13, borderTop: "1px solid var(--border)", display: "grid", gap: 7 }}>
            {(data ? data.daemon : []).map((d) => (
              <div key={d.k} style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "var(--mono)", fontSize: 11.5 }}>
                <span className="dot" style={{ background: d.ok ? "var(--accent)" : "var(--warn)" }} />
                <span style={{ color: "var(--dim)" }}>{d.k}</span>
                <span style={{ marginLeft: "auto", color: d.ok ? "var(--accent)" : "var(--warn)" }}>{d.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
