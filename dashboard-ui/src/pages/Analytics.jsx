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

import { apiGet } from "../lib/apiClient.js";
import { getTenant } from "../lib/tenant.js";
import { useAutoRefresh } from "../hooks/useAutoRefresh.js";
import KpiCard from "../components/KpiCard.jsx";
import ChartCard from "../components/ChartCard.jsx";
import EmptyState from "../components/EmptyState.jsx";
import SectionHeader from "../components/SectionHeader.jsx";

export default function Analytics() {
  const { days } = useMemo(() => getTenant(), []);

  const [a, setA] = useState(null); // /api/analytics
  const [o, setO] = useState(null); // /api/dashboard/overview
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      setErr("");
      setLoading(true);
      const [ja, jo] = await Promise.all([
        apiGet("/api/analytics", { days }),
        apiGet("/api/dashboard/overview", { days }),
      ]);
      setA(ja);
      setO(jo);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load(); // click analytics -> boom latest
  }, [load]);

  useAutoRefresh(load, 15000, true);

  const kpis = useMemo(() => {
    const total_messages = o?.kpis?.total_messages ?? o?.total_messages ?? 0;
    const active_visitors = o?.kpis?.unique_sessions ?? o?.unique_sessions ?? 0;
    const booking_clicks = o?.kpis?.booking_clicks ?? o?.booking_clicks ?? 0;
    const clicksPerVisitor = active_visitors > 0 ? booking_clicks / active_visitors : null;
    return { total_messages, active_visitors, booking_clicks, clicksPerVisitor };
  }, [o]);

  const chatsPerDay = useMemo(() => {
    if (Array.isArray(a?.chats_per_day)) return a.chats_per_day;
    if (!Array.isArray(a?.by_day)) return [];
    return a.by_day.map((row) => {
      const { day, ...rest } = row;
      const total = Object.values(rest).reduce((sum, v) => sum + (Number(v) || 0), 0);
      return { date: day, count: total };
    });
  }, [a]);

  const peakHours = useMemo(() => (Array.isArray(a?.peak_hours) ? a.peak_hours : []), [a]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <SectionHeader
        title="Analytics"
        subtitle={`Last updated: ${loading ? "syncing…" : "just now"} • Range: last ${days} days`}
        right={<button onClick={load}>Refresh</button>}
      />

      {err ? (
        <div className="card">
          <div style={{ fontWeight: 950 }}>Error</div>
          <div style={{ marginTop: 8, color: "var(--text-muted)" }}>{err}</div>
          <div style={{ marginTop: 12 }}>
            <button onClick={load}>Retry</button>
          </div>
        </div>
      ) : loading && !a ? (
        <div className="card">Fetching latest data…</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            <KpiCard label="Total messages" value={kpis.total_messages} sub={`Last ${days} days`} />
            <KpiCard label="Active visitors (sessions)" value={kpis.active_visitors} sub={`Last ${days} days`} />
            <KpiCard label="Booking clicks" value={kpis.booking_clicks} sub="From /api/events" />
            <KpiCard
              label="Conversion (clicks/visitor)"
              value={kpis.clicksPerVisitor === null ? "—" : kpis.clicksPerVisitor.toFixed(2)}
              sub="MVP metric (stable)"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <ChartCard title={`Guest conversations per day`} subtitle={`Last ${days} days`}>
              {chatsPerDay.length === 0 ? (
                <EmptyState
                  title="No chat activity yet"
                  text="Data will appear as guests start chatting from the widget."
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chatsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="When guests chat most" subtitle="Peak hours">
              {peakHours.length === 0 ? (
                <EmptyState
                  title="No peak-hour data yet"
                  text="As usage increases, this chart will reveal your busiest times."
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={peakHours}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
