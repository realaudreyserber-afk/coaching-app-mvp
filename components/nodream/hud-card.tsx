import React from 'react';
import { Corners } from './corners';

export interface HudCardProps {
  children: React.ReactNode;
  /** Optional bracket-corner accent color */
  accent?: 'gold' | 'tech' | 'none';
  /** Show 4-bracket corners overlay */
  corners?: boolean;
  /** Add cyberpunk chamfered clip-path (top-left + bottom-right) */
  chamfer?: 'none' | 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
  as?: React.ElementType;
}

/**
 * Tactical HUD card — replaces shadcn <Card> for the NoDream Tactical OS look.
 *
 * Composition: glass background + border tinted to the accent + optional
 * 4-bracket corners + optional chamfered clip-path.
 *
 * Example:
 *   <HudCard accent="gold" corners chamfer="sm">
 *     <PanelHeader code="MIS-001" title="Mission du jour" />
 *     ...
 *   </HudCard>
 */
export function HudCard({
  children,
  accent = 'gold',
  corners = true,
  chamfer = 'none',
  className = '',
  style,
  as: Tag = 'div',
}: HudCardProps) {
  const accentClass = accent === 'tech' ? 'tech' : accent === 'gold' ? 'gold' : '';
  const chamferClass = chamfer === 'sm' ? 'clip-chamfer-sm' : chamfer === 'md' ? 'clip-chamfer' : '';
  const cornersClass = corners ? 'corners' : '';
  return (
    <Tag
      className={`hud-card ${accentClass} ${cornersClass} ${chamferClass} ${className}`.trim()}
      style={style}
    >
      {corners && <Corners accent={accent === 'tech' ? 'tech' : 'gold'} />}
      {children}
    </Tag>
  );
}
