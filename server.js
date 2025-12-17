import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
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

dotenv.config();

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

// ---- Demo page ----
app.get("/demo", (req, res) => {
  res.sendFile(path.join(__dirname, "demo", "demo-hotel.html"));
});

/**
 * Health check
 */
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
    const { hotel_id, session_id, message } = req.body || {};

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

    // 1) FAQ-first (0 cost)
    const faqReply = faqFirst(msg);
    if (faqReply) {
      return res.json({ reply: faqReply, source: "faq" });
    }

    // 2) OpenAI fallback
    if (!process.env.OPENAI_API_KEY) {
      return res.json({
        reply: `(${hotel_id}) Λάβαμε το μήνυμα: "${msg}"`,
        source: "dummy",
      });
    }

    const instructions =
      "You are a friendly, concise hotel receptionist. " +
      "Answer in Greek unless the user writes in English. " +
      "If the guest asks for something you cannot know (prices, availability, booking confirmation), ask ONE short follow-up question. " +
      "Keep responses short (1-4 sentences).";

    const input =
      `Hotel ID: ${hotel_id}\n` +
      `Session ID: ${sid}\n` +
      `Guest message: ${msg}\n\n` +
      "Reply as the hotel's receptionist.";

    // Daily AI limit guard (counts only OpenAI fallback)
if (!canCallAI(hotel_id)) {
  return res.status(429).json({
    ok: false,
    source: "limit",
    reply: `Έχουμε φτάσει το ημερήσιο όριο AI για σήμερα. Ρώτα κάτι από τα FAQ (check-in, check-out, parking, breakfast) ή δοκίμασε ξανά αύριο 🙂`,
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

    return res.json({
      reply:
        response.output_text ||
        "Συγγνώμη, δεν κατάφερα να απαντήσω. Θέλεις να το πεις λίγο διαφορετικά;",
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
