import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../lib/apiClient.js";
import { useAutoRefresh } from "../hooks/useAutoRefresh.js";
import SectionHeader from "../components/SectionHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import StatusPill from "../components/StatusPill.jsx";

export default function LiveChat() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setErr("");
      setLoading(true);
      const j = await apiGet("/api/conversations/live", { minutes: 45, limit: 60 });
      setRows(j?.conversations || []);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load, 5000, true);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <SectionHeader
        title="Live Chat"
        subtitle={loading ? "Syncing…" : "Auto-refresh every 5s"}
        right={<button onClick={load}>Refresh</button>}
      />

      {err ? (
        <div className="card">
          <div style={{ fontWeight: 950 }}>Error</div>
          <div style={{ marginTop: 8, color: "var(--text-muted)" }}>{err}</div>
        </div>
      ) : (
        <DataTable
          columns={[
            { key: "session_id", title: "Guest session" },
            { key: "message_count", title: "Messages" },
            {
              key: "last_message",
              title: "Last message",
              render: (r) => (
                <div style={{ maxWidth: 520, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.last_message || "—"}
                </div>
              ),
            },
            {
              key: "last_message_at",
              title: "Last activity",
              render: (r) => (r.last_message_at ? new Date(r.last_message_at).toLocaleString() : "—"),
            },
            {
              key: "status",
              title: "Status",
              render: () => <StatusPill tone="online">Active</StatusPill>,
            },
          ]}
          rows={rows}
          emptyText="No active conversations. Guest chats will appear here in real time."
        />
      )}
    </div>
  );
}
