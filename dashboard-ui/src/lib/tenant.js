export function getTenant() {
  const hotel_id = localStorage.getItem("hotel_id") || "demo-hotel";
  const hotel_key = localStorage.getItem("hotel_key") || "demo_key_123";
  const days = Number(localStorage.getItem("days") || 7) || 7;
  return { hotel_id, hotel_key, days };
}
