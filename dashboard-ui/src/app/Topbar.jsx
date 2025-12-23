import { useMemo } from "react";
import StatusPill from "../components/StatusPill.jsx";
import { getTenant } from "../lib/tenant.js";

export default function Topbar() {
  const t = useMemo(() => getTenant(), []);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-label">Hotel</span>
        <select
          className="topbar-select"
          value={t.hotel_id}
          onChange={(e) => {
            localStorage.setItem("hotel_id", e.target.value);
            window.location.reload();
          }}
        >
          <option value="demo-hotel">demo-hotel</option>
          <option value="olympia-athens">olympia-athens</option>
        </select>

        <StatusPill tone="online">Widget: Online</StatusPill>
      </div>

      <div className="topbar-right">
        <button
          className="icon-btn"
          title="Refresh"
          onClick={() => window.location.reload()}
        >
          ↻
        </button>

        <button className="user-btn" title="User">
          <span className="user-avatar">N</span>
          <span className="user-name">Nick</span>
          <span className="user-caret">▾</span>
        </button>
      </div>
    </header>
  );
}
