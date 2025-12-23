import SectionHeader from "./SectionHeader";

export default function ChartCard({ title, subtitle, children, right }) {
  return (
    <div className="card">
      <SectionHeader title={title} subtitle={subtitle} right={right} />
      <div style={{ height: 280, marginTop: 10 }}>{children}</div>
    </div>
  );
}
