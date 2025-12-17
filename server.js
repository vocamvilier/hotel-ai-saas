import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Serve demo page
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
  });
});

/**
 * MVP chat endpoint (dummy for now)
 */
app.post("/api/chat", (req, res) => {
  const { hotel_id, session_id, message } = req.body;

  if (!hotel_id || !message) {
    return res.status(400).json({ error: "Missing hotel_id or message" });
  }

  // Dummy reply (χωρίς AI ακόμα)
  return res.json({
    reply: `(${hotel_id}) Λάβαμε το μήνυμα: "${message}"`
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
