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
  // Μην σπάσουμε τίποτα: defaults + διαβάζουμε localStorage αν υπάρχει
  const hotel_id = localStorage.getItem("hotel_id") || "demo-hotel";
  const hotel_key = localStorage.getItem("hotel_key") || "demo_key_123";
  const days = Number(localStorage.getItem("days") || 7) || 7;
  return { hotel_id, hotel_key, days };
}

function Card({ title, children }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
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

  // “Πατάει Analytics -> boom νέα data”
  useEffect(() => {
    load();
  }, [load]);

  // Optional live feeling: refresh κάθε 15s
  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const kpis = useMemo(() => {
    // overview response: κρατάμε fallbacks γιατί δεν ξέρουμε ακριβώς shape εδώ
    const total_messages = o?.total_messages ?? o?.kpis?.total_messages ?? 0;
    const active_visitors = o?.active_visitors ?? o?.kpis?.active_visitors ?? 0;
    const booking_clicks = o?.booking_clicks ?? o?.kpis?.booking_clicks ?? 0;

    // MVP: για να μην δείχνει 2800% (multi-click tests), δείχνουμε clicks/visitor
    const clicksPerVisitor =
      active_visitors > 0 ? booking_clicks / active_visitors : 0;

    return { total_messages, active_visitors, booking_clicks, clicksPerVisitor };
  }, [o]);

  const chatsPerDay = useMemo(() => {
    // Προτιμάμε νέο πεδίο chats_per_day αν υπάρχει.
    if (Array.isArray(a?.chats_per_day)) return a.chats_per_day;

    // Fallback: derive από by_day (που ήδη επιστρέφεις) αθροίζοντας sources
    if (!Array.isArray(a?.by_day)) return [];

    return a.by_day.map((row) => {
      const { day, ...rest } = row;
      const total = Object.values(rest).reduce((sum, v) => sum + (Number(v) || 0), 0);
      return { date: day, count: total };
    });
  }, [a]);

  const peakHours = useMemo(() => {
    if (Array.isArray(a?.peak_hours)) return a.peak_hours;
    return [];
  }, [a]);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Analytics</h1>
        <button
          onClick={load}
          style={{
            marginLeft: "auto",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {err ? (
        <Card title="Error">
          <div>{err}</div>
        </Card>
      ) : loading && !a ? (
        <Card title="Loading">Fetching latest data…</Card>
      ) : (
        <>
          {/* KPI row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <Card title="Total messages">
              <div style={{ fontSize: 34, fontWeight: 700 }}>{kpis.total_messages}</div>
            </Card>

            <Card title="Active visitors (sessions)">
              <div style={{ fontSize: 34, fontWeight: 700 }}>{kpis.active_visitors}</div>
            </Card>

            <Card title="Booking clicks">
              <div style={{ fontSize: 34, fontWeight: 700 }}>{kpis.booking_clicks}</div>
            </Card>

            <Card title="Conversion (clicks/visitor)">
              <div style={{ fontSize: 34, fontWeight: 700 }}>
                {kpis.clicksPerVisitor.toFixed(2)}
              </div>
              <div style={{ opacity: 0.75, fontSize: 12 }}>
                (MVP metric to avoid inflated % on multi-click sessions)
              </div>
            </Card>
          </div>

          {/* Charts grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <Card title={`Chats per day (last ${days} days)`}>
              {chatsPerDay.length === 0 ? (
                <div style={{ opacity: 0.75 }}>
                  No data yet. Data will appear as guests start chatting.
                </div>
              ) : (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chatsPerDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card title="Peak hours">
              {peakHours.length === 0 ? (
                <div style={{ opacity: 0.75 }}>
                  No data yet. Data will appear as guests start chatting.
                </div>
              ) : (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={peakHours}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
