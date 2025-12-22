import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./app/Layout.jsx";
import Analytics from "./pages/Analytics.jsx";
import LiveChat from "./pages/LiveChat.jsx";
import Settings from "./pages/Settings.jsx";

const API_BASE = "https://hotel-ai-saas.onrender.com";
const HOTEL_ID = "demo-hotel";
const HOTEL_KEY = "demo_key_123";

async function apiGet(path) {
  const res = await fetch(
    `${API_BASE}${path}&hotel_id=${HOTEL_ID}&hotel_key=${HOTEL_KEY}`
  );
  if (!res.ok) throw new Error("API error");
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("API error");
  return res.json();
}

function Card({ label, value, sub }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(255,255,255,.04)",
      }}
    >
      <div style={{ opacity: 0.75, fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ opacity: 0.6, fontSize: 12 }}>{sub}</div>}
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
      session_id: "test_" + Date.now(),
      event_type: "booking_click",
      meta: { from: "dashboard_test" },
    });

    const fresh = await apiGet("/api/dashboard/overview?days=7");
    setData(fresh);
  }

  useEffect(() => {
    apiGet("/api/dashboard/overview?days=7")
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  // ===== OVERVIEW (ΤΟ ΠΑΛΙΟ JSX ΣΟΥ, ΑΘΙΚΤΟ) =====
  const overview = (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 20% 10%, rgba(34,197,94,.18), transparent 60%)," +
          "radial-gradient(1200px 600px at 80% 0%, rgba(59,130,246,.16), transparent 55%)," +
          "#0b1220",
        color: "white",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 12,
            opacity: 0.8,
          }}
        >
          API: {API_BASE}
          <button
            onClick={() => sendTestBooking().catch((e) => setErr(e.message))}
            style={{
              padding: "6px 10px",
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

        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,.10)",
            background: "rgba(255,255,255,.04)",
            fontSize: 12,
            opacity: 0.8,
          }}
        >
          Tenant: <b>{HOTEL_ID}</b> · Days: <b>7</b>
        </div>

        {err && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 14,
              background: "rgba(239,68,68,.12)",
              border: "1px solid rgba(239,68,68,.35)",
            }}
          >
            Error: {err}
          </div>
        )}

        {!data && !err && (
          <div style={{ marginTop: 18, opacity: 0.8 }}>
            Loading dashboard…
          </div>
        )}

        {data && (
          <>
            <div
              style={{
                marginTop: 18,
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
              }}
            >
              <Card label="Total messages" value={data.kpis.total_messages} />
              <Card
                label="Active visitors (sessions)"
                value={data.kpis.unique_sessions}
              />
              <Card
                label="Booking clicks"
                value={data.kpis.booking_clicks}
                sub="(from /api/events)"
              />
              <Card
                label="Booking conversion"
                value={`${(data.conversion.booking_rate * 100).toFixed(1)}%`}
              />
            </div>

            <div
              style={{
                marginTop: 16,
                display: "grid",
                gridTemplateColumns: "1.2fr .8fr",
                gap: 12,
              }}
            >
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,.10)",
                  background: "rgba(255,255,255,.04)",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 10 }}>
                  Top questions (proxy)
                </div>
                {(data.top_questions || []).slice(0, 6).map((q, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      opacity: 0.9,
                    }}
                  >
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {q.topic}
                    </div>
                    <div style={{ opacity: 0.7 }}>{q.count}</div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,.10)",
                  background: "rgba(255,255,255,.04)",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 10 }}>Events</div>
                <pre style={{ margin: 0, fontSize: 12, opacity: 0.9 }}>
                  {JSON.stringify(data.events_by_type || {}, null, 2)}
                </pre>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ===== ROUTES =====
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={overview} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/live-chat" element={<LiveChat />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}
