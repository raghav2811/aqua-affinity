'use client';

import { CloudRain, Cloud, Sun, CloudSnow, Zap, Thermometer, Droplets, TrendingDown, TrendingUp, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';

// ── WMO weather-code → icon + label ──────────────────────────────────────────
function weatherIcon(code: number, size = 16) {
  if (code === 0)                     return <Sun size={size} color="#f59e0b" />;
  if (code <= 3)                      return <Cloud size={size} color="#94a3b8" />;
  if (code <= 67)                     return <CloudRain size={size} color="#38bdf8" />;
  if (code <= 79)                     return <CloudSnow size={size} color="#93c5fd" />;
  if (code <= 82)                     return <CloudRain size={size} color="#0ea5e9" />;
  return                               <Zap size={size} color="#f59e0b" />;
}

function weatherLabel(code: number): string {
  if (code === 0)         return 'Clear';
  if (code <= 3)          return 'Cloudy';
  if (code <= 48)         return 'Foggy';
  if (code <= 67)         return 'Rainy';
  if (code <= 77)         return 'Snowy';
  if (code <= 82)         return 'Showers';
  return                   'Thunderstorm';
}

// ── Risk config ───────────────────────────────────────────────────────────────
const RISK_CONFIG = {
  safe:     { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.25)',  icon: CheckCircle,  label: 'Safe',     msg: 'Groundwater levels are stable.' },
  warning:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', icon: AlertTriangle, label: 'Warning',  msg: 'Levels declining — monitor closely.' },
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)', icon: ShieldAlert,  label: 'Critical', msg: 'Dangerous depletion trend detected.' },
};

interface WeatherDay {
  date: string;
  precipitation_mm: number;
  temperature_max: number;
  rain_probability: number;
  weathercode: number;
}

interface WeatherCurrent {
  temperature: number | null;
  humidity: number | null;
  weathercode: number | null;
}

interface Risk {
  level: 'safe' | 'warning' | 'critical';
  trend: 'declining' | 'recovering';
  trendFtPerDay: number;
  daysUntilCritical: number | null;
  currentDepthM: number;
  criticalDepthM: number;
}

interface Props {
  weather:     { current: WeatherCurrent; forecast: WeatherDay[] } | null;
  risk:        Risk | null;
  modelR2:     number | null;
  loading:     boolean;
}

