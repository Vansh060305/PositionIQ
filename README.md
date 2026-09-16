# PositionIQ 📈

**AI-powered stock position monitoring and decision-support platform.**

PositionIQ helps users monitor their stock positions, P&L, portfolio risk/exposure, real-time market information, alerts, scenario analysis, and contextual AI explanations. Every position gets a live 0–100 health score and an explainable recommendation, streamed to the UI in real time.

> ⚠️ PositionIQ is **not** a trading bot. It does **not** execute trades, place orders, or move money. It is a monitoring and decision-support tool — every action remains with the user.

🔗 **Live demo:** [positioniq-app.vercel.app](https://positioniq-app.vercel.app/) · [API Docs](https://positioniq-r9ud.onrender.com/docs)

---

## ✨ Core Features

- **Position Tracking** — create and manage LONG/SHORT positions with entry price, quantity, stop-loss, target, exchange and sector.
- **Real-Time Monitoring** — live market prices from Finnhub, streamed to the dashboard over WebSocket (no manual refresh).
- **Health Scoring** — a deterministic 0–100 score per position based on P&L, stop-loss buffer, target proximity and volatility.
- **Explainable Recommendations** — one clear action per position (HOLD, REDUCE, TIGHTEN STOP, BOOK PROFIT, HEDGE, EXIT) with a confidence score.
- **Portfolio Analytics** — sector-wise exposure and a diversification score computed with the Herfindahl–Hirschman Index (HHI).
- **Alerts** — automatic notifications when a stop is near, a target is near, or a health score drops.
- **What-If Simulator** — simulate a hypothetical price and see the resulting P&L, health score and recommendation, without touching real positions.
- **AI Assistant** — a grounded chat that answers questions using your real PositionIQ data only.
- **Daily Digest** — an optional email summary of every open position's latest health and action.
- **Trade History** — closed positions with realized P&L and win rate.
- **Plan Limits** — free accounts track up to 10 open positions; a one-click PRO demo upgrade removes the cap.

## 🧠 Intelligence Architecture

PositionIQ separates its intelligence into two clearly distinct layers:

### 1. Deterministic Decision Engine (the core)
The health score and the recommendation are produced by **pure, rule-based logic** — real market prices, stored position data and portfolio conditions go in, one explainable action comes out. Same inputs always produce the same output: no randomness, no ML.

### 2. Gemini Explanation Layer (the voice)
Gemini is used **only** to explain, in plain English, what the deterministic engine already decided, and to power the contextual Q&A assistant. It receives PositionIQ's real data as context and is explicitly instructed to never invent numbers, never suggest a different action, and never make decisions.

> **Gemini never makes trading decisions — the rule engine does, and Gemini explains them.** This keeps every recommendation auditable and testable.

## 🔄 User Flow

1. **Register / Login** → JWT-secured account.
2. **Add positions** (LONG or SHORT) with entry price, quantity, stop-loss/target.
3. **Dashboard** → live prices, P&L, health scores, sector exposure and diversification.
4. **Position Detail** → health history chart, current signal, confidence and a Gemini explanation.
5. **Navigator** → ranked view of which position needs attention most, with reasons.
6. **Pulse** → an overall 0–100 status of your holdings (POSITIVE / NEUTRAL / CAUTION / NEGATIVE).
7. **Alerts & AI Assistant** → get notified, ask questions, run What-If scenarios.
8. **Close position** → exit price prefilled from the live quote; realized P&L recorded in Trade History.

## 🏗️ System Architecture

```
┌─────────────────┐        REST + WebSocket        ┌─────────────────┐
│  React + Vite   │ ◄────────────────────────────► │  FastAPI Backend │
│    Frontend     │                                │    (Python)      │
└─────────────────┘                                └────────┬────────┘
                                                            │
                                    ┌───────────────────────┼───────────────────────┐
                                    ▼                       ▼                       ▼
                            ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
                            │  PostgreSQL  │        │   Finnhub    │        │    Gemini    │
                            │    (Neon)    │        │ (Market Data)│        │ (Explanation)│
                            └──────────────┘        └──────────────┘        └──────────────┘
```

- **Frontend ↔ Backend** communicate over REST (axios) for all CRUD operations and over a single authenticated WebSocket for live updates.
- **Backend** owns all business logic: authentication, position/health/decision services, alerts, the simulator, the assistant and the background broadcast loop.
- **PostgreSQL (Neon)** persists users, positions, health snapshots, decisions, alerts and what-if runs.
- **Finnhub** is the single source of live market prices — fetched only server-side through one dedicated service.
- **Gemini** is called only for explanations and assistant answers, using real PositionIQ context.

## ⚡ Real-Time Architecture

A background task inside the FastAPI app re-analyzes every connected user's open positions **every 60 seconds**:

1. Fetch a fresh Finnhub quote for each open position.
2. Recompute the health snapshot, decision and alerts.
3. Push a `decision_update` payload over WebSocket to every tab the user has open.

The React frontend mounts **one shared WebSocket** (`/ws/positions`) for the whole app — live P&L, prices, scores and alerts update in place, with no polling and no manual refresh. Failed quotes degrade gracefully to the last real stored snapshot (labeled *stale*) rather than showing fake data.

## 🎯 Explainable Decision Engine

The health score is a weighted 0–100 composite of real inputs:

| Factor | Weight | Source |
|---|---|---|
| P&L performance | 40 pts | entry price vs. live price (direction-aware) |
| Stop-loss buffer | 30 pts | distance to stop |
| Target proximity | 15 pts | distance to target |
| Volatility | 15 pts | today's high-low range |

The rule engine then picks exactly one action, checked most-urgent-first — deterministic, explainable and fully covered by unit tests:

| Condition | Action | Confidence |
|---|---|---|
| Stop-loss breached | `EXIT` | 95% |
| Target reached | `BOOK PROFIT` | 90% |
| Health score < 30 | `EXIT` | 85% |
| Stop within 3% | `TIGHTEN STOP` | 80% |
| Health score < 50 | `REDUCE` | 70% |
| Strong profit, near target | `BOOK PROFIT` | 75% |
| Volatility > 8% & health < 70 | `HEDGE` | 65% |
| Trend turned DOWN while in profit | `TIGHTEN STOP` | 60% |
| Nothing urgent | `HOLD` | 60% |

The pure scoring math and the rule chain are isolated in separate modules with no DB or network dependencies, which makes them trivially unit-testable.

## 💬 AI Assistant

```
User Question → PositionIQ Context → Relevance/Safety Gate → Gemini → Contextual Explanation
```

- **Relevance gate** — a deterministic filter runs before any Gemini call; off-topic questions get a polite redirect and never reach the model.
- **Real context only** — the prompt is built from the user's own positions, portfolio summary, and (when asked about) Market Pulse / Trade Navigator data. No fabricated portfolio information, no cross-user data.
- **Strict guardrails** — the user's question is fenced as untrusted input; the system prompt forbids overriding the deterministic engine, guaranteeing profits, giving unsupported buy tips, or executing trades.
- **Read-only** — the assistant never writes to the database, never places orders, and never replaces the core decision engine.

## 🔔 Alert System

After every analysis cycle, the backend checks each open position and creates alerts for:

| Alert | Triggered when |
|---|---|
| `STOP_NEAR` | Price is within 5% of the stop-loss |
| `TARGET_NEAR` | Price is within 5% of the target |
| `HEALTH_DROP` | Health score falls below 40 |

Alerts are **deduplicated**: the same position + alert type is not repeated within a 30-minute window, so one condition produces one clear notification instead of an alert storm. New alerts arrive in real time through the WebSocket and appear in the in-app notification bell.

## 🧪 What-If Simulator

Enter any hypothetical price for a position and instantly see what the **same** deterministic engine would say: simulated P&L, health score, stop/target distances and the predicted action. It reuses the exact production scoring and rule modules — a simulation and a real analysis are always calculated identically.

Simulations are purely virtual: real positions, snapshots and decisions are never modified, and the simulator never calls Finnhub (the price is hypothetical). Each run is logged for history.

## 🔐 Security

- **JWT authentication** — issued on login, verified on every protected endpoint; expired/invalid tokens are rejected everywhere, including WebSocket connections.
- **Password hashing** — bcrypt via passlib; passwords are never stored in plain text.
- **Protected routes** — every business route requires an authenticated user; role-based access control (USER / ANALYST / ADMIN).
- **Ownership isolation** — every query filters by `user_id` server-side; accessing another user's position returns `403`.
- **Input validation** — Pydantic schemas with server-side rules (valid email, 8+ character passwords, bounded inputs).
- **CORS configuration** — explicit allow-list of frontend origins only.
- **Environment secrets** — API keys and credentials live in `.env`, never in code.
- **AI safeguards** — relevance gate, grounded prompts, injection-resistant fencing and clean failure messages (no stack traces or keys leaked).

## 🌐 Live Demo

| | |
|---|---|
| **Frontend** | https://positioniq-app.vercel.app/ |
| **Backend API** | https://positioniq-r9ud.onrender.com/ |
| **API Docs** | https://positioniq-r9ud.onrender.com/docs |

*(Free-tier hosting: the backend may take ~30s to wake up on the first request.)*

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS, Zustand, React Router, Recharts, Framer Motion, Axios |
| **Backend** | Python, FastAPI, SQLAlchemy, Pydantic |
| **Database** | PostgreSQL (Neon) |
| **Market Data** | Finnhub API |
| **AI** | Google Gemini API |
| **Real-Time** | WebSockets (FastAPI + browser) |
| **Testing** | Pytest, pytest-cov |
| **Deployment** | Vercel (frontend), Render (backend), Docker available for local orchestration |

## 📁 Project Layout

```
positionIQ/
├── backend/
│   ├── main.py               # FastAPI app, CORS, router registration, background loops
│   ├── init_db.py            # One-time table creation
│   ├── core/                 # Config, database, security (JWT/bcrypt), dependencies
│   ├── models/               # SQLAlchemy models (User, Position, HealthSnapshot, Decision…)
│   ├── schemas/              # Pydantic request/response schemas
│   ├── routes/               # API endpoints (auth, positions, market, alerts, ws…)
│   ├── services/             # Business logic (engines, market data, assistant…)
│   └── tests/                # Pytest suite
├── frontend/
│   ├── src/
│   │   ├── api/              # Axios client + per-domain API modules
│   │   ├── components/       # UI components (dashboard, assistant, navigator…)
│   │   ├── pages/            # Dashboard, Position Detail, Navigator, Pulse…
│   │   ├── store/            # Zustand stores (auth, live updates, alerts…)
│   │   └── hooks/            # Shared WebSocket hook
│   └── package.json
├── docs/                     # Demo script
└── docker-compose.yml        # Local Postgres + backend
```

## 🚀 Quick Start

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows  (Linux/macOS: source venv/bin/activate)
pip install -r requirements.txt
cp .env.example .env             # fill in your values
python init_db.py                # creates all tables
uvicorn main:app --reload
```

**Required environment variables** (see `backend/.env.example`):

```env
DATABASE_URL=postgresql://user:password@host/db?sslmode=require
JWT_SECRET_KEY=your-secret-key
FINNHUB_API_KEY=your-finnhub-key
GEMINI_API_KEY=your-gemini-key
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env             # VITE_API_URL=http://127.0.0.1:8000
npm run dev
```

Open http://localhost:5173, register an account, and add your first position.

### Docker (optional)

```bash
docker compose up        # local Postgres + backend
```

## 🧪 Testing

The backend has a comprehensive pytest suite — **106/106 tests passing** — covering:

- **Engine math** — P&L (LONG/SHORT), stop/target distances, health score, trend detection.
- **Decision rules** — every rule branch and confidence value.
- **Auth & security** — registration, login, JWT validation, ownership isolation.
- **API endpoints** — positions, portfolio, market data, simulator, alerts.
- **Live updates** — the WebSocket broadcast tick.
- **AI assistant** — the relevance gate and grounding behavior.
- **Navigator & Pulse** — attention ranking and pulse scoring.

Tests run against an isolated in-memory database — no external services required.

```bash
cd backend
pytest
```

## 💡 Architecture Decisions

- **PostgreSQL (Neon)** — relational data (users → positions → snapshots → decisions) with strong consistency, serverless-friendly and free to host.
- **FastAPI** — async, type-safe with Pydantic validation, automatic OpenAPI docs, and first-class WebSocket support.
- **WebSockets** — positions "watch themselves": one background loop pushes fresh analysis to all connected clients, instead of the frontend hammering the API with polling.
- **Deterministic decision engine** — same inputs → same output. Every recommendation is explainable, auditable and unit-testable. An ML/LLM model making opaque decisions would undermine trust in a financial tool.
- **Gemini as explanation layer only** — natural-language Q&A is where LLMs shine; making them the decision-maker would introduce non-determinism into the core loop. The strict separation gives the best of both.
- **No autonomous trading** — a decision-support tool must never move user money. PositionIQ deliberately stops at recommendations; execution stays with the user and their broker.

## ⚠️ Disclaimer

PositionIQ is an educational project built to demonstrate full-stack engineering, real-time systems and responsible AI design. It is **not** financial advice, and it is **not** a licensed brokerage or investment platform. Recommendations are generated by deterministic rules over the data available — always do your own research and consult a qualified financial advisor before making investment decisions.

## ⭐ Project Highlights

- **Real data everywhere** — live Finnhub prices, real P&L math, real persistence; nothing is mocked, and missing data is shown as missing.
- **Explainable by design** — every signal traces back to readable rules and real numbers, not a black box.
- **Production-grade auth & isolation** — JWT + bcrypt + server-side ownership enforcement.
- **Real-time without polling** — a single shared WebSocket, a background analysis loop and graceful stale-data fallbacks.
- **Grounded AI** — deterministic relevance gate + strict guardrails; Gemini explains, never decides.
- **Tested core** — 106 passing backend tests with the critical engines covered first.
