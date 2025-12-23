import { getTenant } from "./tenant";

const API_BASE =
  import.meta.env.VITE_API_BASE || "https://hotel-ai-saas.onrender.com";

async function parseJsonSafe(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { ok: false, error: text || "Invalid JSON from server" };
  }
}

export async function apiGet(path, params = {}) {
  const t = getTenant();
  const url = new URL(API_BASE + path);

  // inject tenant always (enterprise consistency)
  url.searchParams.set("hotel_id", t.hotel_id);
  url.searchParams.set("hotel_key", t.hotel_key);

  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString());
  const data = await parseJsonSafe(res);

  if (!res.ok) {
    const msg = data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function apiPost(path, body = {}) {
  const t = getTenant();
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      hotel_id: t.hotel_id,
      hotel_key: t.hotel_key,
    }),
  });

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    const msg = data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}
