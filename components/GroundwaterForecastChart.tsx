'use client';

import { useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer,
} from 'recharts';
import { IndustrySensor } from '@/types';
import { runMLPrediction } from '@/lib/mlPrediction';

// ── Simulated March weather by TN zone ────────────────────────────────────────
function zoneWeather(sensor: IndustrySensor) {
  const loc = sensor.location;
  if (loc.includes('Chennai'))    return { temp: 36, humidity: 65, desc: 'Hazy',  icon: '🌤' };
  if (loc.includes('Madurai'))    return { temp: 38, humidity: 42, desc: 'Sunny', icon: '☀️' };
  if (loc.includes('Coimbatore')) return { temp: 33, humidity: 48, desc: 'Clear', icon: '☀️' };
  return                                 { temp: 34, humidity: 45, desc: 'Clear', icon: '☀️' }; // Tiruppur
}

// ── Status badge colours ──────────────────────────────────────────────────────
function statusStyle(trend: string) {
  if (trend === 'critical')  return { bg: 'rgba(239,68,68,0.25)',   color: '#ef4444', border: '#ef4444' };
  if (trend === 'worsening') return { bg: 'rgba(245,158,11,0.22)',  color: '#f59e0b', border: '#f59e0b' };
  if (trend === 'improving') return { bg: 'rgba(34,197,94,0.20)',   color: '#22c55e', border: '#22c55e' };
  return                            { bg: 'rgba(56,189,248,0.15)',  color: '#38bdf8', border: '#38bdf8' };
}

