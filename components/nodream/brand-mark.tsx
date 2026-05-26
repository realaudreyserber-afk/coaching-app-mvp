import React from 'react';

interface BrandMarkProps {
  size?: number;
}

export function BrandMark({ size = 28 }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      style={{ filter: 'drop-shadow(0 0 8px rgba(212,175,55,0.6))' }}
    >
      <defs>
        <linearGradient id="nd-hex-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d4af37" />
          <stop offset="1" stopColor="#ffd700" />
        </linearGradient>
      </defs>
      <polygon
        points="20,2 36,11 36,29 20,38 4,29 4,11"
        fill="none"
        stroke="url(#nd-hex-grad)"
        strokeWidth="1.5"
      />
      <polygon
        points="20,6 32,13 32,27 20,34 8,27 8,13"
        fill="rgba(212,175,55,0.06)"
        stroke="rgba(212,175,55,0.4)"
        strokeWidth="0.5"
      />
      <text
        x="20"
        y="26"
        textAnchor="middle"
        fill="url(#nd-hex-grad)"
        fontSize="16"
        fontWeight="900"
        fontFamily="Outfit, sans-serif"
      >
        N
      </text>
    </svg>
  );
}

interface WordmarkProps {
  size?: number;
}

export function Wordmark({ size = 18 }: WordmarkProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <BrandMark size={size + 10} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 900,
            fontSize: size,
            letterSpacing: '-0.02em',
            color: 'var(--gold-400)',
            textShadow: '0 0 12px rgba(212, 175, 55, 0.4)',
          }}
        >
          NoDream
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            letterSpacing: '0.3em',
            color: 'var(--accent-tech)',
            marginTop: 2,
            textShadow: '0 0 6px var(--accent-tech)',
          }}
        >
          IA · TACTICAL · OS
        </span>
      </div>
    </div>
  );
}
