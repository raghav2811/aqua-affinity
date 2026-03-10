'use client';

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { RainfallForecast } from '@/types';

interface RainfallChartProps {
  forecast: RainfallForecast[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#ffffff', border: '1px solid #bae6fd', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(14,165,233,0.10)' }}>
        <p style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color, fontSize: 12 }}>
            {p.name}: {p.value}{p.name === 'Rainfall (mm)' ? ' mm' : '%'}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function RainfallChart({ forecast }: RainfallChartProps) {
  const data = forecast.map((f) => ({
    date: f.date.slice(5),
    'Rainfall (mm)': f.mm,
    'Probability (%)': f.probability,
  }));

  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={{ stroke: '#e0f2fe' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(14,165,233,0.05)' }} />
          <Legend
            wrapperStyle={{ color: '#64748b', fontSize: 11, paddingTop: 6 }}
          />
          <Bar yAxisId="left" dataKey="Rainfall (mm)" fill="#38bdf8" fillOpacity={0.7} radius={[3,3,0,0]} />
          <Line yAxisId="right" type="monotone" dataKey="Probability (%)"
            stroke="#a78bfa" strokeWidth={2} dot={{ fill: '#a78bfa', r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
