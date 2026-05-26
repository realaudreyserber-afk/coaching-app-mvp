"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: string; // Material Symbols Outlined name
  code: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', href: '/dashboard', label: 'TABLEAU', icon: 'grid_view', code: '01' },
  { id: 'plan',      href: '/plan',      label: 'PLAN',    icon: 'restaurant', code: '02' },
  { id: 'session',   href: '/session',   label: 'SESSION', icon: 'bolt',       code: '03' },
  { id: 'coach',     href: '/coach',     label: 'COACH',   icon: 'forum',      code: '04' },
  { id: 'progress',  href: '/progress',  label: 'SUIVI',   icon: 'monitoring', code: '05' },
  { id: 'settings',  href: '/settings',  label: 'OPS',     icon: 'settings',   code: '06' },
];

export function TacticalBottomNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 50,
        background: 'rgba(6, 3, 15, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--gold-tint-15)',
        padding: '10px 32px',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))',
        display: 'grid',
        gridTemplateColumns: `repeat(${NAV_ITEMS.length}, 1fr)`,
        gap: 6,
      }}
      aria-label="Navigation principale"
    >
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.id}
            href={item.href}
            style={{
              position: 'relative',
              background: isActive ? 'var(--gold-tint-08)' : 'transparent',
              border: `1px solid ${isActive ? 'var(--gold-tint-35)' : 'transparent'}`,
              padding: '10px 8px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.2s var(--ease-soft)',
              clipPath:
                'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
              color: isActive ? 'var(--gold-400)' : 'var(--fg-4)',
              boxShadow: isActive
                ? '0 0 12px var(--gold-tint-25), inset 0 0 12px rgba(0,0,0,0.4)'
                : 'none',
              minHeight: 56,
              textDecoration: 'none',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 22,
                filter: isActive ? 'drop-shadow(0 0 6px var(--gold-400))' : 'none',
              }}
            >
              {item.icon}
            </span>
            <span
              className="mob-hide-label"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.18em',
              }}
            >
              {item.label}
            </span>
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: 7,
                color: isActive ? 'var(--accent-tech)' : 'var(--fg-6)',
                letterSpacing: '0.1em',
              }}
            >
              {item.code}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
