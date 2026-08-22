import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "./api.js";

const Ctx = createContext(null);

export function useApp() {
  return useContext(Ctx);
}

export function AppProvider({ children }) {
  const [me, setMe] = useState(undefined); // undefined = still checking, null = logged out
  const [theme, setTheme] = useState(() => localStorage.getItem("tmuxctl.theme") || "dark");
  const [toast, setToast] = useState("");
  const [route, setRoute] = useState("dash");
  const [sessions, setSessions] = useState([]);
  const [host, setHost] = useState(null);
  const [selected, setSelected] = useState(null);
  const toastTimer = useRef(null);

  const flash = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const data = await api.get("/api/me");
      setMe(data);
    } catch {
      setMe(null);
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await api.get("/api/sessions"));
    } catch {
      /* not logged in yet, or transient error — next poll will retry */
    }
  }, []);

  const refreshHost = useCallback(async () => {
    try {
      setHost(await api.get("/api/host"));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("tmuxctl.theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!me) return;
    refreshSessions();
    refreshHost();
    const t = setInterval(() => {
      refreshSessions();
      refreshHost();
    }, 4000);
    return () => clearInterval(t);
  }, [me, refreshSessions, refreshHost]);

  const login = useCallback(
    async (username, password) => {
      const data = await api.post("/api/login", { username, password });
      setMe(data);
      return data;
    },
    []
  );

  const logout = useCallback(async () => {
    await api.post("/api/logout");
    setMe(null);
    setRoute("dash");
  }, []);

  const value = {
    me,
    login,
    logout,
    theme,
    toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    toast,
    flash,
    route,
    setRoute,
    sessions,
    refreshSessions,
    host,
    selected,
    selectSession: (name) => {
      setSelected(name);
      setRoute("term");
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
