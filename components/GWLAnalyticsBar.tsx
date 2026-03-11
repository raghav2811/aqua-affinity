'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, BarChart2, RefreshCw } from 'lucide-react';
import GWLTrendChart from './GWLTrendChart';
import DepletionRiskPanel from './DepletionRiskPanel';

// ── API response shapes ───────────────────────────────────────────────────────
interface HistoricalPoint { date: string; depthFt: number; depthM: number }
interface PredictedPoint  { date: string; predictedDepthFt: number; predictedDepthM: number; precipitation_mm: number; temperature_max: number; rain_probability: number }
interface Risk {
  level: 'safe' | 'warning' | 'critical';
  trend: 'declining' | 'recovering';
  trendFtPerDay: number;
  daysUntilCritical: number | null;
  currentDepthFt: number; currentDepthM: number;
  criticalDepthFt: number; criticalDepthM: number;
}
interface WeatherDay { date: string; precipitation_mm: number; temperature_max: number; temperature_min: number; rain_probability: number; weathercode: number }
interface WeatherCurrent { temperature: number | null; humidity: number | null; precipitation: number | null; weathercode: number | null }

interface PredictData { historical: HistoricalPoint[]; predictions: PredictedPoint[]; model: { r2: number }; risk: Risk }
interface WeatherData  { current: WeatherCurrent; forecast: WeatherDay[] }

const RISK_BORDER = { safe: '#e0f2fe', warning: 'rgba(245,158,11,0.3)', critical: 'rgba(239,68,68,0.3)' };
const RISK_BG     = { safe: '#f0f9ff', warning: 'rgba(254,252,232,0.95)', critical: 'rgba(255,241,242,0.95)' };

export default function GWLAnalyticsBar() {
  const [open,        setOpen]        = useState(false);
  const [predictData, setPredictData] = useState<PredictData | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, wRes] = await Promise.all([
        fetch('/api/gwl-predict'),
        fetch('/api/weather'),
      ]);
      if (!pRes.ok) throw new Error('Prediction API failed');
      const [pData, wData] = await Promise.all([pRes.json(), wRes.json()]);
      setPredictData(pData);
      if (!wData.error) setWeatherData(wData);
      setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const riskLevel = predictData?.risk?.level ?? 'safe';
  const panelBg   = RISK_BG[riskLevel];
  const panelBdr  = RISK_BORDER[riskLevel];

  return (
    <div style={{
      background: panelBg,
      borderBottom: `1px solid ${panelBdr}`,
      borderTop: '1px solid #e0f2fe',
      flexShrink: 0,
      transition: 'background 0.4s',
    }}>

      {/* ── Header toggle bar ──────────────────────────────────────── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 16px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={14} color="#0ea5e9" />
          <span style={{ color: '#0c4a6e', fontWeight: 700, fontSize: 12, letterSpacing: '0.04em' }}>
            GROUNDWATER ANALYTICS
          </span>
          {/* Live risk pill */}
          {predictData?.risk && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 4,
              background: riskLevel === 'safe'     ? 'rgba(34,197,94,0.12)'
                        : riskLevel === 'warning'  ? 'rgba(245,158,11,0.12)'
                        : 'rgba(239,68,68,0.12)',
              color:      riskLevel === 'safe'     ? '#22c55e'
                        : riskLevel === 'warning'  ? '#d97706'
                        : '#ef4444',
              border: `1px solid ${riskLevel === 'safe' ? 'rgba(34,197,94,0.3)' : riskLevel === 'warning' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
              letterSpacing: '0.07em',
            }}>
              {riskLevel.toUpperCase()}
            </span>
          )}
          {predictData?.risk?.daysUntilCritical != null && (
            <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 600 }}>
              · Critical in {predictData.risk.daysUntilCritical}d
            </span>
          )}
          {predictData?.risk?.level === 'safe' && predictData.risk.daysUntilCritical === null && (
            <span style={{ fontSize: 9, color: '#22c55e' }}>
              · Stable for 30+ days
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastUpdated && (
            <span style={{ color: '#94a3b8', fontSize: 9 }}>Updated {lastUpdated}</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); load(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#94a3b8', display: 'flex' }}
            title="Refresh"
          >
            <RefreshCw size={11} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          {open ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
        </div>
      </div>

      {/* ── Expandable content ─────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="analytics-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 360, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            style={{ overflow: 'hidden' }}
            onAnimationComplete={() => window.dispatchEvent(new Event('resize'))}
          >
            <div style={{
              display: 'flex', gap: 0, height: 360, padding: '4px 0 8px 0',
            }}>

              {/* Left: Trend chart */}
              <div style={{
                flex: 1, paddingLeft: 8, paddingRight: 4,
                borderRight: '1px solid #e0f2fe',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, paddingLeft: 4 }}>
                  <span style={{ color: '#64748b', fontSize: 9, letterSpacing: '0.07em' }}>
                    HISTORICAL + PREDICTED GROUNDWATER DEPTH (ft below ground)
                  </span>
                  {predictData?.model?.r2 != null && (
                    <span style={{ fontSize: 9, color: '#94a3b8' }}>
                      ML R²={( predictData.model.r2 * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                {error ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: 12 }}>
                    {error}
                  </div>
                ) : (
                  <div style={{ flex: 1 }}>
                    {loading || !predictData ? (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          border: '2px solid #0ea5e9', borderTopColor: 'transparent',
                          animation: 'spin 0.9s linear infinite',
                        }} />
                      </div>
                    ) : (
                      <GWLTrendChart
                        historical={predictData.historical}
                        predictions={predictData.predictions}
                        criticalDepthFt={predictData.risk.criticalDepthFt}
                        unit="ft"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Right: Risk + weather */}
              <div style={{ width: 280, flexShrink: 0, padding: '0 10px 0 10px', overflowY: 'auto' }}>
                <DepletionRiskPanel
                  weather={weatherData}
                  risk={predictData?.risk ?? null}
                  modelR2={predictData?.model?.r2 ?? null}
                  loading={loading}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
