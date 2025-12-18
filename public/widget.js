(() => {
  // Read hotel id/key from the embed script tag
  const scriptEl = document.currentScript;
  const hotelId = (scriptEl && scriptEl.dataset && scriptEl.dataset.hotel) || "demo-hotel";
  const hotelKey = (scriptEl && scriptEl.dataset && scriptEl.dataset.key) || "";

  // Simple session id (persist per browser)
  const SESSION_KEY = "hotel_ai_session_id";
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId =
      (crypto.randomUUID?.() ||
        String(Date.now()) + Math.random().toString(16).slice(2));
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  // Basic styles (inline to keep MVP simple)
  const style = document.createElement("style");
  style.textContent = `
:root { color-scheme: light; }

.hai-btn{
  position: fixed; right: 18px; bottom: 18px;
  width: 56px; height: 56px; border-radius: 999px;
  border: 0; cursor: pointer;
  display: grid; place-items: center;
  background: linear-gradient(135deg, #0b1b2b 0%, #16a34a 100%);
  box-shadow: 0 12px 30px rgba(0,0,0,.22);
  font-size: 22px;
  z-index: 99999;
  transition: transform .15s ease, box-shadow .15s ease;
}
.hai-btn:active{ transform: translateY(1px) scale(.98); }
.hai-btn:hover{ box-shadow: 0 16px 42px rgba(0,0,0,.28); }

.hai-panel{
  position: fixed; right: 18px; bottom: 86px;
  width: min(380px, calc(100vw - 36px));
  height: 520px;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 18px 60px rgba(0,0,0,.22);
  display: none;
  flex-direction: column;
  overflow: hidden;
  z-index: 99999;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  border: 1px solid rgba(15,23,42,.08);
}



.hai-header{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 14px;
  background: rgba(255,255,255,.92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(15,23,42,.08);
}
.hai-left{
  display:flex; align-items:center; gap:10px;
  min-width: 0;
}
.hai-dot{
  width: 10px; height: 10px; border-radius: 999px;
  background: #16a34a;
  box-shadow: 0 0 3px rgba(22,163,74,.18);
  flex: 0 0 auto;
}
.hai-title{
  font-weight: 700;
  font-size: 14px;
  line-height: 1.1;
  color: #0b1b2b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hai-sub{
  font-size: 12px;
  opacity: .72;
  margin-top: 2px;
  color: #0b1b2b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hai-actions{
  display:flex; align-items:center; gap:8px;
}

.hai-max{
  width: 34px; height: 34px;
  border-radius: 12px;
  border: 1px solid rgba(15,23,42,.10);
  background: #fff;
  cursor: pointer;
  display: grid; place-items: center;
  font-size: 16px;
  line-height: 1;
  transition: background .15s ease, transform .15s ease;
}
.hai-max:hover{ background: rgba(15,23,42,.04); }
.hai-max:active{ transform: scale(.98); }

.hai-close{
  width: 34px; height: 34px;
  border-radius: 12px;
  border: 1px solid rgba(15,23,42,.10);
  background: #fff;
  cursor: pointer;
  display: grid; place-items: center;
  font-size: 16px;
  line-height: 1;
  transition: background .15s ease, transform .15s ease;
}
.hai-close:hover{ background: rgba(15,23,42,.04); }
.hai-close:active{ transform: scale(.98); }

.hai-body{
  padding: 14px;
  flex: 1;
  overflow: auto;
  background: radial-gradient(1200px 500px at 50% 0%, rgba(11,27,43,.06), transparent 55%),
              #f7f8fb;
}

.hai-msg{ margin: 10px 0; display: flex; }
.hai-msg.user{ justify-content: flex-end; }

.hai-bubble{
  max-width: 86%;
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid rgba(15,23,42,.10);
  font-size: 13px;
  line-height: 1.35;
  white-space: pre-wrap;
  word-break: break-word;
  background: #fff;
  color: #0b1b2b;
  box-shadow: 0 6px 18px rgba(0,0,0,.06);
}
.hai-msg.user .hai-bubble{
  background: linear-gradient(135deg, #0b1b2b 0%, #16a34a 100%);
  color: #fff;
  border-color: rgba(255,255,255,.12);
}

.hai-footer{
  padding: 12px;
  border-top: 1px solid rgba(15,23,42,.08);
  background: #fff;
  display: flex;
  gap: 8px;
  align-items: center;
}

.hai-input{
  flex: 1;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(15,23,42,.14);
  outline: none;
  font-size: 13px;
  background: #fff;
}
.hai-input:focus{
  border-color: rgba(22,163,74,.45);
  box-shadow: 0 0 0 4px rgba(22,163,74,.14);
}

.hai-send{
  padding: 10px 12px;
  border-radius: 14px;
  border: 0;
  cursor: pointer;
  background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
  color: #fff;
  font-weight: 700;
  transition: transform .15s ease, filter .15s ease;
}
.hai-send:hover{ filter: brightness(1.02); }
.hai-send:active{ transform: translateY(1px) scale(.99); }

.hai-meta{
  font-size: 11px;
  opacity: .6;
  padding: 0 12px 10px;
}

/* Mobile: full-screen panel (app-like) */
@media (max-width: 520px){
  .hai-panel{
    right: 10px; left: 10px;
    bottom: 10px;
    width: auto;
    height: calc(100vh - 20px);
    border-radius: 18px;
  }
  .hai-btn{ right: 14px; bottom: 14px; }
}
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
  <div class="hai-left">
    <span class="hai-dot"></span>
    <div style="min-width:0">
      <div class="hai-title">Hotel Chat</div>
      <div class="hai-sub">${hotelId} • Online</div>
    </div>
  </div>
  <div class="hai-actions"> 
    <button class="hai-close" type="button" aria-label="Close">×</button>
  </div>
</div>

<div class="hai-body"></div>

<div class="hai-footer">
  <input class="hai-input" type="text" placeholder="Write a message..." autocomplete="off" />
  <button class="hai-send" type="button">Send</button>
</div>

<div class="hai-meta"></div>
`;

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  const body = panel.querySelector(".hai-body");
  const input = panel.querySelector(".hai-input");
  const sendBtn = panel.querySelector(".hai-send");
  const closeBtn = panel.querySelector(".hai-close");
  const maxBtn = panel.querySelector(".hai-max");

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

  function setMaxIcon() {
    const isFull = panel.classList.contains("hai-full");
    maxBtn.textContent = isFull ? "⤡" : "⤢";
    maxBtn.title = isFull ? "Exit full screen" : "Full screen";
    maxBtn.setAttribute("aria-label", maxBtn.title);
  }

  function toggle(open) {
    panel.style.display = open ? "flex" : "none";
    if (open) setTimeout(() => input.focus(), 50);
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
          hotel_key: hotelKey,
          session_id: sessionId,
          message
        })
      });

      const data = await res.json();

      // If backend returns a friendly reply even on errors (e.g., 429 limit), show it.
      if (!res.ok) {
        addMsg(data?.reply || data?.error || "Προσωρινό πρόβλημα. Δοκίμασε ξανά σε λίγο.", "bot");
        return;
      }

      addMsg(data?.reply || "OK", "bot");
    } catch (err) {
      addMsg("Προσωρινό πρόβλημα. Δοκίμασε ξανά σε λίγο.", "bot");
      console.error(err);
    }
  }

  // Open/close
  btn.addEventListener("click", () => toggle(panel.style.display !== "flex"));
  closeBtn.addEventListener("click", () => toggle(false)); 

  // Send actions
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });

  // First message
  addMsg("Γεια σου! Πώς μπορώ να βοηθήσω; (π.χ. check-in, πρωινό, parking)", "bot");
})();
