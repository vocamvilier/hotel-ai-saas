export default function Settings() {
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
      <h2 style={{ margin: 0 }}>Settings</h2>

      <Section title="Hotel profile">
        <Field label="Hotel name" value="demo-hotel" />
        <Field label="Languages" value="EN, EL" />
        <Field label="Hours" value="24/7" />
      </Section>

      <Section title="Widget">
        <Field label="Status" value="Online" />
        <Field label="API base" value="https://hotel-ai-saas.onrender.com" />
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ padding: 16, borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" }}>
      <div style={{ fontWeight: 800, marginBottom: 12 }}>{title}</div>
      <div style={{ display: "grid", gap: 10 }}>{children}</div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ opacity: 0.75, fontSize: 13 }}>{label}</div>
      <input
        value={value}
        disabled
        readOnly
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.25)",
          color: "white",
          opacity: 0.9,
        }}
      />
    </div>
  );
}
