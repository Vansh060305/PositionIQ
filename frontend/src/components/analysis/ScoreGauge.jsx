// Same arc-gauge device used across the app: a 180° semicircle whose fill
// maps directly onto the 0-100 score via strokeDasharray (reliable on every
// re-render, no framer-motion pathLength needed).

const ARC_R = 50;
const ARC_LENGTH = Math.PI * ARC_R;

function scoreColor(score) {
  if (score >= 70) return "#81c995"; // gain
  if (score >= 40) return "#fdd663"; // caution
  return "#f28b82"; // loss
}

function scoreFraction(score) {
  return Math.max(0, Math.min(100, score)) / 100;
}

export default function ScoreGauge({ score }) {
  const color = scoreColor(score);
  const frac = scoreFraction(score);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 70" className="w-36">
        {/* background arc */}
        <path
          d="M10,65 A50,50 0 0,1 110,65"
          fill="none"
          stroke="#3c3e40"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* filled arc: strokeDasharray = [drawn, total] for the fraction */}
        <path
          d="M10,65 A50,50 0 0,1 110,65"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${frac * ARC_LENGTH} ${ARC_LENGTH}`}
          style={{
            transition: "stroke 200ms ease, stroke-dasharray 400ms ease-out",
          }}
        />
      </svg>
      <div className="-mt-7 text-center">
        <div className="font-display text-3xl font-bold text-ink">{Math.round(score)}</div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          Position score
        </div>
      </div>
    </div>
  );
}
