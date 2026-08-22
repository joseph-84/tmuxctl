import React, { useEffect, useState } from "react";
import { useApp } from "../store.jsx";
import { api } from "../api.js";

export default function Settings() {
  const { me, flash } = useApp();
  const [data, setData] = useState(null);
  const canEdit = me.role !== "viewer";

  async function load() {
    try {
      setData(await api.get("/api/settings"));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(field) {
    if (!canEdit) return;
    try {
      const res = await api.patch("/api/settings", { key: field.key, value: !field.value });
      setData((d) => ({ ...d, ...res }));
      flash(`${field.label} → ${!field.value ? "on" : "off"}`);
    } catch (err) {
      flash(err.message);
    }
  }

  if (!data) return null;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px" }}>
      <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-.3px", marginBottom: 18 }}>설정</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 900 }}>
        <div className="card" style={{ padding: "6px 15px 12px" }}>
          {data.fields.map((f) => (
            <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{f.label}</div>
                <div style={{ fontSize: 10.5, color: "var(--dim2)", marginTop: 3, fontFamily: "var(--mono)" }}>{f.hint}</div>
              </div>
              <div
                onClick={() => toggle(f)}
                style={{
                  width: 38, height: 21, borderRadius: 11, background: f.value ? "var(--accent)" : "var(--panel3)",
                  position: "relative", cursor: canEdit ? "pointer" : "default", flex: "0 0 38px", transition: "background .15s",
                }}
              >
                <div style={{ position: "absolute", top: 2, left: f.value ? 19 : 2, width: 17, height: 17, borderRadius: "50%", background: f.value ? "var(--accentText)" : "var(--dim)", transition: "left .15s" }} />
              </div>
            </div>
          ))}
        </div>
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ fontWeight: 600, fontSize: 12.5 }}>~/.tmux.conf</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim2)" }}>미리보기 · 위 설정에서 생성</div>
          </div>
          <div style={{ padding: "13px 14px", fontFamily: "var(--mono)", fontSize: 11.5, lineHeight: 1.8, background: "var(--termbg)", color: "#d6dbe4", minHeight: 200 }}>
            {data.conf.map((c, i) => (
              <div key={i} style={{ whiteSpace: "pre-wrap", color: c.color }}>{c.text || " "}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
