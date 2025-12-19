import { pool } from "./db.js";

export async function getHotel(hotelId) {
  const r = await pool.query(
    `SELECT id, name, plan, languages, welcome_message
     FROM hotels
     WHERE id = $1`,
    [hotelId]
  );
  return r.rows[0];
}

export async function getFaqs(hotelId, lang) {
  const r = await pool.query(
    `SELECT question, answer
     FROM faqs
     WHERE hotel_id = $1 AND lang = $2
     ORDER BY id ASC`,
    [hotelId, lang]
  );
  return r.rows;
}

export async function upsertSession(hotelId, sessionId) {
  await pool.query(
    `INSERT INTO chat_sessions (session_id, hotel_id)
     VALUES ($1, $2)
     ON CONFLICT (session_id) DO UPDATE SET hotel_id = EXCLUDED.hotel_id`,
    [sessionId, hotelId]
  );
}

export async function logMessage({
  hotelId,
  sessionId,
  role,
  message,
  lang,
  source = null,
}) {
  await pool.query(
    `INSERT INTO chat_messages (hotel_id, session_id, role, message, lang, source)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [hotelId, sessionId, role, message, lang || "el", source]
  );
}

