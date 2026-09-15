# PositionIQ — Interview Demo Script

A ~15-minute guided walkthrough of PositionIQ, built to show a reviewer the product,
the engineering, and the judgment behind it. Speak the **bold** lines, use the bullets
as your talking points, and keep the Cheat Sheet handy for questions.

---

## The pitch (30 seconds)

> **"PositionIQ is a real-time portfolio analysis platform. It pulls live market
> data from Finnhub, runs a fully deterministic health-and-decision engine on every
> position, streams fresh analysis to the UI over WebSockets, and uses Gemini only
> to *explain* what the engine already decided — never to make the decision.
> Everything is persisted in Neon PostgreSQL, and every number you'll see is real."**

**Stack in one breath:** FastAPI · SQLAlchemy · Neon/PostgreSQL · Finnhub (quotes) ·
Gemini (explanation layer) · WebSocket live updates · React + Vite (Tailwind, dark FinTech UI).

---

## Pre-flight (before the call)

- Both servers running: backend `http://127.0.0.1:8000` (`venv/Scripts/python -m uvicorn main:app --host 127.0.0.1 --port 8000` — no `--reload`), frontend `http://localhost:5173` (`npm run dev`).
- A logged-out browser tab on the **landing page**.
- Have the `backend/.env` ready in case they ask about config (never read values aloud).
- Optional: a second browser profile if you want to demo user isolation.

---

## 1 · Register — "the account is real and the validation is real"

> **"Let's create an account. Note there's no email-verification maze — you register
> and you're in, because auth is OAuth2/JWT with hashed passwords."**

1. Go to **Register** (header → Create an account).
2. **Type an invalid email first** (e.g. `notanemail.com`) → browser blocks it.
3. **Type a browser-valid but malformed email** (e.g. `a..b@example.com`) → backend
   Pydantic `EmailStr` returns `422` and the UI shows *"Please enter a valid email address."*
4. Register with a fresh email + 8+ char password → auto-login → Dashboard.

**Talking points**
- Email + password validation is enforced **server-side**, not just in the form.
- Short passwords are rejected (`422`) — the 8-character minimum lives in the backend schema.
- Duplicate emails → clean `400`; JWT is issued on login, stored in localStorage, and
  the API client auto-clears the session on any `401` (expired token → back to Login).
- Every protected endpoint returns `401` without a token, and cross-user access returns
  `403` — ownership is enforced in the data layer, not just the UI.

---

## 2 · Open a position — "real prices, real LONG/SHORT math"

> **"Let's open two positions: a LONG and a SHORT. The entry price is mine to choose,
> but everything after this is live market data."**

1. Dashboard → **Add position**.
2. Symbol `AAPL`, exchange NASDAQ, quantity, entry price, optional stop-loss/target,
   position type **LONG** → save.
3. Add a second one: `TSLA`, position type **SHORT**.

**Talking points**
- The backend fetches a **fresh Finnhub quote** (`GET /market/quote/{symbol}`) — the
  current price, day change, high/low shown on the dashboard are live, never mocked.
- P&L is **direction-aware**: LONG profit when price rises, SHORT profit when it falls.
  Watch the SHORT row flip red when the price ticks up.
- Positions are persisted in Neon — refresh the page and they're still there; log out
  and back in, still there.
- The **FREE plan caps at 10 open positions** (backend `403` on the 11th); **PRO Demo**
  is a one-click header button with no payment, and removes the cap.

---

## 3 · Deterministic analysis — "explainable, not magical"

> **"This is the core. PositionIQ computes a 0–100 health score from real quote data,
> then a rule engine turns it into exactly one action. Same inputs, same answer —
> every time."**

1. Open a position row → **Position Detail**.
2. Point at **POSITION SCORE**, the **SIGNAL** (e.g. `TIGHTEN STOP · 80% confidence`),
   and the **SCORE HISTORY** chart.
3. Click **Run analysis** to re-run it live.

**Talking points**
- The decision engine is a deterministic rule chain, checked most-urgent-first:
  stop breached → `EXIT` (95%) · target reached → `BOOK_PROFIT` (90%) · health < 30 → `EXIT` ·
  stop within 3% → `TIGHTEN STOP` · health < 50 → `REDUCE` · … else `HOLD`.
- The **score history chart** is real snapshots saved to Neon on each analysis cycle —
  no fake score movement, and the in-flight guard means React StrictMode can't double-write.
- **Gemini never decides.** It only writes the *"plain-English explanation"* for a
  decision the rule engine already made — that keeps the engine auditable.
- Health inputs are real: P&L %, distance to stop/target, volatility, trend — all from
  the live quote + stored position.

---

## 4 · Live updates — "no refresh, no polling"

> **"Leave this page open. Every ~60 seconds the backend re-analyzes open positions,
  fetches fresh Finnhub quotes, and pushes the new analysis over a WebSocket."**

1. Stay on Position Detail with the **LIVE MARKET** card and timestamp visible.
2. Wait for the next cycle — watch the timestamp change and **"LIVE UPDATE RECEIVED"**
   appear, with price/P&L/score updating **without a page refresh**.

