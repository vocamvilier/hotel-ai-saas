export default function EmptyState({ title = "No data yet", text }) {
  return (
    <div className="card" style={{ borderStyle: "dashed" }}>
      <div style={{ fontWeight: 950 }}>{title}</div>
      {text ? (
        <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 13 }}>
          {text}
        </div>
      ) : null}
    </div>
  );
}
