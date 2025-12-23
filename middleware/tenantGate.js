const HOTEL_KEYS = {
  "demo-hotel": "demo_key_123",
  "olympia-athens": "olympia_secret_456",
};

export function assertTenant(req, res) {
  const hotel_id = String(req.query.hotel_id || req.body?.hotel_id || "").trim();
  const hotel_key = String(req.query.hotel_key || req.body?.hotel_key || "").trim();

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
