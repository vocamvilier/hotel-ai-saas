import { NavLink } from "react-router-dom";

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">HA</div>
        <div>
          <div className="brand-title">Hotel-AI</div>
          <div className="brand-sub">Dashboard</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink end to="/" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
          Overview
        </NavLink>

        <NavLink to="/analytics" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
          Analytics
        </NavLink>

        <NavLink to="/live-chat" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
          Live Chat
        </NavLink>

        <NavLink to="/settings" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
          Settings
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-help">
          <div className="help-title">Tip</div>
          <div className="help-text">Use the hotel selector to switch tenants.</div>
        </div>
      </div>
    </aside>
  );
}
