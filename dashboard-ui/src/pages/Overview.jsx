import { useEffect, useMemo, useState } from "react";

const API_BASE = "https://hotel-ai-saas.onrender.com";

function getTenant() {
  const hotel_id = localStorage.getItem("hotel_id") || "demo-hotel";
  const hotel_key = localStorage.getItem("hotel_key") || "demo_key_123";
  const days = Number(localStorage.getItem("days") || 7) || 7;
  return { hotel_id, hotel_key, days };
}

export default function Overview() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const { hotel_id, hotel_key, days } = useMemo(() => getTenant(), []);

  useEffect(() => {
    async function load() {
      try {
        setErr("");
        setLoading(true);
        const qs = `hotel_id=${encodeURIComponent(hotel_id)}&hotel_key=${encodeURIComponent(
          hotel_key
        )}&days=${encodeURIComponent(days)}`;
        const r = await fetch(`${API_BASE}/api/dashboard/overview?${qs}`);
        const j = await r.json();
        setData(j);
      } catch (e) {
        setErr(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [hotel_id, hotel_key, days]);

  const kpis = useMemo(() => {
    const total_messages = data?.total_messages ?? data?.kpis?.total_messages ?? 0;
    const active_visitors = data?.active_visitors ?? data?.kpis?.active_visitors ?? 0;
    const booking_clicks = data?.booking_clicks ?? data?.kpis?.booking_clicks ?? 0;
    const clicksPerVisitor =
      active_visitors > 0 ? booking_clicks / active_visitors : null;

    return { total_messages, active_visitors, booking_clicks, clicksPerVisitor };
  }, [data]);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Overview</h1>
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Last {days} days · Tenant: <b>{hotel_id}</b>
        </div>
      </div>

      {err ? (
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Error</div>
          <div>{err}</div>
        </div>
      ) : loading ? (
        <div className="card">Loading…</div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div className="card kpi">
              <div className="kpi-label">Total messages</div>
              <div className="kpi-value">{kpis.total_messages}</div>
              <div className="kpi-sub">All chat messages</div>
            </div>

            <div className="card kpi">
              <div className="kpi-label">Active visitors (sessions)</div>
              <div className="kpi-value">{kpis.active_visitors}</div>
              <div className="kpi-sub">Unique sessions</div>
            </div>

            <div className="card kpi">
              <div className="kpi-label">Booking clicks</div>
              <div className="kpi-value">{kpis.booking_clicks}</div>
              <div className="kpi-sub">CTA “Book Now”</div>
            </div>

            <div className="card kpi">
              <div className="kpi-label">Conversion (clicks/visitor)</div>
              <div className="kpi-value">
                {kpis.clicksPerVisitor === null ? "—" : kpis.clicksPerVisitor.toFixed(2)}
              </div>
              <div className="kpi-sub">MVP metric</div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Events snapshot</div>
            <pre style={{ margin: 0, fontSize: 12, overflow: "auto" }}>
              {JSON.stringify(data?.events_by_type ?? {}, null, 2)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
