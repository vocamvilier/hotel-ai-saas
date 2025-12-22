export default function Analytics() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2 style={{ margin: 0 }}>Analytics</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <Card title="Chats per day" />
        <Card title="Peak hours" />
        <Card title="Top FAQs" />
        <Card title="Conversion" />
      </div>
    </div>
  );
}

function Card({ title }) {
  return (
    <div style={{ padding: 16, borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", minHeight: 120 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ opacity: 0.8 }}>
        No data yet. Data will appear as guests start chatting.
      </div>
    </div>
  );
}
