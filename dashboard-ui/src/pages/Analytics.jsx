import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

const API_BASE = "https://hotel-ai-saas.onrender.com";

function getTenant() {
  // Safe defaults + allow overrides if you store these later
  const hotel_id = localStorage.getItem("hotel_id") || "demo-hotel";
  const hotel_key = localStorage.getItem("hotel_key") || "demo_key_123";
  const days = Number(localStorage.getItem("days") || 7) || 7;
  return { hotel_id, hotel_key, days };
}

export default function Analytics() {
  const [a, setA] = useState(null); // /api/analytics
  const [o, setO] = useState(null); // /api/dashboard/overview
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const { hotel_id, hotel_key, days } = useMemo(() => getTenant(), []);

  const load = useCallback(async () => {
    try {
      setErr("");
      setLoading(true);

      const qs = `hotel_id=${encodeURIComponent(hotel_id)}&hotel_key=${encodeURIComponent(
        hotel_key
      )}&days=${encodeURIComponent(days)}`;

      const [ra, ro] = await Promise.all([
        fetch(`${API_BASE}/api/analytics?${qs}`),
        fetch(`${API_BASE}/api/dashboard/overview?${qs}`),
      ]);

      const ja = await ra.json();
      const jo = await ro.json();

      setA(ja);
      setO(jo);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [hotel_id, hotel_key, days]);

  // “Click Analytics -> boom latest data”
  useEffect(() => {
    load();
  }, [load]);

  // Optional: live feel refresh
  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const kpis = useMemo(() => {
    // Overview shape safe fallbacks
    const total_messages = o?.total_messages ?? o?.kpis?.total_messages ?? 0;
    const active_visitors = o?.active_visitors ?? o?.kpis?.active_visitors ?? 0;
    const booking_clicks = o?.booking_clicks ?? o?.kpis?.booking_clicks ?? 0;

    // MVP conversion that doesn’t blow up with multi-click sessions
    const clicksPerVisitor =
      active_visitors > 0 ? booking_clicks / active_visitors : 0;

    return { total_messages, active_visitors, booking_clicks, clicksPerVisitor };
  }, [o]);

  const chatsPerDay = useMemo(() => {
    // Prefer new field
    if (Array.isArray(a?.chats_per_day)) return a.chats_per_day;

    // Fallback: derive from by_day (assistant replies by source) by summing sources
    if (!Array.isArray(a?.by_day)) return [];
    return a.by_day.map((row) => {
      const { day, ...rest } = row;
      const total = Object.values(rest).reduce(
        (sum, v) => sum + (Number(v) || 0),
        0
      );
      return { date: day, count: total };
    });
  }, [a]);

  const peakHours = useMemo(() => {
    if (Array.isArray(a?.peak_hours)) return a.peak_hours;
    return [];
  }, [a]);

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h1 style={{ margin: 0 }}>Analytics</h1>

        <button onClick={load} style={{ marginLeft: "auto" }}>
  Refresh
</button>

      </div>

      {err ? (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Error</div>
          <div>{err}</div>
        </div>
      ) : loading && !a ? (
        <div className="card">Fetching latest data…</div>
      ) : (
        <>
          {/* KPI row (glow) */}
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
              <div className="kpi-sub">Last {days} days</div>
            </div>

            <div className="card kpi">
              <div className="kpi-label">Active visitors (sessions)</div>
              <div className="kpi-value">{kpis.active_visitors}</div>
              <div className="kpi-sub">Last {days} days</div>
            </div>

            <div className="card kpi">
              <div className="kpi-label">Booking clicks</div>
              <div className="kpi-value">{kpis.booking_clicks}</div>
              <div className="kpi-sub">From /api/events</div>
            </div>

            <div className="card kpi">
              <div className="kpi-label">Conversion (clicks/visitor)</div>
              <div className="kpi-value">
                {kpis.active_visitors === 0 ? "—" : kpis.clicksPerVisitor.toFixed(2)}
              </div>
              <div className="kpi-sub">
                MVP metric to avoid inflated % on multi-click sessions
              </div>
            </div>
          </div>

          {/* Charts */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 10 }}>
                Guest conversations per day (last {days} days)
              </div>

              {chatsPerDay.length === 0 ? (
                <div style={{ opacity: 0.75 }}>
                  No data yet. Data will appear as guests start chatting.
                </div>
              ) : (
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chatsPerDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#6ea8ff"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#6ea8ff" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 10 }}>
                When guests chat most (peak hours)
              </div>

              {peakHours.length === 0 ? (
                <div style={{ opacity: 0.75 }}>
                  No data yet. Data will appear as guests start chatting.
                </div>
              ) : (
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={peakHours}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        fill="rgba(110,168,255,0.65)"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
