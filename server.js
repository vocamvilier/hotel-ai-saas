import "dotenv/config";

import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

import { pool } from "./db.js";
import { getHotel, getFaqs, upsertSession, logMessage } from "./dbQueries.js";

/**
 * ===============================
 * Plans / Rules
 * ===============================
 */
const PLAN_RULES = {
  basic: {
    aiDailyCap: Number(process.env.BASIC_DAILY_AI_CALL_LIMIT ?? 10),
    allowedLanguages: ["el", "en"],
  },
  pro: {
    aiDailyCap: Number(process.env.PRO_DAILY_AI_CALL_LIMIT ?? 100),
    allowedLanguages: ["el", "en", "de", "fr", "it", "es"],
  },
};

function getPlanRules(plan) {
  return PLAN_RULES[(plan || "basic").toLowerCase()] ?? PLAN_RULES.basic;
}

/**
 * ===============================
 * Daily AI limit (MVP – in memory)
 * ===============================
 */
const DAILY_LIMIT = Number(process.env.DAILY_AI_CALL_LIMIT || 200);
let currentDay = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
let aiCallsByHotel = new Map();

function resetIfNewDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== currentDay) {
    currentDay = today;
    aiCallsByHotel = new Map();
  }
}
function canCallAI(hotelId) {
  resetIfNewDay();
  const key = hotelId || "unknown";
  const used = aiCallsByHotel.get(key) || 0;
  return used < DAILY_LIMIT;
}
function incrementAI(hotelId) {
  resetIfNewDay();
  const key = hotelId || "unknown";
  const used = aiCallsByHotel.get(key) || 0;
  aiCallsByHotel.set(key, used + 1);
}

/**
 * ===============================
 * Tenant hardening (MVP – no DB keys yet)
 * ===============================
 */
const HOTEL_KEYS = {
  "demo-hotel": "demo_key_123",
  "olympia-athens": "olympia_secret_456",
};

function assertTenant(req, res) {
  const hotel_id =
    String(req.query.hotel_id || req.body?.hotel_id || "").trim();
  const hotel_key =
    String(req.query.hotel_key || req.body?.hotel_key || "").trim();

  if (!hotel_id || !hotel_key) {
    res.status(400).json({ ok: false, error: "hotel_id and hotel_key are required" });
    return null;
  }
  const expectedKey = HOTEL_KEYS[hotel_id];
  if (!expectedKey || hotel_key !== expectedKey) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return null;
  }
  return { hotel_id, hotel_key };
}

/**
 * ===============================
 * App
 * ===============================
 */
const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- MVP knobs (env optional) ----
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_OUTPUT_TOKENS = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 220);
const TEMPERATURE = Number(process.env.OPENAI_TEMPERATURE || 0.2);
const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE || 12);
const MAX_MESSAGE_CHARS = Number(process.env.MAX_MESSAGE_CHARS || 600);

// ---- OpenAI client ----
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- Middleware ----
app.use(cors());
app.use(express.json({ limit: "100kb" }));

// ---- Static ----
app.use(express.static(path.join(__dirname, "public")));
app.use("/public", express.static(path.join(__dirname, "public")));


// ---- Request log ----
app.use((req, _res, next) => {
  console.log("➡️", req.method, req.originalUrl);
  next();
});

// ---- Simple GET guard ----
app.get("/api/chat", (req, res) => {
  res.json({ ok: true, note: "Use POST /api/chat" });
});

app.get("/", (req, res) => {
  res.send("Hotel AI SaaS backend is running ");
});

/**
 * ===============================
 * Health
 * ===============================
 */
app.get("/api/health", (req, res) => {
  res.json({ ok: true, hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY), model: MODEL });
});

