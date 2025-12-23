export default function StatusPill({ tone = "neutral", children }) {
  const cls = tone === "online" ? "pill pill-online" : "pill";
  return <span className={cls}>{children}</span>;
}
