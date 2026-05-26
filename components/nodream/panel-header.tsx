import React from 'react';

interface PanelHeaderProps {
  code: string;
  title: React.ReactNode;
  accent?: 'gold' | 'tech';
  right?: React.ReactNode;
}

/**
 * Tactical panel header: "[CODE]" eyebrow above the title, optional right slot.
 * Use inside a hud-card.
 */
export function PanelHeader({ code, title, accent = 'gold', right }: PanelHeaderProps) {
  const color = accent === 'tech' ? 'var(--accent-tech)' : 'var(--gold-500)';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: 16,
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.3em',
            color,
            opacity: 0.7,
          }}
        >
          [{code}]
        </span>
        <h3 style={{ color: 'var(--fg-1)', fontWeight: 900, letterSpacing: '-0.02em' }}>{title}</h3>
      </div>
      {right}
    </div>
  );
}
