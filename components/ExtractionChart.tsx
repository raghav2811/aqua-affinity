'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell
} from 'recharts';
import { DailyExtraction } from '@/types';
import { formatLitres } from '@/lib/fineCalculation';

interface ExtractionChartProps {
  extractions: DailyExtraction[];
  dailyLimit: number;
  color?: string;
}

const CustomTooltip = ({ active, payload, label, limit }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    const exceeded = val > limit;
    return (
      <div style={{ background: '#ffffff', border: '1px solid #bae6fd', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(14,165,233,0.10)' }}>
        <p style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>{label}</p>
        <p style={{ color: exceeded ? '#ef4444' : '#22c55e', fontWeight: 'bold', fontSize: 13 }}>
          {formatLitres(val)}
        </p>
        {exceeded && (
          <p style={{ color: '#ef4444', fontSize: 11 }}>
            +{formatLitres(val - limit)} over limit
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function ExtractionChart({ extractions, dailyLimit }: ExtractionChartProps) {
  const last14 = extractions.slice(-14);
  const data = last14.map((d) => ({
    date: d.date.slice(5), // MM-DD
    liters: d.liters,
    exceeded: d.liters > dailyLimit,
  }));

  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={{ stroke: '#e0f2fe' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip content={<CustomTooltip limit={dailyLimit} />} cursor={{ fill: 'rgba(14,165,233,0.05)' }} />
          <ReferenceLine
            y={dailyLimit}
            stroke="#ef4444"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{ value: 'Limit', position: 'insideTopRight', fill: '#ef4444', fontSize: 10 }}
          />
          <Bar dataKey="liters" radius={[3, 3, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.exceeded ? '#ef4444' : '#22c55e'}
                fillOpacity={entry.exceeded ? 0.85 : 0.7}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
