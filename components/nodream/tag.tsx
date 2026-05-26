import React from 'react';

type TagAccent = 'gold' | 'tech' | 'pink' | 'dim' | 'red';

const COLORS: Record<TagAccent, { bg: string; border: string; fg: string }> = {
  gold: { bg: 'var(--gold-tint-08)', border: 'var(--gold-tint-25)', fg: 'var(--gold-400)' },
  tech: { bg: 'var(--accent-tech-tint)', border: 'var(--accent-tech)', fg: 'var(--accent-tech)' },
  pink: { bg: 'var(--pink-tint-10)', border: 'var(--pink-tint-35)', fg: 'var(--pink-500)' },
  dim: { bg: 'var(--glass-bg-2)', border: 'var(--glass-border)', fg: 'var(--fg-4)' },
  red: { bg: 'var(--alert-tint-15)', border: 'var(--alert-500)', fg: 'var(--alert-500)' },
};

interface TagProps {
  children: React.ReactNode;
  accent?: TagAccent;
}

export function Tag({ children, accent = 'gold' }: TagProps) {
  const c = COLORS[accent];
  return (
    <span
      className="mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.fg,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
      }}
    >
      {children}
    </span>
  );
}
