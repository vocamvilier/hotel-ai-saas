import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "../lib/apiClient.js";
import { getTenant } from "../lib/tenant.js";
import { useAutoRefresh } from "../hooks/useAutoRefresh.js";

import KpiCard from "../components/KpiCard.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import DataTable from "../components/DataTable.jsx";

export default function Overview() {
  const { days } = useMemo(() => getTenant(), []);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setErr("");
      setLoading(true);
      const j = await apiGet("/api/dashboard/overview", { days });
      setData(j);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(load, 20000, true);

  const k = data?.kpis || {};
  const unique_sessions = k.unique_sessions ?? 0;
  const booking_clicks = k.booking_clicks ?? 0;

  const narrative = useMemo(() => {
    const rate =
      unique_sessions > 0 ? (booking_clicks / unique_sessions) : null;

    const topLang = Array.isArray(data?.languages_used) && data.languages_used[0]
      ? `${data.languages_used[0].lang} (${data.languages_used[0].count})`
      : "—";

    const peak = Array.isArray(data?.peak_hours) && data.peak_hours[0]
      ? `${String(data.peak_hours[0].hour).padStart(2, "0")}:00`
      : "—";

    return { rate, topLang, peak };
  }, [data, unique_sessions, booking_clicks]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <SectionHeader
        title="Overview"
        subtitle={`CEO summary • Last updated: ${loading ? "syncing…" : "just now"} • Range: last ${days} days`}
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
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            <KpiCard label="Total messages" value={k.total_messages ?? 0} sub={`Last ${days} days`} />
            <KpiCard label="Active visitors (sessions)" value={unique_sessions} sub={`Last ${days} days`} />
            <KpiCard label="Booking clicks" value={booking_clicks} sub="High-intent actions" />
            <KpiCard
              label="Conversion"
              value={narrative.rate === null ? "—" : (narrative.rate * 100).toFixed(1) + "%"}
              sub="Booking clicks / sessions"
            />
          </div>

          <div className="card">
            <div style={{ fontWeight: 950, fontSize: 14 }}>Insights</div>
            <div style={{ marginTop: 10, color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6 }}>
              <div>• This month you generated <b>{booking_clicks}</b> booking clicks.</div>
              <div>• Peak engagement happens around <b>{narrative.peak}</b>.</div>
              <div>• Top language: <b>{narrative.topLang}</b>.</div>
            </div>
          </div>

          <DataTable
            columns={[
              { key: "event", title: "Signal" },
              { key: "value", title: "Count" },
            ]}
            rows={Object.entries(data?.events_by_type || {}).map(([event, value]) => ({
              id: event,
              event,
              value,
            }))}
            emptyText="No events tracked yet."
          />

          <DataTable
            columns={[
              { key: "topic", title: "Top guest questions (proxy)" },
              { key: "count", title: "Count" },
            ]}
            rows={(data?.top_questions || []).map((x, i) => ({ id: i, ...x }))}
            emptyText="No questions yet."
          />
        </>
      )}
    </div>
  );
}
