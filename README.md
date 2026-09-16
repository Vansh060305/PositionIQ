# PositionIQ 📊

AI-Powered Stock Position Monitoring & Decision-Support Platform

Short professional project description
+ disclaimer that it doesn't execute trades

## ✨ Core Features

1. Authentication & User Accounts
2. Real-Time Position Monitoring
3. P&L & Return Analytics
4. Portfolio Risk & Exposure Analysis
5. Explainable Decision Engine
6. Real-Time WebSocket Updates
7. Smart Alerts
8. Trade Navigator
9. Market Pulse
10. AI Assistant
11. What-If Simulator
12. Trade History & Position Closing

## 🧠 Intelligence Architecture

Deterministic decision engine
        ↓
Market + Position + Portfolio data
        ↓
Explainable recommendation

Gemini
        ↓
Actual PositionIQ context
        ↓
AI explanation / contextual Q&A

Clearly explain:
Gemini ≠ core trading decision
PositionIQ ≠ autonomous trading bot

## 🔄 User Flow

Landing
 → Register/Login
 → Dashboard
 → Create Position
 → Live Market Monitoring
 → P&L / Risk Analysis
 → Decision Engine
 → Alerts / AI Explanation
 → Close Position
 → Trade History

## 🏗️ System Architecture

React + Vite
        │
        │ REST / WebSocket
        ↓
FastAPI Backend
        │
        ├── Authentication
        ├── Position Management
        ├── Portfolio Analytics
        ├── Risk Engine
        ├── Decision Engine
        ├── Alert Engine
        └── AI Assistant
                │
        ┌───────┴────────┐
        ↓                ↓
   PostgreSQL         Gemini
     Neon
        │
        ↓
   Finnhub Market Data

## ⚡ Real-Time Architecture

Finnhub
   ↓
FastAPI
   ↓
WebSocket
   ↓
React Dashboard
   ↓
Live P&L / Risk / Position Updates

Explain why WebSocket is used.

## 🧠 Explainable Decision Engine

Market data
+ P&L
+ target/stop-loss
+ risk
+ portfolio conditions
        ↓
Rule-based evaluation
        ↓
BUY / ADD / HOLD / REDUCE / BOOK PROFIT /
TIGHTEN STOP / EXIT etc.

Explainable, deterministic and testable.

## 🤖 AI Assistant

PositionIQ Context
        ↓
Relevance / Safety Gate
        ↓
Gemini
        ↓
Contextual Explanation

Explain:
- Uses actual user's PositionIQ data
- Does not invent portfolio data
- Does not execute trades
- Does not replace decision engine

## 🔔 Alert System

STOP_NEAR
TARGET_NEAR
HEALTH_DROP

+ deduplication
+ real-time notification

## 🧪 What-If Simulator

Scenario
 ↓
Position / Portfolio recalculation
 ↓
P&L impact
 ↓
Portfolio value
 ↓
Risk / Health impact
 ↓
Scenario comparison

## 🔐 Security

JWT
Password hashing
Protected routes
User ownership isolation
Input validation
CORS
Prompt-injection safeguards
Environment secrets

## 🚀 Live Demo

Frontend
API Docs

## 🛠️ Tech Stack

Frontend
Backend
Database
Market Data
AI
Real-Time
Testing
Deployment

## 📂 Project Layout

PositionIQ/
├── backend/
│   ├── ...
├── frontend/
│   ├── ...
├── docs/
├── docker-compose.yml
├── .gitignore
└── README.md

Actual folders/components ko project ke according explain karenge.

## ⚙️ Quick Start

### Backend
...
### Frontend
...

## 🧪 Testing

106/106 backend tests
+
what the tests cover

## 🏛️ Architecture Decisions

Why PostgreSQL
Why FastAPI
Why WebSockets
Why deterministic decision engine
Why Gemini is explanation-only
Why no autonomous trading

## ⚠️ Disclaimer

Analytics / decision-support only.
No trade execution.
No guaranteed financial outcomes.
Market data / AI explanations can contain inaccuracies.

## 🎯 Project Highlights

- Full-stack production deployment
- Real-time market data
- WebSocket architecture
- Explainable financial decision engine
- Portfolio risk analytics
- AI explanation layer
- Automated alerts
- Scenario simulation
- Secure multi-user architecture
- Automated backend testing
