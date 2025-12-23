export default function Topbar() {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-label">Hotel</div>
        <select className="topbar-select" defaultValue="demo-hotel">
          <option value="demo-hotel">demo-hotel</option>
        </select>

        <span className="topbar-dot" />

        <div className="topbar-status">
          <span className="pill pill-online">Widget: Online</span>
        </div>
      </div>

      <div className="topbar-right">
        <button className="icon-btn" title="Notifications" aria-label="Notifications">
          🔔
        </button>

        <button className="user-btn" aria-label="User menu">
          <span className="user-avatar">N</span>
          <span className="user-name">Nick</span>
          <span className="user-caret">▾</span>
        </button>
      </div>
    </header>
  );
}
