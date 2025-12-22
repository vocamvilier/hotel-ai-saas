import { NavLink } from "react-router-dom";

const linkStyle = ({ isActive }) => ({
  display: "block",
  padding: "10px 14px",
  borderRadius: 10,
  fontWeight: isActive ? 700 : 500,
  opacity: isActive ? 1 : 0.75,
  background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
  textDecoration: "none",
  color: "white",
  cursor: "pointer",
});

export default function Sidebar() {
  return (
    <aside
      style={{
        width: 240,
        padding: 16,
        borderRight: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 20 }}>
        Hotel-AI
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <NavLink to="/overview" style={linkStyle}>Overview</NavLink>
        <NavLink to="/analytics" style={linkStyle}>Analytics</NavLink>
        <NavLink to="/live-chat" style={linkStyle}>Live Chat</NavLink>
        <NavLink to="/settings" style={linkStyle}>Settings</NavLink>
      </div>
    </aside>
  );
}
