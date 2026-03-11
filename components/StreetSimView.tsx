'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wifi, Droplets, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import { IndustrySensor } from '@/types';
import {
  calculateFine, getStatusColor, getStatusLabel,
  formatLitres, formatINR,
} from '@/lib/fineCalculation';

// ── Deterministic building silhouette generator from sensor id ────────────────
function buildingsForSensor(id: string): { w: number; h: number; x: number }[] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  const rng = (n: number) => Math.abs((Math.sin(hash + n) * 10000) % 1);
  return Array.from({ length: 7 }, (_, i) => ({
    w: 34 + rng(i * 3) * 60,
    h: 55 + rng(i * 3 + 1) * 130,
    x: i * 14 + rng(i * 3 + 2) * 8,
  }));
}

// ── Inline scanning-dot spinner ───────────────────────────────────────────────
function ScanDot({ delay }: { delay: number }) {
  return (
    <span style={{
      display: 'inline-block', width: 4, height: 4, borderRadius: '50%',
      background: '#38bdf8', margin: '0 2px',
      animation: `ssdot 1.2s ease-in-out ${delay}s infinite`,
    }} />
  );
}

interface Props {
  sensor: IndustrySensor;
  onClose: () => void;
}

export default function StreetSimView({ sensor, onClose }: Props) {
  const fine     = calculateFine(sensor);
  const color    = getStatusColor(fine.status);
  const isAlert  = fine.status === 'critical' || fine.status === 'no_noc';
  const buildings = buildingsForSensor(sensor.id);

  // scan-line Y position (0-100), cycles continuously
  const [scanY, setScanY] = useState(0);
  const scanRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    scanRef.current = setInterval(() => setScanY(y => (y + 0.5) % 100), 30);
    return () => { if (scanRef.current) clearInterval(scanRef.current); };
  }, []);

  // water rise animation state (0 → actual moisture %)
  const [waterFill, setWaterFill] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWaterFill(sensor.moisturePercentage), 600);
    return () => clearTimeout(t);
  }, [sensor.id]);

  // water table Y offset inside underground section (0-100%)
  const maxDepth   = Math.max(sensor.groundwaterLevel * 1.6, 25);
  const waterPct   = Math.min((sensor.groundwaterLevel / maxDepth) * 100, 92);
  const limitPct   = Math.min((sensor.todayExtraction / fine.dailyLimit) * 100, 100);

  // keyboard close
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(14,165,233,0.12)',
        backdropFilter: 'blur(8px)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'inherit',
      }}
      onClick={onClose}
    >
      {/* ── Inner panel (stop propagation so clicks inside don't close) ─────── */}
      <motion.div
        initial={{ scale: 0.96, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 16 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{
          margin: 'auto',
          width: 'min(1060px, 96vw)',
          maxHeight: '88vh',
          background: '#ffffff',
          border: `1px solid ${color}40`,
          borderRadius: 16,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: `0 32px 80px rgba(14,165,233,0.15), 0 0 0 1px ${color}25`,
        }}
      >
        {/* ── Top header bar ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          background: '#f8fafc',
          borderBottom: '1px solid #e0f2fe',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: color,
              boxShadow: `0 0 10px ${color}`,
              animation: 'ssledblink 1.6s ease-in-out infinite',
            }} />
            <span style={{ color: '#64748b', fontSize: 10, letterSpacing: '0.1em' }}>
              GROUND SENSOR SCAN
            </span>
            <span style={{ color: '#cbd5e1', fontSize: 10 }}>·</span>
            <span style={{ color: '#0c4a6e', fontFamily: 'monospace', fontSize: 11 }}>
              {sensor.id}
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, color, background: `${color}18`,
              border: `1px solid ${color}35`, borderRadius: 4, padding: '2px 7px',
            }}>
              {getStatusLabel(fine.status).toUpperCase()}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8', fontSize: 10 }}>
              <Wifi size={11} />
              <span>LIVE</span>
              <ScanDot delay={0} /><ScanDot delay={0.2} /><ScanDot delay={0.4} />
            </div>
            <button
              onClick={onClose}
              style={{
                background: '#f0f9ff', border: '1px solid #e0f2fe',
                borderRadius: 6, width: 28, height: 28, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Main content row ───────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* ════════════ LEFT: Visual Scan ════════════ */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e0f2fe' }}>

            {/* ── ABOVE GROUND: street scene ──────────────── */}
            <div style={{
              height: '38%',
              position: 'relative',
              overflow: 'hidden',
              flexShrink: 0,
              background: 'linear-gradient(180deg, #020812 0%, #060d20 55%, #0c1a35 100%)',
            }}>
              {/* Stars */}
              {[...Array(22)].map((_, i) => {
                const sx = ((i * 137.5) % 100);
                const sy = ((i * 83.1) % 60);
                const ss = i % 3 === 0 ? 1.5 : 1;
                return (
                  <div key={i} style={{
                    position: 'absolute', left: `${sx}%`, top: `${sy}%`,
                    width: ss, height: ss, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.6)',
                    animation: `ssstar 3s ease-in-out ${(i * 0.4) % 3}s infinite alternate`,
                  }} />
                );
              })}

              {/* Building silhouettes */}
              <div style={{ position: 'absolute', bottom: 22, left: 0, right: 0, display: 'flex', alignItems: 'flex-end', gap: 3, padding: '0 8px' }}>
                {buildings.map((b, i) => (
                  <div key={i} style={{
                    width: `${b.w * 0.55}px`, height: b.h,
                    background: `rgba(10,15,28,${0.7 + (i % 3) * 0.1})`,
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    borderLeft: '1px solid rgba(255,255,255,0.03)',
                    borderRight: '1px solid rgba(255,255,255,0.03)',
                    flexShrink: 0,
                    position: 'relative',
                  }}>
                    {/* Occasional window lights */}
                    {i % 2 === 0 && (
                      <div style={{
                        position: 'absolute', top: '20%', left: '25%',
                        width: 4, height: 4, background: 'rgba(255,220,100,0.5)',
                        animation: `ssstar 4s ease-in-out ${i * 0.7}s infinite alternate`,
                      }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Ground surface strip */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: 22,
                background: 'linear-gradient(180deg, #1a1208 0%, #0d0a05 100%)',
                borderTop: '1px solid rgba(14,165,233,0.4)',
              }}>
                {/* Road texture marks */}
                <div style={{ position: 'absolute', top: '40%', left: '15%', right: '15%', height: 1, background: 'rgba(255,255,255,0.04)' }} />
              </div>

              {/* IoT sensor pole (CSS art) */}
              <div style={{
                position: 'absolute', bottom: 18, left: '42%',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}>
                {/* Sensor head */}
                <div style={{
                  width: 34, height: 24, borderRadius: 6,
                  background: '#f0f9ff', border: `2px solid ${color}`,
                  boxShadow: `0 0 20px ${color}60`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: i === 1 ? `${color}88` : color }} />
                    ))}
                  </div>
                  {/* Blinking LED */}
                  <div style={{
                    position: 'absolute', top: -5, right: -5,
                    width: 9, height: 9, borderRadius: '50%',
                    background: color, boxShadow: `0 0 10px ${color}`,
                    animation: 'ssledblink 1.8s ease-in-out infinite',
                  }} />
                </div>
                {/* Pole */}
                <div style={{ width: 3, height: 18, background: `linear-gradient(to bottom, ${color}80, ${color}20)` }} />
                {/* Anchor plate */}
                <div style={{ width: 18, height: 4, borderRadius: 2, background: `${color}40`, border: `1px solid ${color}50` }} />
              </div>

              {/* Scan overlay label */}
              <div style={{
                position: 'absolute', top: 8, left: 12,
                color: 'rgba(255,255,255,0.55)', fontSize: 9, letterSpacing: '0.12em',
              }}>
                SURFACE · {sensor.location?.toUpperCase()}
              </div>

              {/* Coordinates */}
              <div style={{
                position: 'absolute', top: 8, right: 12,
                color: 'rgba(255,255,255,0.55)', fontSize: 9, fontFamily: 'monospace',
              }}>
                {sensor.lat.toFixed(4)}°N {sensor.lng.toFixed(4)}°E
              </div>
            </div>

            {/* ── UNDERGROUND SCAN ──────────────────────────── */}
            <div style={{
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
            }}>
              {/* Depth ruler */}
              <div style={{
                width: 36, flexShrink: 0,
                borderRight: '1px solid rgba(255,255,255,0.18)',
                padding: '0 4px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                background: 'rgba(0,10,30,0.55)',
              }}>
                {Array.from({ length: 6 }, (_, i) => {
                  const d = Math.round((maxDepth / 5) * i);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, paddingTop: i === 0 ? 4 : 0 }}>
                      <div style={{ width: 6, height: 1, background: 'rgba(255,255,255,0.4)' }} />
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 8, fontFamily: 'monospace' }}>
                        {d}m
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Cross-section layers */}
              <div style={{ flex: 1, position: 'relative' }}>

                {/* Topsoil layer (top 18%) */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '18%',
                  background: 'linear-gradient(180deg, #3d2b1a 0%, #5c3e2a 100%)',
                  borderBottom: '1px dashed rgba(255,255,255,0.07)',
                }}>
                  <div style={{ position: 'absolute', top: 4, left: 8, color: 'rgba(255,255,255,0.6)', fontSize: 8, letterSpacing: '0.08em' }}>
                    TOPSOIL
                  </div>
                  {/* Soil texture dots */}
                  {[12, 28, 45, 62, 78, 90].map((x, i) => (
                    <div key={i} style={{
                      position: 'absolute', left: `${x}%`, top: '50%',
                      width: 3, height: 3, borderRadius: '50%', background: 'rgba(0,0,0,0.3)',
                    }} />
                  ))}
                </div>

                {/* Sub-soil layer (18% - 40%) */}
                <div style={{
                  position: 'absolute', top: '18%', left: 0, right: 0, height: '22%',
                  background: 'linear-gradient(180deg, #4a2010 0%, #3b1a0e 100%)',
                  borderBottom: '1px dashed rgba(255,255,255,0.07)',
                }}>
                  <div style={{ position: 'absolute', top: 4, left: 8, color: 'rgba(255,255,255,0.55)', fontSize: 8, letterSpacing: '0.08em' }}>
                    SUB-SOIL CLAY
                  </div>
                </div>

                {/* Rock formation (40% - waterPct - 5%) */}
                <div style={{
                  position: 'absolute', top: '40%', left: 0, right: 0,
                  height: `${Math.max(waterPct - 48, 8)}%`,
                  background: 'linear-gradient(180deg, #1a1a2e 0%, #151520 100%)',
                  borderBottom: '1px dashed rgba(255,255,255,0.05)',
                }}>
                  <div style={{ position: 'absolute', top: 4, left: 8, color: 'rgba(255,255,255,0.5)', fontSize: 8, letterSpacing: '0.08em' }}>
                    WEATHERED ROCK
                  </div>
                  {/* Rock pattern */}
                  {[15, 35, 55, 72, 88].map((x, i) => (
                    <div key={i} style={{
                      position: 'absolute', left: `${x}%`, top: '35%',
                      width: `${8 + i * 3}px`, height: 1, background: 'rgba(255,255,255,0.05)',
                      transform: `rotate(${-10 + i * 5}deg)`,
                    }} />
                  ))}
                </div>

                {/* ── WATER TABLE ─────────────────────────── */}
                <motion.div
                  initial={{ top: '95%' }}
                  animate={{ top: `${waterPct}%` }}
                  transition={{ duration: 1.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    position: 'absolute', left: 0, right: 0,
                    zIndex: 4,
                  }}
                >
                  {/* Water table label line */}
                  <div style={{
                    position: 'relative',
                    height: 2,
                    background: `linear-gradient(90deg, transparent, #38bdf8 20%, #38bdf8 80%, transparent)`,
                    boxShadow: '0 0 12px #38bdf860',
                  }}>
                    <div style={{
                      position: 'absolute', right: 8, top: -9,
                      color: '#38bdf8', fontSize: 8, letterSpacing: '0.06em', fontWeight: 700,
                    }}>
                      ▼ WATER TABLE · {sensor.groundwaterLevel}m
                    </div>
                  </div>

                  {/* Aquifer (water-bearing zone) below the table line */}
                  <div style={{
                    height: 60,
                    background: 'linear-gradient(180deg, rgba(14,80,140,0.7) 0%, rgba(7,40,80,0.5) 100%)',
                    overflow: 'hidden', position: 'relative',
                  }}>
                    {/* Animated water waves */}
                    {[0, 1, 2].map(row => (
                      <div key={row} style={{
                        position: 'absolute',
                        left: 0, right: 0,
                        top: 8 + row * 18,
                        height: 2,
                        background: `rgba(56,189,248,${0.35 - row * 0.08})`,
                        borderRadius: 1,
                        animation: `sswave ${2.8 + row * 0.6}s ease-in-out ${row * 0.5}s infinite`,
                      }} />
                    ))}
                    {/* Moisture fill indicator */}
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: waterFill / 100 }}
                      transition={{ duration: 1.4, delay: 1.0, ease: 'easeOut' }}
                      style={{
                        position: 'absolute', bottom: 0, left: 0,
                        height: '30%', originX: 0,
                        background: 'rgba(56,189,248,0.25)',
                        width: '100%',
                      }}
                    />
                    {/* Bubble particles */}
                    {[8, 22, 40, 58, 76, 90].map((x, i) => (
                      <div key={i} style={{
                        position: 'absolute',
                        left: `${x}%`, bottom: 0,
                        width: 3, height: 3, borderRadius: '50%',
                        background: `rgba(56,189,248,${0.3 + (i % 3) * 0.15})`,
                        animation: `ssbubble ${1.5 + (i % 4) * 0.5}s ease-in-out ${i * 0.35}s infinite`,
                      }} />
                    ))}
                  </div>
                </motion.div>

                {/* Deep bedrock (below water table) */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: `${100 - waterPct - 12}%`,
                  background: 'linear-gradient(180deg, #0a0a12 0%, #050508 100%)',
                  zIndex: 2,
                }}>
                  <div style={{ position: 'absolute', top: 4, left: 8, color: 'rgba(255,255,255,0.45)', fontSize: 8, letterSpacing: '0.08em' }}>
                    GRANITE / BEDROCK
                  </div>
                </div>

                {/* ── Probe / borehole line ──────────────────── */}
                <div style={{
                  position: 'absolute', left: '42%', top: 0, bottom: 0,
                  width: 1, zIndex: 10,
                  background: `linear-gradient(180deg, ${color}70 0%, ${color}40 ${waterPct}%, #38bdf880 ${waterPct}%, transparent 100%)`,
                  boxShadow: `0 0 4px ${color}50`,
                }} />

                {/* Probe tip at water table */}
                <motion.div
                  initial={{ top: '10%' }}
                  animate={{ top: `calc(${waterPct}% - 5px)` }}
                  transition={{ duration: 1.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    position: 'absolute', left: 'calc(42% - 5px)',
                    width: 11, height: 11, zIndex: 12,
                    borderRadius: '50%',
                    background: '#38bdf8',
                    boxShadow: '0 0 14px #38bdf8, 0 0 4px #38bdf8',
                  }}
                />

                {/* ── Scan line ─────────────────────────────── */}
                <div style={{
                  position: 'absolute', left: 0, right: 0,
                  top: `${scanY}%`,
                  height: 1, zIndex: 8,
                  background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.5), transparent)',
                  pointerEvents: 'none',
                }} />

                {/* UNDERGROUND label */}
                <div style={{
                  position: 'absolute', top: 5, right: 8,
                  color: 'rgba(255,255,255,0.5)', fontSize: 9, letterSpacing: '0.1em',
                }}>
                  SUBSURFACE ANALYSIS
                </div>

              </div>
            </div>
          </div>

          {/* ════════════ RIGHT: HUD Panel ════════════ */}
          <div style={{
            width: 240,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '14px 14px',
            gap: 12,
            overflowY: 'auto',
            background: '#f8fafc',
          }}>
            {/* Industry name */}
            <div>
              <div style={{ color: '#0c4a6e', fontWeight: 700, fontSize: 13, lineHeight: 1.35 }}>
                {sensor.industryName}
              </div>
              <div style={{ color: '#64748b', fontSize: 10, marginTop: 3 }}>
                📍 {sensor.location}
              </div>
            </div>

            {/* GW Depth */}
            <HudCard
              label="GROUNDWATER DEPTH"
              icon={<Droplets size={12} />}
              value={`${sensor.groundwaterLevel} m`}
              sub="below surface"
              accent="#38bdf8"
            />

            {/* Soil Moisture */}
            <div style={{ background: '#f0f9ff', borderRadius: 8, padding: '10px 12px', border: '1px solid #e0f2fe' }}>
              <div style={{ color: '#64748b', fontSize: 9, letterSpacing: '0.08em', marginBottom: 8 }}>
                SOIL MOISTURE
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 5, background: '#e0f2fe', borderRadius: 3, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${waterFill}%` }}
                    transition={{ duration: 1.4, delay: 0.6, ease: 'easeOut' }}
                    style={{ height: '100%', background: '#34d399', borderRadius: 3 }}
                  />
                </div>
                <span style={{ color: '#34d399', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                  {sensor.moisturePercentage}%
                </span>
              </div>
            </div>

            {/* Extraction vs Limit */}
            <div style={{ background: '#f0f9ff', borderRadius: 8, padding: '10px 12px', border: '1px solid #e0f2fe' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#64748b', fontSize: 9, letterSpacing: '0.08em' }}>TODAY&apos;S EXTRACTION</span>
                <span style={{ color, fontWeight: 700, fontSize: 11 }}>{formatLitres(sensor.todayExtraction)}</span>
              </div>
              <div style={{ height: 5, background: '#e0f2fe', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${limitPct}%` }}
                  transition={{ duration: 1.4, delay: 0.8, ease: 'easeOut' }}
                  style={{
                    height: '100%', background: color, borderRadius: 3,
                    boxShadow: limitPct > 85 ? `0 0 6px ${color}` : 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8', fontSize: 9 }}>0</span>
                <span style={{ color: '#94a3b8', fontSize: 9 }}>
                  Limit {formatLitres(fine.dailyLimit)}
                </span>
              </div>
            </div>

            {/* Fine alert */}
            {isAlert && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                style={{
                  borderRadius: 8, padding: '10px 12px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                  <AlertTriangle size={11} color="#fca5a5" />
                  <span style={{ color: '#fca5a5', fontSize: 9, letterSpacing: '0.08em' }}>FINE ALERT</span>
                </div>
                <div style={{ color: '#ef4444', fontWeight: 800, fontSize: 16 }}>
                  {fine.status === 'no_noc' ? formatINR(fine.nocAnnualFine ?? 0) : formatINR(fine.totalFine30Days)}
                </div>
                <div style={{ color: '#64748b', fontSize: 9, marginTop: 2 }}>
                  {fine.status === 'no_noc'
                    ? `Annual penalty · ${fine.nocFineCategory}`
                    : `30-day fine · ${fine.daysExceeded} days exceeded`}
                </div>
              </motion.div>
            )}

            {/* All-good */}
            {!isAlert && fine.status === 'normal' && (
              <div style={{
                borderRadius: 8, padding: '10px 12px',
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <CheckCircle size={12} color="#22c55e" />
                <span style={{ color: '#22c55e', fontSize: 10 }}>Within extraction limit</span>
              </div>
            )}

            {/* Badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              <Badge
                label={sensor.hasNOC ? '✓ NOC Valid' : '✗ No NOC'}
                color={sensor.hasNOC ? '#22c55e' : '#ef4444'}
              />
              <Badge
                label={sensor.industryType === 'small_micro' ? 'Small / Micro' : 'Water Intensive'}
                color="#38bdf8"
              />
            </div>

            {/* 30-day summary */}
            <div style={{ background: '#f0f9ff', borderRadius: 8, padding: '10px 12px', border: '1px solid #e0f2fe' }}>
              <div style={{ color: '#64748b', fontSize: 9, letterSpacing: '0.08em', marginBottom: 8 }}>
                30-DAY EXTRACTION PROFILE
              </div>
              <div style={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', height: 36 }}>
                {sensor.dailyExtractions.slice(-20).map((entry, i) => {
                  const v = entry.liters;
                  const h = Math.max((v / fine.dailyLimit) * 100, 4);
                  const bar_color = v > fine.dailyLimit ? '#ef4444' : v > fine.dailyLimit * 0.85 ? '#f59e0b' : '#22c55e';
                  return (
                    <div key={i} style={{
                      flex: 1, height: `${Math.min(h, 100)}%`,
                      background: bar_color,
                      borderRadius: 1,
                      opacity: 0.7 + (i / 20) * 0.3,
                    }} />
                  );
                })}
              </div>
              <div style={{ color: '#94a3b8', fontSize: 8, marginTop: 4, textAlign: 'right' }}>
                last 20 days
              </div>
            </div>

            {/* Hint */}
            <div style={{ color: '#94a3b8', fontSize: 9, textAlign: 'center', marginTop: 'auto', paddingTop: 4 }}>
              Press ESC or click outside to close
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Keyframe injection ─────────────────────────────────────────────── */}
      <style>{`
        @keyframes ssledblink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes ssstar { 0%{opacity:0.3} 100%{opacity:0.8} }
        @keyframes sswave {
          0%   { transform: scaleX(0.8) translateX(-5%); opacity:0.5 }
          50%  { transform: scaleX(1.05) translateX(3%); opacity:0.9 }
          100% { transform: scaleX(0.8) translateX(-5%); opacity:0.5 }
        }
        @keyframes ssbubble {
          0%   { transform: translateY(0); opacity:0.4 }
          50%  { transform: translateY(-14px); opacity:0.8 }
          100% { transform: translateY(-28px); opacity:0 }
        }
        @keyframes ssdot { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }
      `}</style>
    </motion.div>
  );
}

// ── Small reusable HUD card ───────────────────────────────────────────────────
function HudCard({
  label, icon, value, sub, accent,
}: {
  label: string; icon: React.ReactNode;
  value: string; sub: string; accent: string;
}) {
  return (
    <div style={{
      background: '#f0f9ff', borderRadius: 8,
      padding: '10px 12px', border: '1px solid #e0f2fe',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b', fontSize: 9, letterSpacing: '0.08em', marginBottom: 5 }}>
        <span style={{ color: accent }}>{icon}</span>
        {label}
      </div>
      <div style={{ color: accent, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ color: '#94a3b8', fontSize: 9, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 9, padding: '3px 8px', borderRadius: 4,
      background: `${color}12`, color, border: `1px solid ${color}28`,
    }}>
      {label}
    </span>
  );
}
