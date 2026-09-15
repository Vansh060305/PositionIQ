// BrandMark - the PositionIQ logo mark: a stylized "P" built from a blue
// stem and a blue-to-green arch, with an ascending bar chart and an
// upward-trending green arrow inside the loop. Drawn as inline SVG so it
// stays crisp at any size and uses the app's own palette (electric blue,
// purple accent, profit green) - nothing pasted from an external image.

export default function BrandMark({ size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="piq-bm-stem" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4285f4" />
          <stop offset="1" stopColor="#9b72cb" />
        </linearGradient>
        <linearGradient id="piq-bm-arch" x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0" stopColor="#4285f4" />
          <stop offset="0.5" stopColor="#3aa7c9" />
          <stop offset="1" stopColor="#34a853" />
        </linearGradient>
      </defs>

      {/* ascending green arrow, behind the bars */}
      <path
        d="M 12.4 20.6 C 16.6 21 19.4 18.8 21.1 15.6 C 21.8 14.4 22.5 13.1 23.1 11.7"
        stroke="#81c995"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* arrowhead */}
      <path
        d="M 20.7 10.7 L 23.2 11.6 L 21.7 14.4"
        stroke="#81c995"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* jagged trend line under the arrow */}
      <path
        d="M 14.2 22.4 L 15.9 21.5 L 17.6 22.2 L 19.3 21.3 L 21 22"
        stroke="#81c995"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />

      {/* ascending bars inside the loop */}
      <rect x="16" y="9" width="1.9" height="2.4" rx="0.95" fill="#8ab4f8" />
      <rect x="18.2" y="7.2" width="1.9" height="4.2" rx="0.95" fill="#8ab4f8" />
      <rect x="20.4" y="5.4" width="1.9" height="6" rx="0.95" fill="#8ab4f8" />

      {/* P stem */}
      <rect x="5.8" y="4" width="5" height="24" rx="2.5" fill="url(#piq-bm-stem)" />

      {/* P arch: blue to green */}
      <path
        d="M 11 7 A 8 8 0 0 1 25 14"
        stroke="url(#piq-bm-arch)"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}