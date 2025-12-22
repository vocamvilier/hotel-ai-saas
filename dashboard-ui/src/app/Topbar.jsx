export default function Topbar() {
  return (
    <header
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ opacity: 0.7 }}>Hotel</span>
        <select defaultValue="demo-hotel">
          <option value="demo-hotel">demo-hotel</option>
        </select>

        <span style={{ opacity: 0.6 }}>•</span>
        <span style={{ fontWeight: 600 }}>Widget: Online</span>
      </div>

      <div style={{ opacity: 0.8 }}>
        Nick ▾
      </div>
    </header>
  );
}