// ── Custom dark tooltip ───────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ForecastTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hist = payload.find((p: any) => p.dataKey === 'historical');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pred = payload.find((p: any) => p.dataKey === 'predicted');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rain = payload.find((p: any) => p.dataKey === 'rainfall');
  return (
    <div style={{
      background: '#0c1a2e', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 8,
      padding: '8px 12px', boxShadow: '0 4px 18px rgba(0,0,0,0.45)', minWidth: 130,
    }}>
      <div style={{ color: '#64748b', fontSize: 10, marginBottom: 5 }}>{label}</div>
      {hist?.value != null && (
        <div style={{ color: '#38bdf8', fontSize: 12, fontWeight: 600 }}>
          Historical: {hist.value} m
        </div>
      )}
      {pred?.value != null && (
        <div style={{ color: '#f59e0b', fontSize: 12, fontWeight: 600 }}>
          Predicted: {pred.value} m
        </div>
      )}
      {rain?.value > 0 && (
        <div style={{ color: '#a78bfa', fontSize: 11, marginTop: 3 }}>
          Eff. rain: {rain.value} mm
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GroundwaterForecastChart({ sensor }: { sensor: IndustrySensor }) {
  const result  = useMemo(() => runMLPrediction(sensor), [sensor]);
  const weather = zoneWeather(sensor);
  const ss      = statusStyle(result.trend);

  // Y-axis bounds: show safe zone, warning, critical with space
  const allLevels = result.points.flatMap(p =>
    ([p.historical, p.predicted].filter(v => v !== null) as number[])
  );
  const yMin = Math.max(0, Math.floor(Math.min(...allLevels)) - 2);
  const yMax = Math.ceil(Math.max(...allLevels, result.criticalThreshold + 1)) + 1;

  // Trend display (water-table direction, opposite of depth direction)
  const trendSign  = result.monthlyDelta < 0 ? '↑' : '↓';
  const trendAmt   = Math.abs(result.monthlyDelta).toFixed(2);
  const trendLabel = result.monthlyDelta < 0 ? 'recovering' : 'depleting';
  const trendColor = result.monthlyDelta < 0 ? '#22c55e' : '#ef4444';

  const todayLabel = `${new Date('2026-03-10').getDate()}/${new Date('2026-03-10').getMonth() + 1}`;

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e0f2fe' }}>

      {/* ── Dark analytics header ────────────────────────────────────────────── */}
      <div style={{ background: '#0c1a2e', padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: '#94a3b8', fontSize: 9.5, letterSpacing: '0.14em', fontWeight: 700 }}>
            GROUNDWATER ANALYTICS
          </span>
          <span style={{
            background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`,
            fontSize: 9, fontWeight: 700, padding: '1px 8px', borderRadius: 4, letterSpacing: '0.05em',
          }}>
            {result.trend === 'improving' ? 'SAFE' :
             result.trend === 'stable'    ? 'STABLE' :
             result.trend === 'critical'  ? 'CRITICAL' : 'WARNING'}
          </span>
          <span style={{ color: '#475569', fontSize: 9 }}>{result.statusSub}</span>
          <span style={{ marginLeft: 'auto', color: '#334155', fontSize: 9 }}>
            Updated 06:25 am ↻
          </span>
        </div>
      </div>

      {/* ── Chart subtitle ───────────────────────────────────────────────────── */}
      <div style={{ background: '#f0f9ff', padding: '5px 14px', borderBottom: '1px solid #e0f2fe' }}>
        <span style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.04em' }}>
          HISTORICAL + PREDICTED GROUNDWATER DEPTH (m below ground)
          &nbsp;&nbsp;
          ML R²={Math.round(result.rSquared * 100)}%
        </span>
      </div>

      {/* ── Chart + stats side-by-side ───────────────────────────────────────── */}
      <div style={{ display: 'flex', background: '#ffffff' }}>

        {/* ─ Chart area ──────────────────────────────────────────────────────── */}
        <div style={{ flex: '1 1 0', minWidth: 0, paddingTop: 6, paddingLeft: 2 }}>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={result.points} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gwHistGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.28} />
                  <stop offset="90%" stopColor="#38bdf8" stopOpacity={0.03} />
                </linearGradient>
              </defs>

              {/* Background zone shading */}
              <ReferenceArea y1={yMin}                       y2={result.warningThreshold}  fill="rgba(56,189,248,0.05)"  stroke="none" />
              <ReferenceArea y1={result.warningThreshold}    y2={result.criticalThreshold} fill="rgba(245,158,11,0.05)"  stroke="none" />
              <ReferenceArea y1={result.criticalThreshold}   y2={yMax}                     fill="rgba(239,68,68,0.06)"   stroke="none" />

              <CartesianGrid strokeDasharray="3 3" stroke="rgba(14,165,233,0.10)" vertical={false} />

              <XAxis
                dataKey="label"
                interval={9}
                tick={{ fill: '#94a3b8', fontSize: 9 }}
                axisLine={{ stroke: '#e0f2fe' }}
                tickLine={false}
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fill: '#94a3b8', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={34}
                tickFormatter={(v) => `${v}m`}
              />

              <Tooltip
                content={<ForecastTooltip />}
                cursor={{ stroke: 'rgba(56,189,248,0.3)', strokeWidth: 1 }}
              />

              {/* "Today" vertical divider */}
              <ReferenceLine
                x={todayLabel}
                stroke="#475569"
                strokeDasharray="3 3"
                strokeWidth={1.5}
                label={{ value: 'Today', position: 'insideTopRight', fill: '#64748b', fontSize: 8 }}
              />

              {/* Warning threshold */}
              <ReferenceLine
                y={result.warningThreshold}
                stroke="#f59e0b"
                strokeDasharray="5 3"
                strokeWidth={1.2}
                label={{ value: 'Warning', position: 'insideTopRight', fill: '#f59e0b', fontSize: 8 }}
              />

              {/* Critical threshold */}
              <ReferenceLine
                y={result.criticalThreshold}
                stroke="#ef4444"
                strokeDasharray="5 3"
                strokeWidth={1.8}
                label={{ value: 'Critical', position: 'insideTopRight', fill: '#ef4444', fontSize: 8 }}
              />

              {/* Confidence band (subtle dashed bounds) */}
              <Line
                dataKey="upperBound" type="monotone"
                stroke="rgba(251,191,36,0.22)" strokeWidth={1} strokeDasharray="2 3"
                dot={false} activeDot={false} connectNulls={false}
              />
              <Line
                dataKey="lowerBound" type="monotone"
                stroke="rgba(251,191,36,0.22)" strokeWidth={1} strokeDasharray="2 3"
                dot={false} activeDot={false} connectNulls={false}
              />

              {/* Historical — solid blue with area fill */}
              <Area
                dataKey="historical" type="monotone"
                stroke="#38bdf8" strokeWidth={2.5}
                fill="url(#gwHistGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#38bdf8', strokeWidth: 0 }}
                connectNulls={false}
              />

              {/* Predicted — dashed amber */}
              <Line
                dataKey="predicted" type="monotone"
                stroke="#f59e0b" strokeWidth={2.2} strokeDasharray="8 5"
                dot={false}
                activeDot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Legend row */}
          <div style={{ display: 'flex', gap: 14, paddingLeft: 38, paddingBottom: 8 }}>
            {[
              { color: '#38bdf8', dash: false, label: 'Historical' },
              { color: '#f59e0b', dash: true,  label: 'ML Predicted' },
              { color: '#f59e0b', dash: true,  label: 'Confidence band', faint: true },
              { color: '#ef4444', dash: true,  label: 'Critical' },
            ].map(({ color, dash, label, faint }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="14" height="6">
                  {dash
                    ? <line x1="0" y1="3" x2="14" y2="3"
                        stroke={color} strokeWidth="2"
                        strokeDasharray="4 3" opacity={faint ? 0.4 : 1} />
                    : <line x1="0" y1="3" x2="14" y2="3"
                        stroke={color} strokeWidth="2.5" />
                  }
                </svg>
                <span style={{ fontSize: 8.5, color: '#94a3b8' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ─ Right stats panel ────────────────────────────────────────────────── */}
        <div style={{
          flex: '0 0 162px',
          borderLeft: '1px solid #e0f2fe',
          padding: '12px 11px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          background: '#f8fafc',
        }}>

          {/* Weather widget */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 20 }}>{weather.icon}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0c4a6e', lineHeight: 1.1 }}>
                {weather.temp}°C
              </div>
              <div style={{ fontSize: 8.5, color: '#64748b' }}>
                {weather.desc} · {weather.humidity}% RH
              </div>
            </div>
          </div>

          {/* Status card */}
          <div style={{
            background: ss.bg, border: `1px solid ${ss.border}40`,
            borderRadius: 8, padding: '8px 9px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
              <span style={{ fontSize: 11 }}>
                {result.trend === 'worsening' || result.trend === 'critical' ? '⚠️' : '✅'}
              </span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: ss.color, letterSpacing: '0.03em' }}>
                {result.statusLabel}
              </span>
            </div>
            <div style={{ fontSize: 8.5, color: '#475569', lineHeight: 1.4 }}>
              {result.daysToCritical !== null
                ? `⚠ Critical in ~${result.daysToCritical} days`
                : '✓ No critical depletion forecast in 30 days'
              }
            </div>
          </div>

          {/* Current depth */}
          <div>
            <div style={{ fontSize: 8, color: '#64748b', letterSpacing: '0.08em', marginBottom: 2 }}>
              ⬇ CURRENT DEPTH
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0c4a6e', lineHeight: 1.1 }}>
              {result.currentDepth} m
            </div>
            <div style={{ fontSize: 8.5, color: '#94a3b8' }}>below ground</div>
          </div>

          {/* 30-day trend */}
          <div>
            <div style={{ fontSize: 8, color: '#64748b', letterSpacing: '0.08em', marginBottom: 2 }}>
              📈 30-DAY TREND
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: trendColor }}>
              {trendSign}{trendAmt} m/mo
            </div>
            <div style={{ fontSize: 8.5, color: '#94a3b8' }}>{trendLabel}</div>
          </div>

          {/* 7-day rainfall forecast */}
          <div>
            <div style={{ fontSize: 8, color: '#64748b', letterSpacing: '0.08em', marginBottom: 4 }}>
              🌧 7-DAY FORECAST
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              {sensor.rainfallForecast.map((f) => {
                const d = new Date(f.date);
                const isRainy = f.probability > 50;
                return (
                  <div key={f.date} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 7.5, color: '#94a3b8' }}>
                      {d.getDate()}/{d.getMonth() + 1}
                    </div>
                    <div style={{
                      height: 18, borderRadius: 2, margin: '2px 0',
                      background: isRainy ? '#bae6fd' : '#e0f2fe',
                    }} />
                    <div style={{ fontSize: 7, color: isRainy ? '#38bdf8' : '#94a3b8' }}>
                      {f.probability}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Projected depth milestones */}
          <div style={{ borderTop: '1px solid #e0f2fe', paddingTop: 8 }}>
            <div style={{ fontSize: 8, color: '#64748b', letterSpacing: '0.08em', marginBottom: 5 }}>
              PROJECTED DEPTH
            </div>
            {([
              { label: 'Day  7', value: result.projectedAt7  },
              { label: 'Day 14', value: result.projectedAt14 },
              { label: 'Day 30', value: result.projectedAt30 },
            ] as { label: string; value: number }[]).map(({ label, value }) => {
              const worse = value > result.currentDepth;
              return (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 3,
                }}>
                  <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>{label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: worse ? '#ef4444' : '#22c55e' }}>
                    {value.toFixed(1)} m
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Footer note ─────────────────────────────────────────────────────── */}
      <div style={{
        background: '#f8fafc', borderTop: '1px solid #e0f2fe',
        padding: '5px 14px', textAlign: 'center',
      }}>
        <span style={{ fontSize: 8.5, color: '#94a3b8' }}>
          Model trained on 30-day extraction history · Tamil Nadu hard-rock aquifer parameters · Rainfall from 7-day forecast
        </span>
      </div>
    </div>
  );
}
