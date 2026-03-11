'use client';

import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, Legend, ResponsiveContainer,
} from 'recharts';

interface HistoricalPoint { date: string; depthFt: number; depthM: number }
interface PredictedPoint  { date: string; predictedDepthFt: number; predictedDepthM: number; precipitation_mm: number }

interface Props {
  historical:   HistoricalPoint[];
  predictions:  PredictedPoint[];
  criticalDepthFt: number;
  unit?: 'ft' | 'm';
}

const fmt = (d: string) => {
  const parts = d.split('-');
  return `${parts[2]}/${parts[1]}`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  const hist = payload.find((p: { name: string }) => p.name === 'Historical');
  const pred = payload.find((p: { name: string }) => p.name === 'Predicted');
  const rain = payload.find((p: { name: string }) => p.name === 'Rainfall');
  return (
    <div style={{
      background: '#fff', border: '1px solid #bae6fd', borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 4px 20px rgba(14,165,233,0.12)',
      minWidth: 160,
    }}>
      <p style={{ color: '#64748b', fontSize: 11, marginBottom: 6 }}>{label}</p>
      {hist && (
        <p style={{ color: '#0ea5e9', fontSize: 12, fontWeight: 700 }}>
          Depth: {hist.value?.toFixed(2)} {unit}
        </p>
      )}
      {pred && (
        <p style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700 }}>
          Predicted: {pred.value?.toFixed(2)} {unit}
        </p>
      )}
      {rain && rain.value > 0 && (
        <p style={{ color: '#38bdf8', fontSize: 11, marginTop: 3 }}>
          🌧 {rain.value?.toFixed(1)} mm rain
        </p>
      )}
    </div>
  );
}

export default function GWLTrendChart({ historical, predictions, criticalDepthFt, unit = 'ft' }: Props) {
  // Merge historical and predictions into one series for the chart
  const histData = historical.map(h => ({
    date:     fmt(h.date),
    rawDate:  h.date,
    depth:    unit === 'ft' ? h.depthFt : h.depthM,
    label:    'Historical',
    rain:     null as number | null,
  }));

  const predData = predictions.map(p => ({
    date:        fmt(p.date),
    rawDate:     p.date,
    predicted:   unit === 'ft' ? p.predictedDepthFt : p.predictedDepthM,
    rain:        p.precipitation_mm,
  }));

  // Bridge point: last historical value also starts the predicted line
  const bridge = histData.length
    ? {
        date:     histData[histData.length - 1].date,
        rawDate:  histData[histData.length - 1].rawDate,
        depth:    histData[histData.length - 1].depth,
        predicted: histData[histData.length - 1].depth,
        rain:     null as number | null,
      }
    : null;

  // Build unified chart data: historical points then prediction points
  const chartData = [
    ...histData,
    ...(bridge ? [bridge] : []),
    ...predData,
  ];

  const critLine = unit === 'ft' ? criticalDepthFt : criticalDepthFt * 0.3048;
  const allDepths = [
    ...histData.map(d => d.depth),
    ...predData.map(d => d.predicted),
  ].filter(v => v !== undefined && v !== null) as number[];
  const minY = Math.max(0, Math.min(...allDepths) - 2);
  const maxY = Math.max(...allDepths, critLine) + 2;

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gwlGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.03} />
            </linearGradient>
            <linearGradient id="rainGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            interval="preserveStartEnd"
            tickLine={false}
            axisLine={{ stroke: '#e0f2fe' }}
          />
          <YAxis
            yAxisId="depth"
            domain={[minY, maxY]}
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v.toFixed(0)}${unit}`}
            width={38}
          />
          <YAxis
            yAxisId="rain"
            orientation="right"
            tick={{ fontSize: 9, fill: '#38bdf8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}mm`}
            width={32}
          />

          <Tooltip content={<CustomTooltip unit={unit} />} />

          <Legend
            wrapperStyle={{ fontSize: 10, color: '#64748b', paddingTop: 4 }}
            formatter={(value) => <span style={{ color: '#64748b' }}>{value}</span>}
          />

          {/* Critical threshold */}
          <ReferenceLine
            yAxisId="depth"
            y={critLine}
            stroke="#ef4444"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: 'Critical', position: 'insideTopRight', fill: '#ef4444', fontSize: 9 }}
          />

          {/* Rainfall bars */}
          <Area
            yAxisId="rain"
            type="monotone"
            dataKey="rain"
            name="Rainfall"
            fill="url(#rainGradient)"
            stroke="#38bdf8"
            strokeWidth={1}
            dot={false}
            activeDot={false}
          />

          {/* Historical area */}
          <Area
            yAxisId="depth"
            type="monotone"
            dataKey="depth"
            name="Historical"
            stroke="#0ea5e9"
            strokeWidth={2}
            fill="url(#gwlGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#0ea5e9', strokeWidth: 0 }}
          />

          {/* Predicted line (dashed) */}
          <Line
            yAxisId="depth"
            type="monotone"
            dataKey="predicted"
            name="Predicted"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            activeDot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