**Talking points**
- One authenticated WebSocket (`/ws/positions`) shared across the whole app — no
  duplicate sockets, no reconnect storms: it retries every 5s on drops but **logs out
  instead of retrying forever** when the token is rejected.
- If the market price doesn't move, the UI correctly stays unchanged — no fake ticks.
- A single failed quote never breaks the loop: that position falls back to its last
  **real** stored snapshot and is labeled stale rather than pretending to be live.

---

## 5 · Trade Navigator — "which position needs me right now"

> **"Navigator answers one question: which of my open positions needs attention most
> right now — ranked, with the reasons."**

1. Header → **Navigator**.
2. Point at the summary strip (open / HIGH ATTENTION / WATCH / HEALTHY) and the ranked cards.
3. Open one card: attention score `/100`, **driving factors**, **primary reason**,
   and **next thing to watch**.

**Talking points**
- The ranking is built from real position conditions: health score, current action,
  stop-loss proximity, target proximity, P&L. It's the same deterministic engine the
  whole app uses — nothing invented, no random weights.
- Tiers are color + text/badge, not color alone (accessible).
- Cards link to the existing **Position Detail** — Navigator summarizes, it never
  duplicates the detail page, and it **never trades** (decision-support only).

---

## 6 · Market Pulse — "honest about what it knows"

> **"Pulse is deliberately scoped: it's a pulse of *your holdings*, not a fake
  market-wide dashboard. It computes exactly what the data supports."**

1. Header → **Pulse**.
2. Read the status chip (`POSITIVE` / `NEUTRAL` / `CAUTION` / `NEGATIVE`), the headline,
   and the deterministic **reasons list**.
3. Point at the breadth bars and the per-holding rows with **LIVE / STALE / NO DATA** markers.

**Talking points**
- Pulse = exposure-weighted health (50) + breadth in profit (25) + live day-change (15)
  + volatility (10) → 0–100 → status. Every reason in the list traces to a real number.
- The Finnhub integration is **quote-level only**, so Pulse explicitly does **not**
  invent index benchmarks, market volume, or historical momentum — it says "Your
  Holdings Market Pulse" and stops there.
- Missing quotes degrade gracefully: STALE (last real snapshot) or NO DATA (never a
  fabricated price), and one failed symbol never blanks the whole pulse.

---

## 7 · AI Assistant — "grounded, guarded, on your data"

> **"And the assistant: it's not a chatbot bolted on — it answers only from this
  user's real PositionIQ data, and it's told to say 'I don't have that' instead of
  guessing."**

1. Header → **✦ AI Assistant** (drawer slides in from the right; **Expand** widens it).
2. Ask a data question: *"Which position needs the most attention right now?"*
3. Point at the answer citing **real numbers** (attention score, stop buffer, health)
   and the source footer *"Based on your PositionIQ data · 3 open positions · Trade Navigator"*.
4. Ask an irrelevant question: *"Tell me a joke."* → the backend redirects politely.
5. Close and reopen the drawer → the conversation survives (in-session, not persisted).

**Talking points**
- The assistant backend builds compact context from **the user's own** positions,
  portfolio, Pulse and Navigator data — no fresh Finnhub calls for every question,
  no other user's data, and a client-supplied symbol is never trusted cross-user.
- Prompt-injection is handled: the user's question is fenced as untrusted input and
  system grounding rules can't be overridden; there's a test for it.
- Safety wording is enforced: no profit guarantees, no buy tips, no trade execution.
  On Gemini failure the user gets a clean error — never a stack trace or key.
- Guardrail is a deterministic relevance gate first; Gemini only explains in-scope,
  real questions.

---

## Optional encore (2 min) — Close a position

> **"Closing a position pre-fills the live market price — no manual typing — and the
  realized P&L is computed on the backend, direction-aware."**

Close the SHORT → confirm exit price = live quote → **Trade History** shows the closed
row with realized P&L (e.g. `(entry − exit) × qty`), total realized P&L, and win rate.

---

## Likely reviewer questions — cheat sheet

| They ask | You say |
|---|---|
| "Where do the prices come from?" | Finnhub, fetched fresh per analysis cycle; stored snapshots labeled STALE are the only fallback. |
| "Is the AI making trading decisions?" | No. The decision engine is deterministic rules; Gemini only explains its output. |
| "What happens if Finnhub fails?" | That position falls back to its last real snapshot (STALE) or shows NO DATA; one failure never breaks the others. |
| "How is my data isolated?" | Every query filters by `user_id` server-side; cross-user access returns 403; JWT protects all endpoints. |
| "Is the UI updating live?" | Yes — a single shared WebSocket pushes backend analysis every ~60s; no refresh needed. |
| "Where is this deployed?" | Neon PostgreSQL + FastAPI backend + React frontend; local dev runs both via the run doc. |
| "Is any data fake?" | No. All market data is real; anything unavailable is shown as unavailable. |

---

## Timing budget (optional)

| Section | Minutes |
|---|---|
| Pitch + stack | 0.5 |
| Register | 2 |
| Open positions | 2 |
| Deterministic analysis | 3 |
| Live updates | 2 |
| Trade Navigator | 2 |
| Market Pulse | 2 |
| AI Assistant | 3 |
| (Encore) Close | 2 |
| Q&A | rest |