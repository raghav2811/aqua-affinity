'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sliders, Send, Droplets, XCircle, Clock, CheckCircle,
  AlertTriangle, Zap, Thermometer, FlaskConical, X,
} from 'lucide-react';
import { VRSensor } from '@/types';
import {
  evaluateWaterLevel, getSprinklerColor, getSprinklerLabel,
  getWaterLevelColor, getWaterLevelLabel,
} from '@/lib/sensorMonitor';

// ── Types ────────────────────────────────────────────────────────────────────
interface SimValues {
  groundwaterLevel: number;
  soilMoisture: number;
  waterFlowRate: number;
  pumpStatus: 'on' | 'off';
  temperature: number;
  ph: number;
  turbidity: number;
  batteryLevel: number;
  signalStrength: number;
}

interface SliderDef {
  key: keyof SimValues;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  icon: React.ReactNode;
  color: string;
  // colour zones: below these values the bar changes colour
  warnAbove?: number;  // orange when value > this
  critAbove?: number;  // red when value > this
  warnBelow?: number;  // orange when value < this
  critBelow?: number;  // red when value < this
}

const SLIDERS: SliderDef[] = [
  {
    key: 'groundwaterLevel', label: 'Groundwater Depth', min: 0, max: 20, step: 0.1,
    unit: 'm', icon: <Droplets size={13} />, color: '#38bdf8',
    warnAbove: 8, critAbove: 12,
  },
  {
    key: 'soilMoisture',     label: 'Soil Moisture',     min: 0, max: 100, step: 1,
    unit: '%', icon: <Droplets size={13} />, color: '#34d399',
    warnBelow: 30, critBelow: 15,
  },
  {
    key: 'waterFlowRate',    label: 'Water Flow Rate',   min: 0, max: 25, step: 0.1,
    unit: 'L/min', icon: <Zap size={13} />, color: '#a78bfa',
  },
  {
    key: 'temperature',      label: 'Temperature',       min: 15, max: 45, step: 0.1,
    unit: '°C', icon: <Thermometer size={13} />, color: '#f472b6',
    warnAbove: 38, critAbove: 42,
  },
  {
    key: 'ph',               label: 'Water pH',          min: 5, max: 9.5, step: 0.1,
    unit: '', icon: <FlaskConical size={13} />, color: '#fb923c',
    critBelow: 6,
  },
  {
    key: 'turbidity',        label: 'Turbidity',         min: 0, max: 20, step: 0.1,
    unit: 'NTU', icon: <FlaskConical size={13} />, color: '#fbbf24',
    warnAbove: 6, critAbove: 12,
  },
  {
    key: 'batteryLevel',     label: 'Battery',           min: 0, max: 100, step: 1,
    unit: '%', icon: <Zap size={13} />, color: '#22c55e',
    warnBelow: 25, critBelow: 10,
  },
  {
    key: 'signalStrength',   label: 'Signal Strength',   min: 0, max: 100, step: 1,
    unit: '%', icon: <Zap size={13} />, color: '#60a5fa',
    warnBelow: 30, critBelow: 15,
  },
];

function defaultValues(sensor: VRSensor): SimValues {
  const r = sensor.currentReading;
  return {
    groundwaterLevel: r.groundwaterLevel,
    soilMoisture:     r.soilMoisture,
    waterFlowRate:    r.waterFlowRate,
    pumpStatus:       r.pumpStatus,
    temperature:      r.temperature,
    ph:               r.ph,
    turbidity:        r.turbidity,
    batteryLevel:     r.batteryLevel,
    signalStrength:   r.signalStrength,
  };
}

function sliderBarColor(def: SliderDef, value: number): string {
  const n = value as number;
  if (def.critAbove  !== undefined && n > def.critAbove)  return '#ef4444';
  if (def.warnAbove  !== undefined && n > def.warnAbove)  return '#f59e0b';
  if (def.critBelow  !== undefined && n < def.critBelow)  return '#ef4444';
  if (def.warnBelow  !== undefined && n < def.warnBelow)  return '#f59e0b';
  return def.color;
}

