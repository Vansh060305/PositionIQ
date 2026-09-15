// Landing page recreated from the NiveshMitra reference: same section
// order, layout, spacing, animations, scroll reveals, tilt preview and
// responsive behavior. Only the content is PositionIQ's own.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  LineChart,
  BarChart3,
  SlidersHorizontal,
  ShieldCheck,
  Bell,
  MessageSquareText,
  Gauge,
} from "lucide-react";
import BrandMark from "../components/BrandMark";
import "../landing.css";

// PositionIQ icons mapped onto the reference's icon slots.
const ICONS = {
  brand: LineChart,
  analysis: BarChart3,
  chat: MessageSquareText,
  plan: Gauge,
  sliders: SlidersHorizontal,
  shield: ShieldCheck,
  bell: Bell,
};

function Icon({ name, size = 22, strokeWidth = 1.8 }) {
  const Cmp = ICONS[name] || LineChart;
  return <Cmp size={size} strokeWidth={strokeWidth} />;
}

const FEATURES = [
  {
    icon: "analysis",
    title: "Position analysis screen",
    text: "Every position gets its own report: score, risk factors, and the recommended action, laid out clearly.",
  },
  {
    icon: "sliders",
    title: "What-if simulator",
    text: "Drag the price and watch the score, P&L, and recommended action update instantly.",
  },
  {
    icon: "bell",
    title: "Real-time alerts",
    text: "In-app alerts the moment a position's score drops or a stop-loss gets close.",
  },
  {
    icon: "chat",
    title: "AI market insights",
    text: "Ask an AI with full context on your position and get the reasoning behind any call.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Monitor",
    text: "Live prices stream in for every open position, continuously.",
  },
  {
    n: "02",
    title: "Score",
    text: "A 0-100 position score is calculated from P&L, stop-loss buffer, target proximity, and volatility.",
  },
  {
    n: "03",
    title: "Recommend",
    text: "A deterministic rules engine picks one action: hold, book profit, tighten stop, reduce, hedge, or exit.",
  },
  {
    n: "04",
    title: "Explain",
    text: "The recommendation is translated into plain English, so the reasoning is never a black box.",
  },
];

const STATS = [
  { value: "0-100", label: "Position score scale" },
  { value: "6", label: "Clear action signals" },
  { value: "24/7", label: "Live market monitoring" },
  { value: "100%", label: "Plain-English explanations" },
];

// Sample score history: a healthy position improving over recent weeks.
function scoreHistoryData() {
  return [
    { week: "W1", Score: 52, Pnl: -2.1 },
    { week: "W2", Score: 58, Pnl: 0.4 },
    { week: "W3", Score: 61, Pnl: 1.8 },
    { week: "W4", Score: 66, Pnl: 3.2 },
    { week: "W5", Score: 71, Pnl: 4.6 },
    { week: "W6", Score: 74, Pnl: 5.9 },
    { week: "W7", Score: 79, Pnl: 6.8 },
    { week: "W8", Score: 82, Pnl: 7.4 },
  ];
}

const DEMO_ALLOC = [
  { name: "Technology", value: 45, color: "#8ab4f8" },
  { name: "Healthcare", value: 20, color: "#81c995" },
  { name: "Financials", value: 20, color: "#fdd663" },
  { name: "Energy", value: 15, color: "#9b72cb" },
];

// Mock conversation showing monitoring → score → recommendation → alert.
const SAMPLE_CHAT = [
  {
    who: "ai",
    text: "Hey! I'm PositionIQ. What are you holding right now?",
  },
  {
    who: "user",
    text: "I bought TSLA last week and the dip is making me nervous.",
  },
  {
    who: "ai",
    text: "Let's look at it together. How far below entry are you, and where's your stop?",
  },
  { who: "user", text: "Down about 4%, stop at $180." },
  {
    who: "ai",
    text: "Score is 62 — still healthy, but the trend just flipped. I'd tighten the stop to lock in most of the gain. Here's your analysis 👇",
  },
  {
    who: "calm",
    text: "And if it swings more — breathe. You'll get a live alert the moment the score crosses 50.",
  },
];

