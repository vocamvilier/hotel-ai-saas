const Item = ({ label, active = false }) => (
  <div
    style={{
      padding: "10px 14px",
      borderRadius: 10,
      fontWeight: active ? 700 : 500,
      opacity: active ? 1 : 0.75,
      background: active ? "rgba(255,255,255,0.08)" : "transparent",
      cursor: "pointer",
    }}
  >
    {label}
  </div>
);

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
        <Item label="Overview" active />
        <Item label="Analytics" />
        <Item label="Live Chat" />
        <Item label="Settings" />
      </div>
    </aside>
  );
}