// ── Single labelled slider row ───────────────────────────────────────────────
function SliderRow({ def, value, onChange }: {
  def: SliderDef;
  value: number;
  onChange: (v: number) => void;
}) {
  const color    = sliderBarColor(def, value);
  const range    = def.max - def.min;
  const fillPct  = ((value - def.min) / range) * 100;
  const displayVal = Number.isInteger(def.step) ? value : value.toFixed(1);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1 gap-2">
        <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.55)', minWidth: 0 }}>
          <span style={{ color }}>{def.icon}</span>
          <span className="text-xs truncate">{def.label}</span>
        </div>
        <span className="text-xs font-bold tabular-nums flex-shrink-0" style={{ color }}>
          {displayVal}{def.unit}
        </span>
      </div>

      {/* Custom slider */}
      <div className="relative" style={{ height: 20 }}>
        {/* Track background */}
        <div className="absolute top-1/2 -translate-y-1/2 w-full rounded-full"
          style={{ height: 5, background: 'rgba(255,255,255,0.08)' }} />
        {/* Fill */}
        <div className="absolute top-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={{ height: 5, width: `${fillPct}%`, background: color, transition: 'width 0.05s, background 0.2s' }} />
        <input
          type="range"
          min={def.min}
          max={def.max}
          step={def.step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          style={{ height: '100%' }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full pointer-events-none"
          style={{
            left: `calc(${fillPct}% - 6px)`,
            background: color,
            boxShadow: `0 0 6px ${color}`,
            transition: 'left 0.05s, background 0.2s',
          }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{def.min}{def.unit}</span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{def.max}{def.unit}</span>
      </div>
    </div>
  );
}

// ── Sprinkler state preview (live, recomputed from slider values) ─────────────
function SprinklerPreview({ sensor, values }: { sensor: VRSensor; values: SimValues }) {
  // Temporarily patch the sensor with slider values to preview outcome
  const patched: VRSensor = {
    ...sensor,
    currentReading: { ...sensor.currentReading, ...values },
  };
  const eval_ = evaluateWaterLevel(patched);
  const color  = getSprinklerColor(eval_.state);

  return (
    <div className="rounded-xl p-3 mb-4"
      style={{ background: `${color}0d`, border: `1px solid ${color}30` }}>
      <div className="flex items-center gap-2 mb-1">
        {eval_.state === 'active'  && <CheckCircle  size={15} style={{ color }} />}
        {eval_.state === 'blocked' && <XCircle      size={15} style={{ color }} />}
        {eval_.state === 'standby' && <Clock        size={15} style={{ color }} />}
        <span className="text-xs font-bold" style={{ color }}>
          {getSprinklerLabel(eval_.state)}
        </span>
        <span className="ml-auto text-xs px-1.5 py-0.5 rounded"
          style={{ background: `${getWaterLevelColor(patched)}15`, color: getWaterLevelColor(patched) }}>
          {getWaterLevelLabel(patched)}
        </span>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {eval_.message.replace(/[\u{1F680}-\u{1F9FF}]/gu, '').trim().slice(0, 140)}
      </p>
    </div>
  );
}

// ── Push status badge ─────────────────────────────────────────────────────────
type PushStatus = 'idle' | 'pushing' | 'success' | 'error';

function PushBadge({ status }: { status: PushStatus }) {
  if (status === 'idle') return null;
  const map = {
    pushing: { color: '#38bdf8', text: 'Pushing to Supabase…' },
    success: { color: '#22c55e', text: '✓ Stored & sprinkler updated' },
    error:   { color: '#ef4444', text: '✗ Push failed — check console' },
  } as const;
  const { color, text } = map[status as keyof typeof map];
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      className="mb-3 px-3 py-2 rounded-lg text-xs font-medium"
      style={{ background: `${color}15`, border: `1px solid ${color}35`, color }}
    >
      {text}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main export — SensorSimulator
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  sensor: VRSensor;
  onClose: () => void;
  onPushComplete: (sensorId: string, newState: string) => void;
}

export default function SensorSimulator({ sensor, onClose, onPushComplete }: Props) {
  const [values, setValues]       = useState<SimValues>(() => defaultValues(sensor));
  const [pushStatus, setPushStatus] = useState<PushStatus>('idle');
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateVal = useCallback((key: keyof SimValues, v: number) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  }, []);

  const handlePush = useCallback(async () => {
    setPushStatus('pushing');
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensorId: sensor.id, values }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { newSprinklerState } = await res.json() as { newSprinklerState: string };
      setPushStatus('success');
      onPushComplete(sensor.id, newSprinklerState);
    } catch (err) {
      console.error('SensorSimulator push error:', err);
      setPushStatus('error');
    } finally {
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => setPushStatus('idle'), 3000);
    }
  }, [sensor.id, values, onPushComplete]);

  return (
    <motion.div
      className="absolute inset-0 z-[2500] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="rounded-2xl flex flex-col overflow-hidden"
        style={{
          width: 'min(500px, 96vw)', maxHeight: '90vh',
          background: '#0c1526',
          border: '1px solid rgba(56,189,248,0.2)',
          boxShadow: '0 0 60px rgba(56,189,248,0.06)',
        }}
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2">
            <Sliders size={16} style={{ color: '#38bdf8' }} />
            <div>
              <p className="text-sm font-bold text-white">Sensor Simulator</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {sensor.id} · {sensor.farmerName} · {sensor.cropType}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'rgba(255,255,255,0.45)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {/* Live sprinkler preview (reacts to sliders instantly) */}
          <p className="text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            Live Outcome Preview
          </p>
          <SprinklerPreview sensor={sensor} values={values} />

          {/* Push feedback */}
          <AnimatePresence mode="wait">
            {pushStatus !== 'idle' && <PushBadge key={pushStatus} status={pushStatus} />}
          </AnimatePresence>

          {/* Pump toggle */}
          <div className="flex items-center justify-between mb-4 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2">
              <Zap size={13} style={{ color: values.pumpStatus === 'on' ? '#22c55e' : 'rgba(255,255,255,0.3)' }} />
              <span className="text-xs text-white">Pump Status</span>
            </div>
            <button
              onClick={() => setValues((p) => ({ ...p, pumpStatus: p.pumpStatus === 'on' ? 'off' : 'on' }))}
              className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold transition-all"
              style={
                values.pumpStatus === 'on'
                  ? { background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)' }
                  : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }
              }
            >
              <span className={`w-2 h-2 rounded-full ${values.pumpStatus === 'on' ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
              {values.pumpStatus === 'on' ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Sliders */}
          <p className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            Sensor Values
          </p>
          {SLIDERS.map((def) => (
            <SliderRow
              key={def.key}
              def={def}
              value={values[def.key] as number}
              onChange={(v) => updateVal(def.key, v)}
            />
          ))}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            onClick={() => setValues(defaultValues(sensor))}
            className="px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Reset
          </button>
          <button
            onClick={handlePush}
            disabled={pushStatus === 'pushing'}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: pushStatus === 'pushing'
                ? 'rgba(56,189,248,0.15)'
                : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
              color: pushStatus === 'pushing' ? '#38bdf8' : '#fff',
              boxShadow: pushStatus === 'pushing' ? 'none' : '0 4px 20px rgba(14,165,233,0.35)',
              opacity: pushStatus === 'pushing' ? 0.7 : 1,
            }}
          >
            {pushStatus === 'pushing' ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: '#38bdf8', borderTopColor: 'transparent' }} />
                Pushing…
              </>
            ) : (
              <>
                <Send size={14} />
                Push to Database
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
