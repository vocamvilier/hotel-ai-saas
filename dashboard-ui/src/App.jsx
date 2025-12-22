import { useEffect, useState } from "react";

const API_BASE = "https://hotel-ai-saas.onrender.com";
const HOTEL_ID = "demo-hotel";
const HOTEL_KEY = "demo_key_123";

async function apiGet(path) {
  const url =
    `${API_BASE}${path}` +
    (path.includes("?") ? "&" : "?") +
    `hotel_id=${encodeURIComponent(HOTEL_ID)}&hotel_key=${encodeURIComponent(HOTEL_KEY)}`;

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "API error");
  return data;
}
async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "API error");
  return data;
}

function Card({ label, value, sub }) {
  return (
    <div style={{
      padding: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,.10)",
      background: "rgba(255,255,255,.06)", backdropFilter: "blur(10px)"
    }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>{sub}</div> : null}
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
async function sendTestBooking() {
  await apiPost("/api/events", {
    hotel_id: HOTEL_ID,
    hotel_key: HOTEL_KEY,
    session_id: "test_session_" + Date.now(),
    event_type: "booking_click",
    meta: { from: "dashboard_test" },
  });

  // reload overview so you see the count increase
  const fresh = await apiGet("/api/dashboard/overview?days=7");
  setData(fresh);
}

  useEffect(() => {
    apiGet("/api/dashboard/overview?days=7")
      .then(setData)
      .catch((e) => setErr(e.message || "Error"));
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(1200px 600px at 20% 10%, rgba(34,197,94,.18), transparent 60%)," +
                  "radial-gradient(1200px 600px at 80% 0%, rgba(59,130,246,.16), transparent 55%)," +
                  "#0b1220",
      color: "white",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      padding: 24
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
       <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
  <div style={{ fontSize: 12, opacity: 0.7 }}>
    API: {API_BASE}
  </div>

  <button
    onClick={() => sendTestBooking().catch((e) => setErr(e.message))}
    style={{
      padding: "8px 10px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,.18)",
      background: "rgba(255,255,255,.08)",
      color: "white",
      cursor: "pointer",
      fontWeight: 700,
      fontSize: 12,
    }}
  >
    + Test booking click
  </button>
</div>


        <div style={{ marginTop: 18, padding: 14, borderRadius: 16, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Tenant: <b>{HOTEL_ID}</b> • Days: <b>7</b>
          </div>
        </div>

        {err && (
          <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.35)" }}>
            Error: {err}
          </div>
        )}

        {!data && !err && <div style={{ marginTop: 18, opacity: 0.8 }}>Loading dashboard…</div>}

        {data && (
          <>
            <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              <Card label="Total messages" value={data.kpis.total_messages} />
              <Card label="Active visitors (sessions)" value={data.kpis.unique_sessions} />
              <Card label="Booking clicks" value={data.kpis.booking_clicks} sub="(from /api/events)" />
              <Card label="Booking conversion" value={`${(data.conversion.booking_rate * 100).toFixed(1)}%`} />
            </div>

            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)" }}>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>Top questions (proxy)</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {(data.top_questions || []).slice(0, 6).map((q, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 12, opacity: 0.92 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.topic}</div>
                      <div style={{ opacity: 0.7 }}>{q.count}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)" }}>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>Events</div>
                <pre style={{ margin: 0, fontSize: 12, opacity: 0.9, whiteSpace: "pre-wrap" }}>
{JSON.stringify(data.events_by_type || {}, null, 2)}
                </pre>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