export default function DepletionRiskPanel({ weather, risk, modelR2, loading }: Props) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height: 40, borderRadius: 8, background: '#e0f2fe',
            animation: 'pulse 1.5s ease-in-out infinite',
            opacity: 0.6 - i * 0.1,
          }} />
        ))}
      </div>
    );
  }

  const riskCfg = risk ? RISK_CONFIG[risk.level] : null;
  const RiskIcon = riskCfg?.icon;
  const forecast7 = weather?.forecast?.slice(0, 7) ?? [];
  const maxRain    = Math.max(...forecast7.map(f => f.precipitation_mm), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', overflowY: 'auto' }}>

      {/* ── Current weather ───────────────────────────────────────── */}
      {weather?.current && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(14,165,233,0.06)', borderRadius: 10, padding: '10px 12px',
          border: '1px solid #e0f2fe',
        }}>
          <div>{weatherIcon(weather.current.weathercode ?? 0, 22)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#0c4a6e', fontWeight: 700, fontSize: 14, lineHeight: 1 }}>
              {weather.current.temperature !== null ? `${weather.current.temperature}°C` : '—'}
            </div>
            <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
              {weatherLabel(weather.current.weathercode ?? 0)} · {weather.current.humidity !== null ? `${weather.current.humidity}% RH` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Droplets size={13} color="#38bdf8" />
            <span style={{ color: '#38bdf8', fontSize: 11, fontWeight: 600 }}>
              {weather.current.humidity !== null ? `${weather.current.humidity}% RH` : '—'}
            </span>
          </div>
        </div>
      )}

      {/* ── Depletion risk badge ──────────────────────────────────── */}
      {riskCfg && risk && RiskIcon && (
        <div style={{
          background: riskCfg.bg, border: `1px solid ${riskCfg.border}`,
          borderRadius: 10, padding: '10px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <RiskIcon size={14} color={riskCfg.color} />
            <span style={{ color: riskCfg.color, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>
              {riskCfg.label.toUpperCase()} — {risk.trend === 'declining' ? 'DECLINING' : 'RECOVERING'}
            </span>
          </div>
          <p style={{ color: '#475569', fontSize: 11, lineHeight: 1.5, margin: 0 }}>
            {riskCfg.msg}
          </p>
          {risk.daysUntilCritical !== null && (
            <div style={{
              marginTop: 6, padding: '5px 8px', borderRadius: 6,
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
            }}>
              <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 700 }}>
                ⚠ Critical level in ~{risk.daysUntilCritical} days
              </span>
            </div>
          )}
          {risk.daysUntilCritical === null && risk.level === 'safe' && (
            <div style={{
              marginTop: 6, padding: '5px 8px', borderRadius: 6,
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
            }}>
              <span style={{ color: '#22c55e', fontSize: 11 }}>✓ No critical depletion forecast in 30 days</span>
            </div>
          )}
        </div>
      )}

      {/* ── Current depth metric ─────────────────────────────────── */}
      {risk && (
        <div style={{
          display: 'flex', gap: 8,
        }}>
          <div style={{ flex: 1, background: '#f0f9ff', borderRadius: 10, padding: '9px 12px', border: '1px solid #e0f2fe' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
              <Droplets size={11} color="#0ea5e9" />
              <span style={{ color: '#64748b', fontSize: 9, letterSpacing: '0.07em' }}>CURRENT DEPTH</span>
            </div>
            <div style={{ color: '#0c4a6e', fontWeight: 800, fontSize: 18, lineHeight: 1 }}>
              {risk.currentDepthM.toFixed(1)}<span style={{ fontSize: 11, fontWeight: 500, marginLeft: 2 }}>m</span>
            </div>
            <div style={{ color: '#64748b', fontSize: 9, marginTop: 2 }}>below ground</div>
          </div>

          <div style={{ flex: 1, background: '#f0f9ff', borderRadius: 10, padding: '9px 12px', border: '1px solid #e0f2fe' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
              {risk.trend === 'declining'
                ? <TrendingDown size={11} color="#ef4444" />
                : <TrendingUp size={11} color="#22c55e" />}
              <span style={{ color: '#64748b', fontSize: 9, letterSpacing: '0.07em' }}>30-DAY TREND</span>
            </div>
            <div style={{ color: risk.trend === 'declining' ? '#ef4444' : '#22c55e', fontWeight: 800, fontSize: 18, lineHeight: 1 }}>
              {risk.trend === 'declining' ? '↓' : '↑'}
              {Math.abs(risk.trendFtPerDay * 30 * 0.3048).toFixed(2)}
              <span style={{ fontSize: 11, fontWeight: 500, marginLeft: 2 }}>m/mo</span>
            </div>
            <div style={{ color: '#64748b', fontSize: 9, marginTop: 2 }}>
              {risk.trend === 'declining' ? 'declining' : 'recovering'}
            </div>
          </div>
        </div>
      )}

      {/* ── 7-day rainfall forecast mini-bars ────────────────────── */}
      {forecast7.length > 0 && (
        <div style={{ background: '#f0f9ff', borderRadius: 10, padding: '9px 12px', border: '1px solid #e0f2fe' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
            <CloudRain size={11} color="#0ea5e9" />
            <span style={{ color: '#64748b', fontSize: 9, letterSpacing: '0.07em' }}>7-DAY FORECAST</span>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 48 }}>
            {forecast7.map((day, i) => {
              const parts = day.date.split('-');
              const label = `${parts[2]}/${parts[1]}`;
              const pct   = Math.max((day.precipitation_mm / maxRain) * 80, day.precipitation_mm > 0 ? 8 : 4);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ fontSize: 8, color: '#94a3b8' }}>
                    {day.temperature_max ? `${Math.round(day.temperature_max)}°` : '—'}
                  </div>
                  <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{
                      width: '100%', height: `${pct}%`, minHeight: 3,
                      background: day.precipitation_mm > 10 ? '#0ea5e9' : day.precipitation_mm > 2 ? '#38bdf8' : '#bae6fd',
                      borderRadius: 3,
                    }} />
                  </div>
                  <div style={{ fontSize: 8, color: '#94a3b8' }}>{label}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Thermometer size={10} color="#f59e0b" />
              <span style={{ color: '#64748b', fontSize: 9 }}>
                Avg {(forecast7.reduce((s, d) => s + d.temperature_max, 0) / forecast7.length).toFixed(1)}°C
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <CloudRain size={10} color="#38bdf8" />
              <span style={{ color: '#64748b', fontSize: 9 }}>
                {forecast7.reduce((s, d) => s + d.precipitation_mm, 0).toFixed(1)} mm total
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Model accuracy footer ─────────────────────────────────── */}
      {modelR2 !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 2 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: modelR2 > 0.75 ? '#22c55e' : modelR2 > 0.5 ? '#f59e0b' : '#ef4444',
          }} />
          <span style={{ color: '#94a3b8', fontSize: 9 }}>
            ML model R² = {(modelR2 * 100).toFixed(1)}% accuracy · trained on CSV
          </span>
        </div>
      )}
    </div>
  );
}
