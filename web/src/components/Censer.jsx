import React from 'react';

/** A swinging thurible with rising smoke. `swinging` toggles the motion. */
export default function Censer({ size = 64, swinging = true, smoke = true }) {
  return (
    <svg
      className={`censer ${swinging ? 'censer-swing' : ''}`}
      width={size}
      height={size * 1.5}
      viewBox="-40 -6 80 120"
      aria-hidden
    >
      <defs>
        <linearGradient id="censer-brass" x1="0" x2="1">
          <stop offset="0" stopColor="#7a5a22" />
          <stop offset="0.45" stopColor="#e3c060" />
          <stop offset="1" stopColor="#6b4c18" />
        </linearGradient>
        <radialGradient id="censer-ember">
          <stop offset="0" stopColor="#fff1b0" />
          <stop offset="0.5" stopColor="#ff8a2a" />
          <stop offset="1" stopColor="#ff8a2a" stopOpacity="0" />
        </radialGradient>
        <filter id="censer-blur">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
      <rect x="-9" y="-6" width="18" height="4" rx="1" fill="#6b4c18" />
      <g className="censer-arm">
        <line x1="0" y1="-2" x2="0" y2="62" stroke="#8a8f98" strokeWidth="1.4" strokeDasharray="3 2" />
        {smoke && (
          <g className="censer-smoke" filter="url(#censer-blur)">
            <circle cx="0" cy="58" r="5" />
            <circle cx="0" cy="58" r="6" />
            <circle cx="0" cy="58" r="4" />
            <circle cx="0" cy="58" r="7" />
          </g>
        )}
        <path d="M-8 64 Q0 54 8 64 Z" fill="url(#censer-brass)" />
        <circle cx="0" cy="56" r="2.2" fill="url(#censer-brass)" />
        <path d="M-14 66 H14 L11 82 Q0 92 -11 82 Z" fill="url(#censer-brass)" stroke="#3d2b0c" strokeWidth="1" />
        <path d="M-12 70 H12" stroke="#3d2b0c" strokeWidth="1" />
        {[-7, 0, 7].map((x) => (
          <rect key={x} x={x - 1.4} y="72" width="2.8" height="6" rx="1" fill="#1b1206" />
        ))}
        <circle className="censer-ember" cx="0" cy="75" r="9" fill="url(#censer-ember)" />
      </g>
    </svg>
  );
}
