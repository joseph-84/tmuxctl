import React from "react";
import { useApp } from "../store.jsx";

export default function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return <div className="toast">{toast}</div>;
}
