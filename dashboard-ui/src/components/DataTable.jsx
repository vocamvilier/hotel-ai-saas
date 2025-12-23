export default function DataTable({ columns, rows, emptyText }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{
                    textAlign: "left",
                    fontSize: 12,
                    color: "var(--text-muted)",
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--border-card)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: 16,
                    color: "var(--text-muted)",
                    fontSize: 13,
                  }}
                >
                  {emptyText || "No rows yet."}
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={r.id || idx}>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      style={{
                        padding: "12px 14px",
                        borderBottom: "1px solid var(--border-card)",
                        fontSize: 13,
                        verticalAlign: "top",
                      }}
                    >
                      {c.render ? c.render(r) : r[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
