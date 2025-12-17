(() => {
  // Read hotel id from the embed script tag
  const scriptEl = document.currentScript;
  const hotelId = scriptEl?.dataset?.hotel || "demo-hotel";

  // Simple session id (persist per browser)
  const SESSION_KEY = "hotel_ai_session_id";
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = (crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2));
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  // Basic styles (inline to keep MVP simple)
  const style = document.createElement("style");
  style.textContent = `
    .hai-btn {
      position: fixed; right: 18px; bottom: 18px;
      width: 56px; height: 56px; border-radius: 999px;
      border: 0; cursor: pointer;
      box-shadow: 0 8px 20px rgba(0,0,0,.18);
      font-size: 22px;
      z-index: 999999;
    }
    .hai-panel {
      position: fixed; right: 18px; bottom: 86px;
      width: min(360px, calc(100vw - 36px));
      height: 460px;
      background: #fff; border-radius: 16px;
      box-shadow: 0 14px 40px rgba(0,0,0,.18);
      display: none; flex-direction: column;
      overflow: hidden;
      z-index: 999999;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    }
    .hai-header {
      padding: 12px 14px; border-bottom: 1px solid #eee;
      display: flex; align-items: center; justify-content: space-between;
      gap: 8px;
    }
    .hai-title { font-weight: 700; font-size: 14px; }
    .hai-sub { font-size: 12px; opacity: .7; }
    .hai-close { border:0; background: transparent; font-size: 18px; cursor: pointer; opacity: .7; }
    .hai-body { padding: 12px; flex: 1; overflow: auto; background: #fafafa; }
    .hai-msg { margin: 8px 0; display: flex; }
    .hai-msg.user { justify-content: flex-end; }
    .hai-bubble {
      max-width: 85%;
      padding: 10px 12px;
      border-radius: 14px;
      background: #fff;
      border: 1px solid #eee;
      font-size: 13px;
      line-height: 1.35;
      background: #0b1b2b;
      color: #fff;
      white-space: pre-wrap;
    }
    .hai-msg.user .hai-bubble { background: #f0f7ff; border-color: #d7ebff; }
    .hai-footer {
      padding: 10px; border-top: 1px solid #eee; background: #fff;
      display: flex; gap: 8px; align-items: center;
    }
    .hai-input {
      flex: 1; padding: 10px 12px;
      border-radius: 12px; border: 1px solid #ddd;
      outline: none; font-size: 13px;
    }
    .hai-send {
      padding: 10px 12px; border-radius: 12px;
      border: 1px solid #ddd; cursor: pointer;
      background: #fff;
    }
    .hai-meta { font-size: 11px; opacity: .6; padding: 0 12px 10px; }
  `;
  document.head.appendChild(style);

  // UI elements
  const btn = document.createElement("button");
  btn.className = "hai-btn";
  btn.textContent = "💬";
  btn.title = "Chat";

  const panel = document.createElement("div");
  panel.className = "hai-panel";

  panel.innerHTML = `
    <div class="hai-header">
      <div>
        <div class="hai-title">Hotel Chat</div>
        <div class="hai-sub">${hotelId}</div>
      </div>
      <button class="hai-close" aria-label="Close">✕</button>
    </div>
    <div class="hai-body" role="log" aria-live="polite"></div>
    <div class="hai-meta">Powered by your backend • session: ${sessionId.slice(0,8)}…</div>
    <div class="hai-footer">
      <input class="hai-input" placeholder="Γράψε εδώ..." />
      <button class="hai-send">Send</button>
    </div>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  const body = panel.querySelector(".hai-body");
  const input = panel.querySelector(".hai-input");
  const sendBtn = panel.querySelector(".hai-send");
  const closeBtn = panel.querySelector(".hai-close");

  function addMsg(text, who = "bot") {
    const row = document.createElement("div");
    row.className = `hai-msg ${who === "user" ? "user" : "bot"}`;
    const bubble = document.createElement("div");
    bubble.className = "hai-bubble";
    bubble.textContent = text;
    row.appendChild(bubble);
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }

  async function send() {
    const message = input.value.trim();
    if (!message) return;

    input.value = "";
    input.focus();
    addMsg(message, "user");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotel_id: hotelId,
          session_id: sessionId,
          message
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");
      addMsg(data.reply || "OK", "bot");
    } catch (err) {
      addMsg("Προσωρινό πρόβλημα. Δοκίμασε ξανά σε λίγο.", "bot");
      console.error(err);
    }
  }

  function toggle(open) {
    panel.style.display = open ? "flex" : "none";
    if (open) setTimeout(() => input?.focus(), 50);
  }

  btn.addEventListener("click", () => toggle(panel.style.display !== "flex"));
  closeBtn.addEventListener("click", () => toggle(false));
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });

  // First message
  addMsg("Γεια σου! Πώς μπορώ να βοηθήσω; (π.χ. check-in, πρωινό, parking)", "bot");
})();
