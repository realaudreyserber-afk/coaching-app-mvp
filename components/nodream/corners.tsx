import React from 'react';

interface CornersProps {
  accent?: 'gold' | 'tech';
}

/**
 * 4 bracket corners overlay. Place inside a `position: relative` parent
 * (typically with `className="corners"` from base.css).
 */
export function Corners({ accent = 'gold' }: CornersProps) {
  const color = accent === 'tech' ? 'var(--accent-tech)' : 'var(--gold-500)';
  const positions = ['tl', 'tr', 'bl', 'br'] as const;
  return (
    <>
      {positions.map((p) => (
        <span key={p} className={`c ${p}`} style={{ borderColor: color }} />
      ))}
    </>
  );
}