const PERSONALIZE = [
  {
    icon: "chat",
    title: "Plain English, always",
    text: "Every recommendation is translated from a score into plain English — no black-box reasoning, ever.",
  },
  {
    icon: "plan",
    title: "Risk aware",
    text: "Scores weigh P&L, stop-loss buffer, target proximity and volatility — not a generic template.",
  },
  {
    icon: "shield",
    title: "Action framed",
    text: "Every call comes with the why, the trade-offs, and what would change the view.",
  },
  {
    icon: "sliders",
    title: "Yours to explore",
    text: "Adjust the simulated price and watch the score and recommended action update live.",
  },
];

const TRUST = [
  {
    icon: "shield",
    title: "Always disclaimed",
    text: "Every analysis is clearly marked decision-support — never a buy/sell signal.",
  },
  {
    icon: "plan",
    title: "Risk-first framing",
    text: "Scores weigh stop-loss buffer, target proximity and volatility — not hype.",
  },
  {
    icon: "analysis",
    title: "Deterministic engine",
    text: "Recommendations come from a fixed rules engine — no model mood, no guesswork.",
  },
  {
    icon: "bell",
    title: "Real-time safety net",
    text: "Alerts catch a dropping score or a stop-loss breach the moment it happens.",
  },
];

const CATEGORIES = [
  { name: "Technology", tag: "High growth", color: "#8ab4f8" },
  { name: "Healthcare", tag: "Defensive", color: "#9b72cb" },
  { name: "Financials", tag: "Value", color: "#81c995" },
  { name: "Energy", tag: "Cyclical", color: "#fdd663" },
  { name: "Consumer", tag: "Staples", color: "#7cd3e0" },
  { name: "Industrials", tag: "Momentum", color: "#f28b82" },
  { name: "Utilities", tag: "Low beta", color: "#ff8a65" },
];

const SUITE = [
  {
    icon: "analysis",
    title: "PositionIQ",
    tag: "You are here",
    text:
      "The front door — tracks every open position, scores it from 0 to 100 " +
      "in real time, and tells you the exact next move.",
  },
  {
    icon: "plan",
    title: "Position Analysis",
    tag: "Per-position",
    text:
      "A full report for every holding: score, risk factors, P&L, stop " +
      "buffer and the recommended action, laid out clearly.",
  },
  {
    icon: "sliders",
    title: "What-if Simulator",
    tag: "Exploration",
    text:
      "Drag the price to see how the score, P&L and recommended action " +
      "would change before you commit.",
  },
  {
    icon: "chat",
    title: "AI Insights",
    tag: "Explanation",
    text:
      "Ask why a recommendation was made and get grounded, plain-English " +
      "reasoning with full context on your position.",
  },
];

const FAQS = [
  {
    q: "Is this registered financial advice?",
    a: "No. PositionIQ is decision-support — it explains scores and recommends actions, but every trade and its risk stays yours.",
  },
  {
    q: "Is it free?",
    a: "Yes — track up to 10 positions free forever. No card, no trial. PRO unlocks unlimited positions and real-time alerts.",
  },
  {
    q: "How is this different from a normal stock dashboard?",
    a: "It doesn't just show prices. It scores each position from 0 to 100, picks one clear action, and explains the reasoning in plain English.",
  },
  {
    q: "Does it use live market data?",
    a: "Yes — real-time prices stream in for every open position over WebSocket, so scores and alerts update as the market moves.",
  },
  {
    q: "What are the action recommendations?",
    a: "A deterministic rules engine picks one of six: hold, book profit, tighten stop, reduce, hedge, or exit — based on P&L, stop buffer, target proximity and volatility.",
  },
  {
    q: "How does AI Insights work?",
    a: "You ask a question about a position and the AI answers with full context on that position's live analysis — not a generic chatbot response.",
  },
  {
    q: "What happens when a position crosses a threshold?",
    a: "You get a real-time in-app alert the moment a score drops or a stop-loss gets close.",
  },
];