app.get("/api/health/db", async (req, res) => {
  try {
    const r = await pool.query("SELECT now()");
    res.json({ ok: true, dbTime: r.rows[0].now });
  } catch (err) {
    console.error("DB health error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * ===============================
 * NEW: Events table (for conversion tracking)
 * - created lazily at boot (safe)
 * ===============================
 */
async function ensureEventsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_events (
      id BIGSERIAL PRIMARY KEY,
      hotel_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      meta JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_events_hotel_time ON chat_events (hotel_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_events_hotel_type_time ON chat_events (hotel_id, event_type, created_at DESC);`);
}

/**
 * Read-only analytics (tenant gated via hotel_key)
 * GET /api/analytics?hotel_id=demo-hotel&hotel_key=demo_key_123&days=7
 */
app.get("/api/analytics", async (req, res) => {
  try {
    const hotel_id = String(req.query.hotel_id || "");
    const hotel_key = String(req.query.hotel_key || "");
    const daysRaw = Number(req.query.days ?? 7);
    const days = Math.min(Math.max(Number.isFinite(daysRaw) ? daysRaw : 7, 1), 90);

    if (!hotel_id || !hotel_key) {
      return res.status(400).json({ ok: false, error: "hotel_id and hotel_key are required" });
    }

    const expectedKey = HOTEL_KEYS[hotel_id];
    if (!expectedKey || hotel_key !== expectedKey) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const totalRes = await pool.query(
      `
      SELECT COUNT(*)::int AS total_messages
      FROM chat_messages
      WHERE hotel_id = $1
        AND created_at >= NOW() - ($2::text || ' days')::interval
      `,
      [hotel_id, String(days)]
    );

    const sessionsRes = await pool.query(
      `
      SELECT COUNT(DISTINCT session_id)::int AS unique_sessions
      FROM chat_messages
      WHERE hotel_id = $1
        AND created_at >= NOW() - ($2::text || ' days')::interval
      `,
      [hotel_id, String(days)]
    );

    const totalsBySourceRes = await pool.query(
      `
      SELECT COALESCE(source, 'unknown') AS source, COUNT(*)::int AS count
      FROM chat_messages
      WHERE hotel_id = $1
        AND role = 'assistant'
        AND created_at >= NOW() - ($2::text || ' days')::interval
      GROUP BY 1
      ORDER BY 2 DESC
      `,
      [hotel_id, String(days)]
    );

    const totals_by_source = Object.fromEntries(
      totalsBySourceRes.rows.map((r) => [r.source, r.count])
    );

    // Existing by_day (assistant replies by source)
    const byDayRes = await pool.query(
      `
      SELECT date_trunc('day', created_at) AS day,
             COALESCE(source, 'unknown') AS source,
             COUNT(*)::int AS count
      FROM chat_messages
      WHERE hotel_id = $1
        AND role = 'assistant'
        AND created_at >= NOW() - ($2::text || ' days')::interval
      GROUP BY 1,2
      ORDER BY 1 ASC, 2 ASC
      `,
      [hotel_id, String(days)]
    );

    const map = new Map();
    for (const r of byDayRes.rows) {
      const d = r.day.toISOString().slice(0, 10);
      if (!map.has(d)) {
        map.set(d, { day: d, faq: 0, faq_db: 0, openai: 0, limit: 0, dummy: 0, unknown: 0 });
      }
      map.get(d)[r.source] = r.count;
    }
    const by_day = Array.from(map.values());

    // ✅ NEW: chats_per_day (user messages per day) – best for “usage”
    const chatsPerDayRes = await pool.query(
      `
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
             COUNT(*)::int AS count
      FROM chat_messages
      WHERE hotel_id = $1
        AND role = 'user'
        AND created_at >= NOW() - ($2::text || ' days')::interval
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      [hotel_id, String(days)]
    );
    const chats_per_day = chatsPerDayRes.rows;

    // ✅ NEW: peak_hours (user messages per hour)
    const peakHoursRes = await pool.query(
      `
      SELECT EXTRACT(HOUR FROM created_at)::int AS hour,
             COUNT(*)::int AS count
      FROM chat_messages
      WHERE hotel_id = $1
        AND role = 'user'
        AND created_at >= NOW() - ($2::text || ' days')::interval
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      [hotel_id, String(days)]
    );
    const peak_hours = peakHoursRes.rows;

    return res.json({
      ok: true,
      hotel_id,
      days,
      total_messages: totalRes.rows[0]?.total_messages ?? 0,
      unique_sessions: sessionsRes.rows[0]?.unique_sessions ?? 0,
      totals_by_source,
      by_day,

      // new fields for charts:
      chats_per_day,
      peak_hours,
    });
  } catch (err) {
    console.error("analytics error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});


/**
 * ===============================
 * EXISTING: Analytics summary (kept)
 * GET /api/analytics/summary?hotel_id=...&hotel_key=...&days=7
 * ===============================
 */
app.get("/api/analytics/summary", async (req, res) => {
  try {
    const t = assertTenant(req, res);
    if (!t) return;
    const { hotel_id } = t;

    const daysRaw = Number(req.query.days ?? 7);
    const days = Math.min(Math.max(Number.isFinite(daysRaw) ? daysRaw : 7, 1), 90);

    const hotel = await getHotel(hotel_id);
    if (!hotel) return res.status(404).json({ ok: false, error: "Hotel not found" });

    const totalRes = await pool.query(
      `
      SELECT COUNT(*)::int AS total_messages
      FROM chat_messages
      WHERE hotel_id = $1
        AND created_at >= NOW() - ($2::text || ' days')::interval
    `,
      [hotel_id, String(days)]
    );

    const sessionsRes = await pool.query(
      `
      SELECT COUNT(DISTINCT session_id)::int AS unique_sessions
      FROM chat_messages
      WHERE hotel_id = $1
        AND created_at >= NOW() - ($2::text || ' days')::interval
    `,
      [hotel_id, String(days)]
    );

    const sourcesRes = await pool.query(
      `
      SELECT COALESCE(source, 'unknown') AS source, COUNT(*)::int AS count
      FROM chat_messages
      WHERE hotel_id = $1
        AND role = 'assistant'
        AND created_at >= NOW() - ($2::text || ' days')::interval
      GROUP BY 1
      ORDER BY 2 DESC
    `,
      [hotel_id, String(days)]
    );

    const counts = Object.fromEntries(sourcesRes.rows.map((r) => [r.source, r.count]));
    const faqTotal = (counts.faq || 0) + (counts.faq_db || 0);
    const aiTotal = counts.openai || 0;
    const limitTotal = counts.limit || 0;
    const unknownTotal = counts.unknown || 0;

    const plan = (hotel.plan || "basic").toLowerCase();
    const cap = getPlanRules(plan).aiDailyCap;

    const freeTotal = faqTotal;
    const paidTotal = aiTotal;

    const summary =
      `Αναφορά τελευταίων ${days} ημερών για ${hotel.name} (${hotel_id}, plan: ${plan.toUpperCase()}): ` +
      `${totalRes.rows[0]?.total_messages ?? 0} συνολικά μηνύματα, ` +
      `${sessionsRes.rows[0]?.unique_sessions ?? 0} μοναδικά sessions.\n` +
      `Απαντήσεις assistant: ${freeTotal} δωρεάν (FAQ), ${paidTotal} με AI. ` +
      (limitTotal ? `Το όριο AI χτυπήθηκε ${limitTotal} φορές.\n` : "") +
      (unknownTotal ? `(${unknownTotal} παλαιότερες απαντήσεις χωρίς source.) ` : "") +
      `Ημερήσιο AI όριο plan: ${cap}/ημέρα.`;

    return res.json({
      ok: true,
      hotel_id,
      days,
      plan,
      ai_daily_cap: cap,
      free_total: freeTotal,
      paid_total: paidTotal,
      total_messages: totalRes.rows[0]?.total_messages ?? 0,
      unique_sessions: sessionsRes.rows[0]?.unique_sessions ?? 0,
      assistant_sources: counts,
      summary,
    });
  } catch (err) {
    console.error("analytics summary error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/**
 * ===============================
 * NEW: Dashboard Overview (CEO cards + analytics extras)
 * GET /api/dashboard/overview?hotel_id=...&hotel_key=...&days=7
 * ===============================
 */
app.get("/api/dashboard/overview", async (req, res) => {
  try {
    const t = assertTenant(req, res);
    if (!t) return;
    const { hotel_id } = t;

    const daysRaw = Number(req.query.days ?? 7);
    const days = Math.min(Math.max(Number.isFinite(daysRaw) ? daysRaw : 7, 1), 90);

    // Totals
    const totalRes = await pool.query(
      `
      SELECT COUNT(*)::int AS total_messages
      FROM chat_messages
      WHERE hotel_id = $1
        AND created_at >= NOW() - ($2::text || ' days')::interval
    `,
      [hotel_id, String(days)]
    );

    const sessionsRes = await pool.query(
      `
      SELECT COUNT(DISTINCT session_id)::int AS unique_sessions
      FROM chat_messages
      WHERE hotel_id = $1
        AND created_at >= NOW() - ($2::text || ' days')::interval
    `,
      [hotel_id, String(days)]
    );

    // Languages used (from stored lang on messages)
    const langsRes = await pool.query(
      `
      SELECT COALESCE(lang, 'unknown') AS lang, COUNT(*)::int AS count
      FROM chat_messages
      WHERE hotel_id = $1
        AND created_at >= NOW() - ($2::text || ' days')::interval
      GROUP BY 1
      ORDER BY 2 DESC
    `,
      [hotel_id, String(days)]
    );
    const languages_used = langsRes.rows;

    // Peak hours (based on user messages)
    const peakRes = await pool.query(
      `
      SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS count
      FROM chat_messages
      WHERE hotel_id = $1
        AND role = 'user'
        AND created_at >= NOW() - ($2::text || ' days')::interval
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 6
    `,
      [hotel_id, String(days)]
    );
    const peak_hours = peakRes.rows;

    // Top FAQ proxy (until we add faq_id/intent logging):
    // show top repeated user questions (normalized first 70 chars)
    const topFaqProxyRes = await pool.query(
      `
      SELECT LEFT(REGEXP_REPLACE(LOWER(message), '\\s+', ' ', 'g'), 70) AS topic,
             COUNT(*)::int AS count
      FROM chat_messages
      WHERE hotel_id = $1
        AND role = 'user'
        AND created_at >= NOW() - ($2::text || ' days')::interval
        AND LENGTH(message) >= 8
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 8
    `,
      [hotel_id, String(days)]
    );
    const top_questions = topFaqProxyRes.rows;

    // Conversion from events table
    const eventsRes = await pool.query(
      `
      SELECT event_type, COUNT(*)::int AS count
      FROM chat_events
      WHERE hotel_id = $1
        AND created_at >= NOW() - ($2::text || ' days')::interval
      GROUP BY 1
      ORDER BY 2 DESC
    `,
      [hotel_id, String(days)]
    );
    const events_by_type = Object.fromEntries(eventsRes.rows.map(r => [r.event_type, r.count]));

    const unique_sessions = sessionsRes.rows[0]?.unique_sessions ?? 0;
    const booking_clicks = events_by_type.booking_click || 0;
    const leads_created = events_by_type.lead_created || 0;

    const conversion_booking = unique_sessions > 0 ? booking_clicks / unique_sessions : 0;
    const conversion_lead = unique_sessions > 0 ? leads_created / unique_sessions : 0;

    return res.json({
      ok: true,
      hotel_id,
      days,
      kpis: {
        total_messages: totalRes.rows[0]?.total_messages ?? 0,
        unique_sessions,
        booking_clicks,
        leads_created,
      },
      languages_used,
      peak_hours,
      top_questions,
      events_by_type,
      conversion: {
        booking_rate: conversion_booking,
        lead_rate: conversion_lead,
      },
    });
  } catch (err) {
    console.error("dashboard overview error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/**
 * ===============================
 * NEW: Live conversations (for Live Chat table)
 * GET /api/conversations/live?hotel_id=...&hotel_key=...&minutes=30&limit=40
 * ===============================
 */
app.get("/api/conversations/live", async (req, res) => {
  try {
    const t = assertTenant(req, res);
    if (!t) return;
    const { hotel_id } = t;

    const minutesRaw = Number(req.query.minutes ?? 30);
    const minutes = Math.min(Math.max(Number.isFinite(minutesRaw) ? minutesRaw : 30, 1), 24 * 60);

    const limitRaw = Number(req.query.limit ?? 40);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 40, 1), 200);

    const r = await pool.query(
      `
      WITH recent AS (
        SELECT *
        FROM chat_messages
        WHERE hotel_id = $1
          AND created_at >= NOW() - ($2::text || ' minutes')::interval
      ),
      last_per_session AS (
        SELECT DISTINCT ON (session_id)
          session_id,
          created_at AS last_message_at,
          role AS last_role,
          message AS last_message
        FROM recent
        ORDER BY session_id, created_at DESC
      ),
      counts AS (
        SELECT session_id, COUNT(*)::int AS message_count
        FROM recent
        GROUP BY 1
      )
      SELECT
        l.session_id,
        l.last_message_at,
        l.last_role,
        l.last_message,
        c.message_count
      FROM last_per_session l
      JOIN counts c USING (session_id)
      ORDER BY l.last_message_at DESC
      LIMIT $3
    `,
      [hotel_id, String(minutes), limit]
    );

    return res.json({ ok: true, hotel_id, minutes, conversations: r.rows });
  } catch (err) {
    console.error("live conversations error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/**
 * ===============================
 * NEW: Event tracking (conversion)
 * POST /api/events
 * body: { hotel_id, hotel_key, session_id, event_type, meta? }
 * event_type: booking_click | lead_created | widget_open | widget_close
 * ===============================
 */
const ALLOWED_EVENT_TYPES = new Set([
  "booking_click",
  "lead_created",
  "widget_open",
  "widget_close",
]);

app.post("/api/events", async (req, res) => {
  try {
    const t = assertTenant(req, res);
    if (!t) return;
    const { hotel_id } = t;

    const session_id = String(req.body?.session_id || "").trim();
    const event_type = String(req.body?.event_type || "").trim();
    const meta = req.body?.meta && typeof req.body.meta === "object" ? req.body.meta : {};

    if (!session_id) {
      return res.status(400).json({ ok: false, error: "session_id is required" });
    }
    if (!ALLOWED_EVENT_TYPES.has(event_type)) {
      return res.status(400).json({
        ok: false,
        error: `event_type must be one of: ${Array.from(ALLOWED_EVENT_TYPES).join(", ")}`,
      });
    }

    await pool.query(
      `
      INSERT INTO chat_events (hotel_id, session_id, event_type, meta)
      VALUES ($1, $2, $3, $4::jsonb)
    `,
      [hotel_id, session_id, event_type, JSON.stringify(meta)]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("events error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/**
 * ===============================
 * Rate limit (existing)
 * ===============================
 */
const buckets = new Map(); // key -> { count, windowStartMs }
function hitRateLimit(key) {
  const now = Date.now();
  const windowMs = 60_000;
  const entry = buckets.get(key);
  if (!entry || now - entry.windowStartMs > windowMs) {
    buckets.set(key, { count: 1, windowStartMs: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_PER_MINUTE;
}

/**
 * ===============================
 * FAQ-first (existing)
 * ===============================
 */
const FAQ = [
  {
    match: [/check[- ]?in/i, /τσεκ ?ιν/i, /άφιξη/i],
    answer:
      "Το check-in είναι από 15:00.\nΑν φτάσετε νωρίτερα, μπορούμε να κρατήσουμε τις αποσκευές σας μέχρι να είναι έτοιμο το δωμάτιο.",
  },
  {
    match: [/check[- ]?out/i, /τσεκ ?άουτ/i, /αναχώρηση/i],
    answer:
      "Το check-out είναι έως 11:00. Αν θέλετε late check-out, πείτε μου περίπου τι ώρα και θα σας ενημερώσω για διαθεσιμότητα/πιθανή χρέωση.",
  },
  {
    match: [/parking/i, /παρκ/i, /στάθμευση/i],
    answer:
      "Για parking: υπάρχει διαθέσιμος χώρος στάθμευσης (ανάλογα με διαθεσιμότητα).\nΘέλετε να μου πείτε αν έρχεστε με αυτοκίνητο και περίπου τι ώρα;",
  },
  {
    match: [/breakfast/i, /πρωιν/i],
    answer:
      "Το πρωινό σερβίρεται 07:30–10:30.\nΑν έχετε αλλεργίες ή ειδική διατροφή, πείτε μου τι χρειάζεστε.",
  },
];

function faqFirst(text) {
  const msg = (text || "").trim();
  if (!msg) return null;
  for (const item of FAQ) {
    if (item.match.some((re) => re.test(msg))) return item.answer;
  }
  return null;
}

/**
 * ===============================
 * Chat (existing, kept)
 * POST /api/chat
 * Body: { hotel_id, hotel_key, session_id, message }
 * ===============================
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { hotel_id, hotel_key, session_id, message } = req.body || {};

    // Tenant hardening (kept)
    const expectedKey = HOTEL_KEYS[hotel_id];
    if (!expectedKey || hotel_key !== expectedKey) {
      return res.status(401).json({
        ok: false,
        reply: "Μη εξουσιοδοτημένο ξενοδοχείο.",
        source: "auth",
      });
    }

    if (!hotel_id || typeof message !== "string") {
      return res.status(400).json({ error: "Missing hotel_id or message" });
    }

    const msg = message.trim();
    if (!msg) return res.status(400).json({ error: "Empty message" });

    if (msg.length > MAX_MESSAGE_CHARS) {
      return res.status(413).json({ error: `Message too long (max ${MAX_MESSAGE_CHARS} chars)` });
    }

    const sid = session_id || "no-session";
    const key = `${hotel_id}:${sid}`;
    if (hitRateLimit(key)) {
      return res.status(429).json({ error: "Too many messages. Please slow down." });
    }

    // Load hotel
    const hotel = await getHotel(hotel_id);
    if (!hotel) {
      return res.status(404).json({
        ok: false,
        source: "hotel",
        reply: "Δεν βρέθηκε το ξενοδοχείο. Έλεγξε το hotel_id.",
      });
    }

    // very simple lang guess (kept)
    const looksEnglish = /[a-zA-Z]/.test(msg) && !/[α-ωΑ-Ω]/.test(msg);
    const lang = looksEnglish ? "en" : "el";

    const rules = getPlanRules(hotel.plan);
    const aiDailyCap = rules.aiDailyCap;

    // enforce plan language list
    const effectiveLang = rules.allowedLanguages.includes(lang) ? lang : "en";

    await upsertSession(hotel_id, sid);

    // log user message
    await logMessage({
      hotelId: hotel_id,
      sessionId: sid,
      role: "user",
      message: msg,
      lang: effectiveLang,
      source: "user",
    });

    // 1) FAQ-first
    const faqReply = faqFirst(msg);
    if (faqReply) {
      await logMessage({
        hotelId: hotel_id,
        sessionId: sid,
        role: "assistant",
        message: faqReply,
        lang: effectiveLang,
        source: "faq",
      });
      return res.json({ reply: faqReply, source: "faq" });
    }

    // 1.5) FAQ-from-DB
    const faqs = await getFaqs(hotel_id, effectiveLang);

    const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
    const msgN = norm(msg);

    let dbFaqHit = null;
    for (const f of faqs) {
      const q = norm(f.question);
      if (!q) continue;

      if (msgN.includes(q) || q.includes(msgN)) {
        dbFaqHit = f;
        break;
      }
      const token = q.split(" ").find((w) => w.length >= 4);
      if (token && msgN.includes(token)) {
        dbFaqHit = f;
        break;
      }
    }

    if (dbFaqHit?.answer) {
      await logMessage({
        hotelId: hotel_id,
        sessionId: sid,
        role: "assistant",
        message: dbFaqHit.answer,
        lang: effectiveLang,
        source: "faq_db",
      });
      return res.json({ reply: dbFaqHit.answer, source: "faq_db" });
    }

    // 2) OpenAI fallback
    if (!process.env.OPENAI_API_KEY) {
      const dummy = `(${hotel_id}) Λάβαμε το μήνυμα: "${msg}"`;
      await logMessage({
        hotelId: hotel_id,
        sessionId: sid,
        role: "assistant",
        message: dummy,
        lang: effectiveLang,
        source: "dummy",
      });
      return res.json({ reply: dummy, source: "dummy" });
    }

    const instructions =
      "You are a friendly, concise hotel receptionist. " +
      "Answer in Greek unless the user writes in English. " +
      "If the guest asks for something you cannot know (prices, availability, booking confirmation), ask ONE short follow-up question. " +
      "Keep responses short (1-4 sentences).";

    const hotelCtx =
      `Hotel name: ${hotel.name}\n` +
      `Hotel plan: ${hotel.plan}\n` +
      `Supported languages: ${(hotel.languages || []).join(", ")}\n` +
      `Welcome message: ${hotel.welcome_message || ""}\n`;

    const input =
      hotelCtx +
      `Hotel ID: ${hotel_id}\n` +
      `Session ID: ${sid}\n` +
      `Guest message: ${msg}\n\n` +
      "Reply as the hotel's receptionist.";

    // Daily AI limit guard (plan-based)
    resetIfNewDay();
    const used = aiCallsByHotel.get(hotel_id) || 0;

    if (used >= aiDailyCap) {
      const limitMsg =
        "Έχουμε φτάσει το ημερήσιο όριο AI για σήμερα.\n" +
        "Ρώτα κάτι από τα FAQ (check-in, check-out, parking, breakfast) ή δοκίμασε ξανά αύριο.";
      await logMessage({
        hotelId: hotel_id,
        sessionId: sid,
        role: "assistant",
        message: limitMsg,
        lang: effectiveLang,
        source: "limit",
      });
      return res.status(429).json({ ok: false, source: "limit", reply: limitMsg });
    }

    const response = await openai.responses.create({
      model: MODEL,
      instructions,
      input,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      temperature: TEMPERATURE,
    });

    incrementAI(hotel_id);

    const finalReply =
      response.output_text ||
      "Συγγνώμη, δεν κατάφερα να απαντήσω. Θέλεις να το πεις λίγο διαφορετικά;";

    await logMessage({
      hotelId: hotel_id,
      sessionId: sid,
      role: "assistant",
      message: finalReply,
      lang: effectiveLang,
      source: "openai",
    });

    return res.json({ reply: finalReply, source: "openai" });
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({
      error: "Server error",
      reply: "Υπήρξε προσωρινό πρόβλημα. Δοκίμασε ξανά σε λίγο.",
    });
  }
});

/**
 * ===============================
 * Boot
 * ===============================
 */
(async () => {
  try {
    await ensureEventsTable();
    console.log("✅ chat_events table ready");
  } catch (e) {
    console.error("⚠️ could not ensure chat_events table:", e.message);
  }

  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
})();
