export default function SectionHeader({ title, subtitle, right }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 950, fontSize: 18, letterSpacing: "-0.01em" }}>
          {title}
        </div>
        {subtitle ? (
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}
