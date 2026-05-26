"use client";

import { useEffect, useState } from 'react';
import { Wordmark } from './brand-mark';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export interface TacticalHeaderProps {
  /** Optional sector code, defaults to "FR-67" */
  sector?: string;
  /** Right-side action slot (icons, logout) */
  rightSlot?: React.ReactNode;
}

/**
 * Sticky tactical header — wordmark NoDream + tactical readout
 * (ORACLE.IA · ACTIVE · SECTOR · live clock). Readout hides on mobile.
 */
export function TacticalHeader({ sector = 'FR-67', rightSlot }: TacticalHeaderProps) {
  const [time, setTime] = useState(() => formatTime(new Date()));
  useEffect(() => {
    const t = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(6, 3, 15, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--gold-tint-15)',
        padding: '14px 32px',
        paddingTop: 'max(14px, env(safe-area-inset-top, 14px))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
      }}
    >
      <Wordmark />

      <div
        className="mono top-tactical-readout"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          fontSize: 11,
          letterSpacing: '0.18em',
          color: 'var(--fg-4)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="status-dot" />{' '}
          <span style={{ color: 'var(--accent-tech)' }}>ORACLE.IA · ACTIVE</span>
        </span>
        <span>SECTEUR · {sector}</span>
        <span style={{ color: 'var(--gold-500)' }}>{time}</span>
      </div>

      {rightSlot}
    </header>
  );
}