export default function Landing() {
  const data = useMemo(() => scoreHistoryData(), []);
  const finalScore = data[data.length - 1].Score;
  const [openFaq, setOpenFaq] = useState(0);
  const landingRef = useRef(null);

  useEffect(() => {
    const root = landingRef.current;
    if (!root || typeof window === "undefined") return undefined;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const revealItems = Array.from(
      root.querySelectorAll(
        ".hero-left, .hero-preview, .section, .step-card, .feature-card, .compare-col, .cat-chip, .faq-item, .free-band, .cta-band",
      ),
    );

    root.classList.add("reveal-ready");
    revealItems.forEach((el, index) => {
      el.classList.add("revealable");
      el.style.setProperty("--reveal-delay", `${(index % 6) * 55}ms`);
    });

    const showItem = (el) => el.classList.add("is-visible");
    let observer;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealItems.forEach(showItem);
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            showItem(entry.target);
            observer.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
      );

      revealItems.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.9) {
          showItem(el);
        } else {
          observer.observe(el);
        }
      });
    }

    const hero = root.querySelector(".hero");
    const onPointerMove = (event) => {
      if (!hero || reduceMotion) return;
      const rect = hero.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      root.style.setProperty("--hero-rotate-y", `${(-x * 7).toFixed(2)}deg`);
      root.style.setProperty("--hero-rotate-x", `${(y * 5).toFixed(2)}deg`);
    };
    const resetHero = () => {
      root.style.setProperty("--hero-rotate-y", "0deg");
      root.style.setProperty("--hero-rotate-x", "0deg");
    };

    if (hero && !reduceMotion) {
      hero.addEventListener("pointermove", onPointerMove);
      hero.addEventListener("pointerleave", resetHero);
    }

    return () => {
      observer?.disconnect();
      if (hero) {
        hero.removeEventListener("pointermove", onPointerMove);
        hero.removeEventListener("pointerleave", resetHero);
      }
      revealItems.forEach((el) => {
        el.classList.remove("revealable", "is-visible");
        el.style.removeProperty("--reveal-delay");
      });
      root.classList.remove("reveal-ready");
    };
  }, []);

  return (
    <div className="landing" ref={landingRef}>
      <header className="landing-nav">
        <div className="brand">
          <span className="logo brand-mark">
            <BrandMark size={26} />
          </span>
          <h1>PositionIQ</h1>
        </div>
        <div className="landing-nav-right">
          <a className="nav-link" href="#how">
            How it works
          </a>
          <a className="nav-link" href="#why">
            Why us
          </a>
          <Link className="ghost-btn small" to="/login">
            Log in
          </Link>
          <Link className="cta-btn small" to="/register">
            Start free
          </Link>
        </div>
      </header>

      {/* ---- HERO ---- */}
      <section className="hero">
        <div className="hero-left">
          <span className="hero-eyebrow">● REAL-TIME POSITION ANALYSIS</span>
          <h2 className="hero-title">
            Know exactly what to do with{" "}
            <span className="grad-text">every open position</span>.
          </h2>
          <p className="hero-sub">
            PositionIQ scores every position you hold from 0 to 100 and tells
            you the exact next move — book profit, tighten the stop, hedge, or
            exit. Backed by <em>live market data</em>, explained in plain
            English.
          </p>
          <div className="hero-actions">
            <Link className="cta-btn" to="/register">
              Start free →
            </Link>
            <a className="ghost-btn" href="#how">
              See how it works
            </a>
          </div>
          <div className="stats-row">
            {STATS.map((s) => (
              <div className="stat-pill" key={s.label}>
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ---- Product preview: score chart + sector demo ---- */}
        <div className="hero-preview">
          <div className="preview-card">
            <div className="preview-bar">
              <span className="dotrow">
                <i style={{ background: "#f28b82" }} />
                <i style={{ background: "#fdd663" }} />
                <i style={{ background: "#81c995" }} />
              </span>
              <span className="preview-title">Your positions at a glance</span>
              <span className="preview-live">● live demo</span>
            </div>

            <div className="preview-chart">
              <div className="preview-chart-head">
                <div>
                  <div className="pc-label">Portfolio score</div>
                  <div className="pc-value">{finalScore}</div>
                </div>
                <div className="pc-tag">12 positions · 6 sectors</div>
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart
                  data={data}
                  margin={{ top: 6, right: 6, left: -18, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#9b72cb" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#9b72cb" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gPnl" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#8ab4f8"
                        stopOpacity={0.25}
                      />
                      <stop offset="100%" stopColor="#8ab4f8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10, fill: "#9aa0a6" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v) => `${v}`}
                    contentStyle={{
                      background: "#1e1f20",
                      border: "1px solid #444746",
                      borderRadius: 10,
                      fontSize: 12,
                      color: "#e3e3e3",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Score"
                    stroke="#9b72cb"
                    strokeWidth={2}
                    fill="url(#gScore)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Pnl"
                    stroke="#8ab4f8"
                    strokeWidth={2}
                    fill="url(#gPnl)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="preview-dash">
              <div className="pd-donut">
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie
                      data={DEMO_ALLOC}
                      dataKey="value"
                      innerRadius={32}
                      outerRadius={52}
                      paddingAngle={2}
                    >
                      {DEMO_ALLOC.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <span className="pd-cat">Diversified</span>
              </div>
              <div className="pd-legend">
                {DEMO_ALLOC.map((d) => (
                  <div className="pd-row" key={d.name}>
                    <span className="pd-dot" style={{ background: d.color }} />
                    <span className="pd-name">{d.name}</span>
                    <span className="pd-pct">{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="preview-chat">
            <div className="pchat ai">
              TSLA is 4% from your stop and the trend just flipped down.
              Tightening your stop locks in most of the gain — I'd do it now.
            </div>
            <span className="pchat-tag">AI Insight</span>
          </div>
        </div>
      </section>

      {/* ---- HOW IT WORKS ---- */}
      <section className="section" id="how">
        <span className="section-eyebrow">HOW IT WORKS</span>
        <h2 className="section-title">
          Four steps, every time a price moves.
        </h2>
        <div className="steps">
          {STEPS.map((s) => (
            <div className="step-card" key={s.n}>
              <span className="step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- SAMPLE CONVERSATION ---- */}
      <section className="section">
        <span className="section-eyebrow">SEE IT IN ACTION</span>
        <h2 className="section-title">A real conversation, not a form.</h2>
        <div className="chat-demo">
          {SAMPLE_CHAT.map((m, i) => (
            <div className={`cd-row ${m.who}`} key={`${m.who}-${i}`}>
              <div className={`cd-bubble ${m.who}`}>
                {m.who === "calm" && (
                  <span className="cd-calm-tag">Live alert</span>
                )}
                {m.text}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- FEATURES ---- */}
      <section className="section">
        <span className="section-eyebrow">WHAT YOU GET</span>
        <h2 className="section-title">
          Everything you need to manage a position.
        </h2>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <span className="feature-icon">
                <Icon name={f.icon} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- PERSONALIZATION ---- */}
      <section className="section">
        <span className="section-eyebrow">MADE FOR YOU</span>
        <h2 className="section-title">
          It adapts to how you actually trade.
        </h2>
        <div className="feature-grid">
          {PERSONALIZE.map((f) => (
            <div className="feature-card" key={f.title}>
              <span className="feature-icon">
                <Icon name={f.icon} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- WHY US (comparison) ---- */}
      <section className="section" id="why">
        <span className="section-eyebrow">WHY POSITIONIQ</span>
        <h2 className="section-title">Less raw data. More clear guidance.</h2>
        <div className="compare">
          <div className="compare-col bad">
            <h4>A generic trading app</h4>
            <ul>
              <li>Spits out numbers with no guidance</li>
              <li>Doesn't explain why a position is risky</li>
              <li>No clear next action, no follow-through</li>
              <li>Fuels panic selling and overtrading</li>
            </ul>
          </div>
          <div className="compare-col good">
            <h4>PositionIQ</h4>
            <ul>
              <li>Scores every position 0-100 in plain English</li>
              <li>Explains the reasoning behind every call</li>
              <li>Recommends one clear action — hold, book profit, hedge, exit</li>
              <li>Keeps you calm with real-time alerts before trouble</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---- SECTOR COVERAGE ---- */}
      <section className="section">
        <span className="section-eyebrow">WHAT WE BUILD FROM</span>
        <h2 className="section-title">
          Live market data for every sector you hold.
        </h2>
        <div className="cat-grid">
          {CATEGORIES.map((c) => (
            <div className="cat-chip" key={c.name}>
              <span className="cat-dot" style={{ background: c.color }} />
              <div className="cat-meta">
                <strong>{c.name}</strong>
                <span>{c.tag}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- TRUST & SAFETY ---- */}
      <section className="section">
        <span className="section-eyebrow">BUILT TO BE TRUSTED</span>
        <h2 className="section-title">Guidance with guardrails.</h2>
        <div className="feature-grid">
          {TRUST.map((f) => (
            <div className="feature-card trust" key={f.title}>
              <span className="feature-icon">
                <Icon name={f.icon} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- THE BIGGER PICTURE ---- */}
      <section className="section">
        <span className="section-eyebrow">THE BIGGER PICTURE</span>
        <h2 className="section-title">
          From live monitoring to your next trade.
        </h2>
        <p className="section-sub">
          PositionIQ isn't a score in isolation. It's the full loop — live
          market data, position scoring, clear recommendations, and
          plain-English reasoning behind every call.
        </p>
        <div className="feature-grid suite-grid">
          {SUITE.map((s) => (
            <div className="feature-card suite-card" key={s.title}>
              <span className="feature-icon">
                <Icon name={s.icon} />
              </span>
              <span className="suite-tag">{s.tag}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
        <p className="suite-note">
          Every position gets the full loop: real-time prices stream in, the
          score updates, an action is recommended, and you can drill into the
          reasoning with AI Insights.
        </p>
      </section>

      {/* ---- FAQ ---- */}
      <section className="section">
        <span className="section-eyebrow">COMMON QUESTIONS</span>
        <h2 className="section-title">Everything before you start.</h2>
        <div className="faq">
          {FAQS.map((f, i) => (
            <button
              type="button"
              className={`faq-item ${openFaq === i ? "open" : ""}`}
              key={f.q}
              onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
            >
              <div className="faq-q">
                <span>{f.q}</span>
                <span className="faq-sign">{openFaq === i ? "−" : "+"}</span>
              </div>
              {openFaq === i && <p className="faq-a">{f.a}</p>}
            </button>
          ))}
        </div>
      </section>

      {/* ---- PRICING (FREE / PRO) ---- */}
      <section className="section">
        <span className="section-eyebrow">PRICING</span>
        <h2 className="section-title">
          Start free. Upgrade when it matters.
        </h2>
        <div className="pricing-grid">
          <div className="free-band">
            <span className="free-eyebrow">FREE</span>
            <h2 className="free-price">
              <span className="grad-text">₹0</span>
              <span className="free-period">forever</span>
            </h2>
            <p className="free-sub">
              Track up to 10 open positions — no card, no subscription.
            </p>
            <ul className="free-list">
              <li>Up to 10 open positions</li>
              <li>Position score for every position</li>
              <li>In-app alerts &amp; notifications</li>
            </ul>
            <Link className="cta-btn" to="/register">
              Start free →
            </Link>
          </div>

          <div className="free-band pro">
            <span className="suite-tag">Most popular</span>
            <span className="free-eyebrow">PRO</span>
            <h2 className="free-price">
              <span className="grad-text">₹9</span>
              <span className="free-period">/month</span>
            </h2>
            <p className="free-sub">
              Unlimited positions, real-time alerts and AI market insights.
            </p>
            <ul className="free-list">
              <li>Unlimited open positions</li>
              <li>Real-time alerts &amp; notifications</li>
              <li>What-if simulator</li>
              <li>AI market insights chat</li>
              <li>Portfolio analytics &amp; diversification score</li>
            </ul>
            <Link className="cta-btn" to="/register">
              Go PRO →
            </Link>
          </div>
        </div>
      </section>

      {/* ---- CTA BAND ---- */}
      <section className="cta-band">
        <h2>Your next trade decision starts with one score.</h2>
        <Link className="cta-btn" to="/register">
          Start free →
        </Link>
        <span className="hero-note">
          Free · no card, live market data
        </span>
      </section>

      <footer className="landing-foot">
        Decision-support only · not registered financial advice. Not an
        autonomous trading system.
      </footer>
    </div>
  );
}