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

export interface WeightDataPoint {
  date: string; // YYYY-MM-DD or MM-DD
  weight: number;
  average: number;
}

interface WeightChartProps {
  data: WeightDataPoint[];
}

// Custom tooltip styling declared OUTSIDE of render component to satisfy react-hooks/static-components
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border p-3 rounded-lg shadow-md text-xs space-y-1">
        <p className="font-semibold text-muted-foreground">{payload[0].payload.date}</p>
        <p className="text-primary font-medium">Poids : {payload[0].value} kg</p>
        {payload[1] && (
          <p className="text-secondary font-medium">Moyenne (7j) : {payload[1].value} kg</p>
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
      <div className="h-64 w-full flex items-center justify-center bg-card rounded-xl border border-border">
        <div className="text-center space-y-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-xs text-muted-foreground font-serif">Chargement de la courbe...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-64 w-full flex items-center justify-center bg-card rounded-xl border border-border">
        <p className="text-xs text-muted-foreground font-serif">Saisis tes check-ins quotidiens pour afficher ton graphique.</p>
      </div>
    );
  }

  // Calculate suitable Y axis domain
  const weights = data.map((d) => d.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const yMin = Math.max(0, Math.floor(minWeight - 2));
  const yMax = Math.ceil(maxWeight + 2);

  return (
    <div className="h-64 w-full bg-card p-4 rounded-xl border border-border shadow-xs">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDE7DC" vertical={false} />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 9 }} 
            tickLine={false} 
            stroke="#706E6B" 
          />
          <YAxis 
            domain={[yMin, yMax]} 
            tick={{ fontSize: 10 }} 
            tickLine={false} 
            axisLine={false}
            stroke="#706E6B" 
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Daily weight line (thin, dots) */}
          <Line
            type="monotone"
            dataKey="weight"
            name="Poids réel"
            stroke="#D96B43"
            strokeWidth={1.5}
            dot={{ r: 3, strokeWidth: 1 }}
            activeDot={{ r: 5 }}
          />

          {/* Rolling 7-day average weight (thick, smooth, no dots) */}
          <Line
            type="monotone"
            dataKey="average"
            name="Moyenne glissante"
            stroke="#2E4F4F"
            strokeWidth={3}
            dot={false}
            activeDot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
