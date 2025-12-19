import "dotenv/config";
import { getHotel, getFaqs, upsertSession, logMessage } from "./dbQueries.js";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { pool } from "./db.js";
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

// ===============================
// Daily AI limit (MVP – in memory)
// ===============================
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

// MVP tenant hardening (no DB)
const HOTEL_KEYS = {
  "demo-hotel": "demo_key_123",
  "olympia-athens": "olympia_secret_456",
};

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

// ---- OpenAI client (reads OPENAI_API_KEY from env) ----
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---- Middleware ----
app.use(cors());
app.use(express.json({ limit: "100kb" }));

// ---- Serve static files ----
app.use(express.static(path.join(__dirname, "public")));
app.use("/public", express.static(path.join(__dirname, "public")));

// ---- Demo page ----
app.get("/demo", (req, res) => {
  res.sendFile(path.join(__dirname, "demo", "demo-hotel.html"));
});

/**
 * Health check
 */
app.use((req, res, next) => {
  console.log("➡️", req.method, req.originalUrl);
  next();
});
app.get("/api/chat", (req, res) => {
  res.json({ ok: true, note: "Use POST /api/chat" });
});
app.get("/", (req, res) => {
  res.send("Hotel AI SaaS backend is running 🚀");
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    model: MODEL,
  });
});
app.get("/api/health/db", async (req, res) => {
  try {
    const r = await pool.query("SELECT now()");
    res.json({
      ok: true,
      dbTime: r.rows[0].now,
    });
  } catch (err) {
    console.error("DB health error:", err);
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});
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

    // totals (user + assistant)
    const totalRes = await pool.query(
      `
      SELECT COUNT(*)::int AS total_messages
      FROM chat_messages
      WHERE hotel_id = $1
        AND created_at >= NOW() - ($2::text || ' days')::interval
      `,
      [hotel_id, String(days)]
    );

    // unique sessions (based on any messages)
    const sessionsRes = await pool.query(
      `
      SELECT COUNT(DISTINCT session_id)::int AS unique_sessions
      FROM chat_messages
      WHERE hotel_id = $1
        AND created_at >= NOW() - ($2::text || ' days')::interval
      `,
      [hotel_id, String(days)]
    );

    // assistant replies split by source, per day
    const byDayRes = await pool.query(
      `
      SELECT
        date_trunc('day', created_at) AS day,
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

    // normalize to: [{ day, faq: n, faq_db: n, openai: n, limit: n, dummy: n, unknown: n }]
    const map = new Map();
    for (const r of byDayRes.rows) {
      const d = r.day.toISOString().slice(0, 10);
      if (!map.has(d)) map.set(d, { day: d });
      map.get(d)[r.source] = r.count;
    }
    const by_day = Array.from(map.values());

    return res.json({
      ok: true,
      hotel_id,
      days,
      total_messages: totalRes.rows[0]?.total_messages ?? 0,
      unique_sessions: sessionsRes.rows[0]?.unique_sessions ?? 0,
      by_day,
    });
  } catch (err) {
    console.error("analytics error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// ---- Simple in-memory rate limit (per hotel_id + session_id) ----
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

// ---- FAQ-first (MVP hardcoded) ----
const FAQ = [
  {
    match: [/check[- ]?in/i, /τσεκ ?ιν/i, /άφιξη/i],
    answer:
      "Το check-in είναι από 15:00. Αν φτάσετε νωρίτερα, μπορούμε να κρατήσουμε τις αποσκευές σας μέχρι να είναι έτοιμο το δωμάτιο.",
  },
  {
    match: [/check[- ]?out/i, /τσεκ ?άουτ/i, /αναχώρηση/i],
    answer:
      "Το check-out είναι έως 11:00. Αν θέλετε late check-out, πείτε μου περίπου τι ώρα και θα σας ενημερώσω για διαθεσιμότητα/πιθανή χρέωση.",
  },
  {
    match: [/parking/i, /παρκ/i, /στάθμευση/i],
    answer:
      "Για parking: υπάρχει διαθέσιμος χώρος στάθμευσης (ανάλογα με διαθεσιμότητα). Θέλετε να μου πείτε αν έρχεστε με αυτοκίνητο και περίπου τι ώρα;",
  },
  {
    match: [/breakfast/i, /πρωιν/i],
    answer:
      "Το πρωινό σερβίρεται 07:30–10:30. Αν έχετε αλλεργίες ή ειδική διατροφή, πείτε μου τι χρειάζεστε.",
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
 * MVP chat endpoint (FAQ-first + OpenAI fallback)
 * Body: { hotel_id, session_id, message }
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { hotel_id, hotel_key, session_id, message } = req.body || {};

    // Tenant hardening check (κρατάμε όπως είναι)
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
      return res
        .status(413)
        .json({ error: `Message too long (max ${MAX_MESSAGE_CHARS} chars)` });
    }

    const sid = session_id || "no-session";
    const key = `${hotel_id}:${sid}`;

    if (hitRateLimit(key)) {
      return res.status(429).json({ error: "Too many messages. Please slow down." });
    }

    // ---------- DB: load hotel + decide lang + upsert session ----------
    const hotel = await getHotel(hotel_id);
    if (!hotel) {
      return res.status(404).json({
        ok: false,
        source: "hotel",
        reply: "Δεν βρέθηκε το ξενοδοχείο. Έλεγξε το hotel_id.",
      });
    }
    // very simple lang guess (μίνι, χωρίς deps)
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


    // ---------- 1) FAQ-first (existing in-memory, 0 cost) ----------
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

    // ---------- 1.5) FAQ-from-DB (hotel_id + lang) ----------
    const faqs = await getFaqs(hotel_id, effectiveLang);

    // super-minimal matching: if msg contains a keyword from question (first significant word)
    const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
    const msgN = norm(msg);

    let dbFaqHit = null;
    for (const f of faqs) {
      const q = norm(f.question);
      if (!q) continue;

      // try direct containment either way
      if (msgN.includes(q) || q.includes(msgN)) {
        dbFaqHit = f;
        break;
      }

      // try first meaningful token from question
      const token = q.split(" ").find(w => w.length >= 4);
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

    // ---------- 2) OpenAI fallback ----------
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

    }

    const instructions =
      "You are a friendly, concise hotel receptionist. " +
      "Answer in Greek unless the user writes in English. " +
      "If the guest asks for something you cannot know (prices, availability, booking confirmation), ask ONE short follow-up question. " +
      "Keep responses short (1-4 sentences).";

    // include DB hotel settings to steer responses (minimal)
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
    "Έχουμε φτάσει το ημερήσιο όριο AI για σήμερα. Ρώτα κάτι από τα FAQ (check-in, check-out, parking, breakfast) ή δοκίμασε ξανά αύριο 🙂";

  await logMessage({
    hotelId: hotel_id,
    sessionId: sid,
    role: "assistant",
    message: limitMsg,
    lang: effectiveLang,
    source: "limit",
  });

  return res.status(429).json({
    ok: false,
    source: "limit",
    reply: limitMsg,
  });
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

  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({
      error: "Server error",
      reply: "Υπήρξε προσωρινό πρόβλημα. Δοκίμασε ξανά σε λίγο.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
