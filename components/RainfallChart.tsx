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
      <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px' }}>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 4 }}>{label}</p>
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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Legend
            wrapperStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, paddingTop: 6 }}
          />
          <Bar yAxisId="left" dataKey="Rainfall (mm)" fill="#38bdf8" fillOpacity={0.7} radius={[3,3,0,0]} />
          <Line yAxisId="right" type="monotone" dataKey="Probability (%)"
            stroke="#a78bfa" strokeWidth={2} dot={{ fill: '#a78bfa', r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
