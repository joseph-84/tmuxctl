import React, { useState } from "react";
import { AppProvider, useApp } from "./store.jsx";
import Login from "./views/Login.jsx";
import TopBar from "./components/TopBar.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Toast from "./components/Toast.jsx";
import CreateSessionModal from "./components/CreateSessionModal.jsx";
import AddUserModal from "./components/AddUserModal.jsx";
import Dashboard from "./views/Dashboard.jsx";
import Terminal from "./views/Terminal.jsx";
import Users from "./views/Users.jsx";
import ServerInfo from "./views/ServerInfo.jsx";
import Settings from "./views/Settings.jsx";

function Shell() {
  const { route } = useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);

  return (
    <div className="app-root">
      <TopBar onCreate={() => setCreateOpen(true)} />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <Sidebar onCreate={() => setCreateOpen(true)} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }}>
          {route === "dash" && <Dashboard onCreate={() => setCreateOpen(true)} />}
          {route === "term" && <Terminal />}
          {route === "users" && <Users onAddUser={() => setAddUserOpen(true)} />}
          {route === "server" && <ServerInfo />}
          {route === "settings" && <Settings />}
        </div>
      </div>
      {createOpen && <CreateSessionModal onClose={() => setCreateOpen(false)} />}
      {addUserOpen && <AddUserModal onClose={() => setAddUserOpen(false)} />}
      <Toast />
    </div>
  );
}

function Root() {
  const { me } = useApp();
  if (me === undefined) {
    return <div className="app-root" style={{ display: "grid", placeItems: "center", color: "var(--dim)" }}>불러오는 중…</div>;
  }
  if (!me) return <Login />;
  return <Shell />;
}

export default function App() {
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  );
}
