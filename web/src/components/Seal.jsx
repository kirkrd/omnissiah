import React, { useId } from 'react';

function gearPath(teeth, rOuter, rInner, toothFrac = 0.42) {
  const step = (Math.PI * 2) / teeth;
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    const half = (step * toothFrac) / 2;
    const flare = half * 0.78;
    pts.push([a - half - flare * 0.35, rInner]);
    pts.push([a - flare, rOuter]);
    pts.push([a + flare, rOuter]);
    pts.push([a + half + flare * 0.35, rInner]);
  }
  return (
    pts
      .map(([a, r], i) => `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`)
      .join(' ') + ' Z'
  );
}

const GEAR = gearPath(12, 96, 80);
const CRANIUM =
  'M-38 4 C-42 -32 -20 -50 0 -50 C20 -50 42 -32 38 4 C37 12 33 17 27 20 L24 34 C24 40 18 42 12 42 L-12 42 C-18 42 -24 40 -24 34 L-27 20 C-33 17 -37 12 -38 4 Z';

/** Opus Mechanicum seal — a cog-ringed skull, half bone, half machine. */
export default function Seal({ size = 120, spinning = false, active = false, className = '' }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      className={`seal ${spinning ? 'seal-spin' : ''} ${active ? 'seal-active' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="-100 -100 200 200"
      role="img"
      aria-label="Opus Mechanicum seal"
    >
      <defs>
        <radialGradient id={`rim${uid}`} r="1">
          <stop offset="0.75" stopColor="#7c1216" />
          <stop offset="1" stopColor="#c0262b" />
        </radialGradient>
        <linearGradient id={`steel${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a3a9b3" />
          <stop offset="0.5" stopColor="#5f6672" />
          <stop offset="1" stopColor="#363b44" />
        </linearGradient>
        <linearGradient id={`bone${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1e8d6" />
          <stop offset="1" stopColor="#b9ab92" />
        </linearGradient>
        <clipPath id={`left${uid}`}>
          <rect x="-60" y="-60" width="60" height="120" />
        </clipPath>
        <clipPath id={`right${uid}`}>
          <rect x="0" y="-60" width="60" height="120" />
        </clipPath>
        <filter id={`glow${uid}`} x="-2" y="-2" width="5" height="5">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g className="seal-gear">
        <path d={GEAR} fill={`url(#rim${uid})`} stroke="#3b0709" strokeWidth="2" />
        <circle r="72" fill="#0d0b09" stroke="#d4af37" strokeWidth="3" />
        <circle r="66" fill="none" stroke="#d4af37" strokeWidth="0.8" strokeDasharray="2 5" opacity="0.7" />
      </g>

      <g className="seal-skull">
        <path d={CRANIUM} fill={`url(#bone${uid})`} clipPath={`url(#left${uid})`} />
        <path d={CRANIUM} fill={`url(#steel${uid})`} clipPath={`url(#right${uid})`} />
        <path d={CRANIUM} fill="none" stroke="#1a1612" strokeWidth="2" />
        <line x1="0" y1="-50" x2="0" y2="42" stroke="#1a1612" strokeWidth="1.6" />
        {/* plate rivets */}
        {[[-30, 8], [-34, -16], [-26, -36], [-12, -46]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={-x} cy={y} r="1.8" fill="#d4af37" />
        ))}
        {/* crack */}
        <path d="M-14 -48 L-18 -38 L-13 -32 L-20 -22" fill="none" stroke="#5b4e3e" strokeWidth="1.2" />
        {/* sockets */}
        <ellipse cx="-16" cy="2" rx="10" ry="11" fill="#0b0907" />
        <circle cx="16" cy="2" r="12" fill="#0b0907" stroke="#2b3038" strokeWidth="3" />
        <g className="seal-eye" filter={`url(#glow${uid})`}>
          <circle cx="16" cy="2" r="6.5" fill="#4fd6e0" />
          <circle cx="16" cy="2" r="2.4" fill="#e6ffff" />
        </g>
        {/* nasal cavity */}
        <path d="M0 13 L-5.5 24 L5.5 24 Z" fill="#0b0907" />
        {/* teeth */}
        <rect x="-19" y="29" width="38" height="10" rx="1.5" fill="#0b0907" />
        {[-15, -9, -3, 3, 9, 15].map((x) => (
          <rect key={x} x={x - 2.4} y="29" width="4.8" height="9" rx="1" fill={x < 0 ? '#ddd1bb' : '#8d939d'} />
        ))}
        {/* cables */}
        <path d="M24 34 C30 48 22 58 30 70" fill="none" stroke="#2b2f36" strokeWidth="3" />
        <path d="M18 41 C20 54 12 60 16 72" fill="none" stroke="#3a3f47" strokeWidth="2" />
      </g>
    </svg>
  );
}
