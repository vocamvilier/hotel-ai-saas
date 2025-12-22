export default function LiveChat() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2 style={{ margin: 0 }}>Live Chat</h2>

      <div style={{ padding: 16, borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.6fr", gap: 10, opacity: 0.8, fontWeight: 700 }}>
          <div>Guest</div>
          <div>Language</div>
          <div>Started</div>
          <div>Status</div>
        </div>

        <div style={{ marginTop: 14, padding: 18, borderRadius: 12, background: "rgba(0,0,0,0.25)", opacity: 0.9 }}>
          No active conversations. Guest chats will appear here in real time.
        </div>
      </div>
    </div>
  );
}
