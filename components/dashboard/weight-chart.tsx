/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { HudCard } from "@/components/nodream";

export interface WeightDataPoint {
  date: string;
  weight: number;
  average: number;
}

interface WeightChartProps {
  data: WeightDataPoint[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="mono"
        style={{
          background: 'rgba(6, 3, 15, 0.95)',
          border: '1px solid var(--gold-tint-25)',
          padding: '10px 12px',
          fontSize: 11,
          letterSpacing: '0.05em',
          clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
          boxShadow: '0 0 12px rgba(212, 175, 55, 0.25)',
        }}
      >
        <div style={{ color: 'var(--fg-4)', textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.2em', marginBottom: 4 }}>
          {payload[0].payload.date}
        </div>
        <div style={{ color: 'var(--gold-400)', fontWeight: 700 }}>
          POIDS · {payload[0].value} <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>kg</span>
        </div>
        {payload[1] && (
          <div style={{ color: 'var(--accent-tech)', fontWeight: 700, marginTop: 2 }}>
            MOY-7J · {payload[1].value} <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>kg</span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function WeightChart({ data }: WeightChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <HudCard accent="gold" chamfer="sm" style={{ height: 256, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center space-y-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent mx-auto" style={{ borderColor: 'var(--gold-400)' }} />
          <p className="mono" style={{ fontSize: 10, color: 'var(--fg-4)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Chargement de la courbe...
          </p>
        </div>
      </HudCard>
    );
  }

  if (data.length === 0) {
    return (
      <HudCard accent="gold" chamfer="sm" style={{ height: 256, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="mono" style={{ fontSize: 11, color: 'var(--fg-4)', letterSpacing: '0.15em', textAlign: 'center', padding: '0 16px' }}>
          Aucune donnée — saisis tes check-ins quotidiens pour activer le suivi
        </p>
      </HudCard>
    );
  }

  const weights = data.map((d) => d.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const yMin = Math.max(0, Math.floor(minWeight - 2));
  const yMax = Math.ceil(maxWeight + 2);

  // Use computed CSS values for proper SSR-safe theming
  const gridColor = 'rgba(255, 255, 255, 0.06)';
  const axisColor = 'rgba(240, 240, 240, 0.45)';
  const goldColor = '#d4af37';
  const goldGlow = '#ffd700';
  const techColor = '#00ff66';

  return (
    <HudCard accent="gold" chamfer="sm" style={{ height: 256, padding: '12px 12px 4px 0' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, left: -10, bottom: 8 }}>
          <defs>
            <filter id="weight-line-glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: axisColor, fontFamily: 'var(--font-mono, JetBrains Mono)' }}
            tickLine={false}
            axisLine={false}
            stroke={axisColor}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 9, fill: axisColor, fontFamily: 'var(--font-mono, JetBrains Mono)' }}
            tickLine={false}
            axisLine={false}
            stroke={axisColor}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: goldColor, strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.4 }} />

          <Line
            type="monotone"
            dataKey="weight"
            name="Poids réel"
            stroke={goldColor}
            strokeWidth={1.5}
            dot={{ r: 3, strokeWidth: 1, fill: goldGlow, stroke: goldColor }}
            activeDot={{ r: 5, fill: goldGlow, stroke: goldColor, strokeWidth: 2 }}
            filter="url(#weight-line-glow)"
          />

          <Line
            type="monotone"
            dataKey="average"
            name="Moyenne glissante"
            stroke={techColor}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: techColor }}
            filter="url(#weight-line-glow)"
          />
        </LineChart>
      </ResponsiveContainer>
    </HudCard>
  );
}
