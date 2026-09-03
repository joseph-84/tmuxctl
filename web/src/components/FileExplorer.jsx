import React, { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../store.jsx";
import { api } from "../api.js";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  const units = ["K", "M", "G", "T"];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 ? 1 : 0)}${units[i]}`;
}

export default function FileExplorer() {
  const { me, flash } = useApp();
  const canEdit = me.role !== "viewer";
  const [dir, setDir] = useState(null); // null = server default (home dir)
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback((path) => {
    api
      .get(`/api/files?path=${encodeURIComponent(path || "")}`)
      .then((d) => {
        setData(d);
        setDir(d.path);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load(dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doUpload(fileList) {
    if (!fileList || fileList.length === 0) return;
    const form = new FormData();
    for (const f of fileList) form.append("files", f);
    try {
      await api.upload(`/api/files/upload?path=${encodeURIComponent(dir || "")}`, form);
      flash(`${fileList.length}개 파일 업로드 완료`);
      load(dir);
    } catch (err) {
      flash(err.message);
    }
  }

  async function doDelete(e, name) {
    e.stopPropagation();
    if (!confirm(`${name} 파일을 삭제할까요?`)) return;
    try {
      await api.del(`/api/files?path=${encodeURIComponent(dir + "/" + name)}`);
      load(dir);
    } catch (err) {
      flash(err.message);
    }
  }

  function downloadUrl(name) {
    return `/api/files/download?path=${encodeURIComponent(dir + "/" + name)}`;
  }

  return (
    <div
      style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, border: dragOver ? "1px dashed var(--accent)" : "1px dashed transparent", borderRadius: 8 }}
      onDragOver={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setDragOver(false);
        doUpload(e.dataTransfer.files);
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 4px 6px", fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--dim2)" }}>
        {data && data.parent && (
          <span onClick={() => load(data.parent)} style={{ cursor: "pointer", color: "var(--accent)" }} title="상위 폴더">
            ↑
          </span>
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={dir || ""}>
          {dir || "…"}
        </span>
        {canEdit && (
          <span onClick={() => fileInputRef.current && fileInputRef.current.click()} style={{ cursor: "pointer", color: "var(--accent)" }} title="파일 업로드">
            ＋
          </span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            doUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {error && <div style={{ padding: "8px 6px", fontSize: 11, color: "var(--danger)" }}>{error}</div>}
        {data &&
          data.entries.map((ent) => (
            <div
              key={ent.name}
              onClick={() => (ent.isDir ? load(dir + "/" + ent.name) : window.open(downloadUrl(ent.name), "_blank"))}
              title={ent.isDir ? "열기" : "다운로드"}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 6px", borderRadius: 6, cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 11, width: 14, textAlign: "center", color: "var(--dim2)" }}>{ent.isDir ? "📁" : "📄"}</span>
              <span style={{ fontSize: 11.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ent.name}</span>
              {!ent.isDir && (
                <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--dim2)" }}>{formatSize(ent.size)}</span>
              )}
              {canEdit && !ent.isDir && (
                <button
                  onClick={(e) => doDelete(e, ent.name)}
                  title="삭제"
                  style={{ background: "none", border: 0, color: "var(--dim2)", cursor: "pointer", fontSize: 10, padding: "0 2px" }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        {data && data.entries.length === 0 && (
          <div style={{ textAlign: "center", padding: "16px 10px", fontSize: 11, color: "var(--dim2)" }}>비어 있음</div>
        )}
      </div>
    </div>
  );
}
