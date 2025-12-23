import { NavLink } from "react-router-dom";

function Item({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
    >
      {children}
    </NavLink>
  );
}

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">AI</div>
        <div style={{ minWidth: 0 }}>
          <div className="brand-title">Hotel-AI</div>
          <div className="brand-sub">Client-ready dashboard</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <Item to="/overview">Overview</Item>
        <Item to="/analytics">Analytics</Item>
        <Item to="/live-chat">Live Chat</Item>
        <Item to="/settings">Settings</Item>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-help">
          <div className="help-title">Tip</div>
          <div className="help-text">
            Show this dashboard to a hotel manager — it speaks ROI, not tech.
          </div>
        </div>
      </div>
    </aside>
  );
}
