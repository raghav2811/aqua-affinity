'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff, Droplets, Sprout, CheckCircle, AlertTriangle,
  XCircle, Clock, Zap, RefreshCw, Wifi, WifiOff, Thermometer,
  Activity, ChevronRight, Check, Sliders,
} from 'lucide-react';
import SensorSimulator from './SensorSimulator';
import { VRSensor, FarmerAlert, SprinklerState } from '@/types';
import {
  fetchVRSensors, acknowledgeAlertInDB,
  updateSprinklerState, insertFarmerAlert,
} from '@/lib/supabaseQueries';
import {
  runHourlyCheck, acknowledgeAlert,
  getSprinklerColor, getSprinklerLabel,
  getWaterLevelLabel, getWaterLevelColor,
  formatCountdown, evaluateWaterLevel,
} from '@/lib/sensorMonitor';

const HOUR_IN_SECONDS = 3600;

// ── Sprinkler icon component ─────────────────────────────────────────────────
function SprinklerIcon({ state, size = 16 }: { state: SprinklerState; size?: number }) {
  const color = getSprinklerColor(state);
  if (state === 'active')  return <Droplets size={size} style={{ color }} />;
  if (state === 'blocked') return <XCircle  size={size} style={{ color }} />;
  return <Clock size={size} style={{ color }} />;
}

// ── Depth gauge bar ───────────────────────────────────────────────────────────
function DepthGauge({ sensor }: { sensor: VRSensor }) {
  const level    = sensor.currentReading.groundwaterLevel;
  const maxDepth = 20;
  const fillPct  = Math.min((level / maxDepth) * 100, 100);
  const color    = getWaterLevelColor(sensor);

  return (
    <div style={{ width: '100%' }}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>0 m</span>
        <span className="text-xs font-bold" style={{ color }}>
          {level.toFixed(1)} m
        </span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>20 m</span>
      </div>
      <div
        className="relative w-full rounded-full overflow-hidden"
        style={{ height: 8, background: 'rgba(255,255,255,0.08)' }}
      >
        {/* Safe zone marker */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: `${(sensor.safeDepthThreshold / maxDepth) * 100}%`,
            width: 1,
            background: '#22c55e',
            opacity: 0.6,
          }}
        />
        {/* Critical zone marker */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: `${(sensor.criticalDepthThreshold / maxDepth) * 100}%`,
            width: 1,
            background: '#ef4444',
            opacity: 0.6,
          }}
        />
        {/* Fill bar */}
        <motion.div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${fillPct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs" style={{ color: '#22c55e', opacity: 0.7 }}>
          Safe ≤{sensor.safeDepthThreshold}m
        </span>
        <span className="text-xs" style={{ color: '#ef4444', opacity: 0.7 }}>
          Critical &gt;{sensor.criticalDepthThreshold}m
        </span>
      </div>
    </div>
  );
}

// ── Single sensor card ────────────────────────────────────────────────────────
function SensorCard({
  sensor,
  onClick,
  onSimulate,
}: {
  sensor: VRSensor;
  onClick: () => void;
  onSimulate: () => void;
}) {
  const sprinklerColor = getSprinklerColor(sensor.sprinklerState);
  const levelColor     = getWaterLevelColor(sensor);
  const unread         = sensor.alerts.filter((a) => !a.acknowledged).length;
  const r              = sensor.currentReading;

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onClick={onClick}
      className="cursor-pointer rounded-xl p-4"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${sprinklerColor}25`,
        boxShadow: `0 0 20px ${sprinklerColor}08`,
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
            >
              {sensor.id}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1"
              style={{ background: `${sprinklerColor}20`, color: sprinklerColor }}
            >
              <SprinklerIcon state={sensor.sprinklerState} size={11} />
              {getSprinklerLabel(sensor.sprinklerState)}
            </span>
            {unread > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: '#ef444422', color: '#ef4444' }}
              >
                {unread} alert{unread > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-white font-semibold text-sm mt-1 truncate">{sensor.farmerName}</p>
          <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {sensor.location}
          </p>
        </div>
        <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
      </div>

      {/* Depth gauge */}
      <div className="mb-3">
        <DepthGauge sensor={sensor} />
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-xs font-bold" style={{ color: '#38bdf8' }}>
            {r.soilMoisture}%
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Moisture</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-bold" style={{ color: levelColor }}>
            {getWaterLevelLabel(sensor)}
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Water Level</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-bold" style={{ color: '#a78bfa' }}>
            {r.temperature}°C
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Temp</p>
        </div>
      </div>

      {/* Crop + signal row */}
      <div className="flex items-center justify-between mt-3 pt-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-xs flex items-center gap-1" style={{ color: '#4ade80' }}>
          <Sprout size={11} /> {sensor.cropType}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onSimulate(); }}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.12)' }}
            title="Open simulator"
          >
            <Sliders size={10} /> Sim
          </button>
          <div className="flex items-center gap-1">
            {r.signalStrength > 50
              ? <Wifi size={11} style={{ color: '#22c55e' }} />
              : <WifiOff size={11} style={{ color: '#f59e0b' }} />}
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {r.signalStrength}%
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Alert notification item ───────────────────────────────────────────────────
function AlertItem({
  alert,
  onAck,
}: {
  alert: FarmerAlert;
  onAck: () => void;
}) {
  const color =
    alert.level === 'critical' ? '#ef4444' :
    alert.level === 'warning'  ? '#f59e0b' : '#22c55e';

  const timeAgo = (() => {
    const diff = Math.floor((Date.now() - new Date(alert.timestamp).getTime()) / 60000);
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ago`;
  })();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: alert.acknowledged ? 0.45 : 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-start gap-3 p-3 rounded-lg mb-2"
      style={{
        background: alert.acknowledged ? 'rgba(255,255,255,0.02)' : `${color}0d`,
        border: `1px solid ${color}${alert.acknowledged ? '10' : '30'}`,
      }}
    >
      <div className="flex-shrink-0 mt-0.5">
        {alert.level === 'critical' ? (
          <AlertTriangle size={14} style={{ color }} />
        ) : alert.level === 'warning' ? (
          <AlertTriangle size={14} style={{ color }} />
        ) : (
          <CheckCircle size={14} style={{ color }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
          {alert.message}
        </p>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{timeAgo}</p>
      </div>
      {!alert.acknowledged && (
        <button
          onClick={onAck}
          className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
          title="Mark as read"
        >
          <Check size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
        </button>
      )}
    </motion.div>
  );
}

// ── Sensor detail modal ───────────────────────────────────────────────────────
function SensorDetailModal({
  sensor,
  onClose,
  onAckAlert,
}: {
  sensor: VRSensor;
  onClose: () => void;
  onAckAlert: (alertId: string) => void;
}) {
  const r              = sensor.currentReading;
  const sprinklerColor = getSprinklerColor(sensor.sprinklerState);
  const levelColor     = getWaterLevelColor(sensor);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const stats: { label: string; value: string | number; unit?: string; color?: string }[] = [
    { label: 'Groundwater Depth', value: r.groundwaterLevel.toFixed(1), unit: 'm', color: levelColor },
    { label: 'Soil Moisture',     value: r.soilMoisture,                unit: '%', color: '#38bdf8' },
    { label: 'Water Flow Rate',   value: r.waterFlowRate.toFixed(1),    unit: 'L/min', color: '#a78bfa' },
    { label: 'Water pH',          value: r.ph.toFixed(1),               color: '#34d399' },
    { label: 'Turbidity',         value: r.turbidity.toFixed(1),        unit: 'NTU', color: '#fb923c' },
    { label: 'Air Temperature',   value: r.temperature.toFixed(1),      unit: '°C', color: '#f472b6' },
    { label: 'Battery',           value: r.batteryLevel,                unit: '%', color: r.batteryLevel > 30 ? '#22c55e' : '#ef4444' },
    { label: 'Signal Strength',   value: r.signalStrength,              unit: '%', color: r.signalStrength > 50 ? '#22c55e' : '#f59e0b' },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-[2000]"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: '#0f172a',
          border: `1px solid ${sprinklerColor}30`,
          width: 'min(580px, 96vw)',
          maxHeight: '88vh',
        }}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono px-2 py-0.5 rounded"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                  {sensor.id}
                </span>
                <span className="text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1"
                  style={{ background: `${sprinklerColor}20`, color: sprinklerColor }}>
                  <SprinklerIcon state={sensor.sprinklerState} size={11} />
                  {getSprinklerLabel(sensor.sprinklerState)}
                </span>
              </div>
              <h2 className="text-white font-bold text-base">{sensor.farmerName}</h2>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {sensor.location} · {sensor.cropType} · {sensor.fieldAreaHectares} ha
              </p>
            </div>
            <button onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              <XCircle size={18} />
            </button>
          </div>

          {/* Depth gauge */}
          <DepthGauge sensor={sensor} />
        </div>

        {/* Sensor readings grid */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'rgba(255,255,255,0.35)' }}>
            Live Readings
          </p>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {stats.map((s) => (
              <div key={s.label} className="px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
                <p className="text-base font-bold mt-0.5" style={{ color: s.color ?? '#fff' }}>
                  {s.value}<span className="text-xs font-normal ml-0.5">{s.unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Pump status */}
          <div className="flex items-center gap-3 p-3 rounded-xl mb-5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Zap size={16} style={{ color: r.pumpStatus === 'on' ? '#22c55e' : 'rgba(255,255,255,0.3)' }} />
            <div>
              <p className="text-xs font-semibold text-white">Pump Status</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {r.pumpStatus === 'on' ? 'Pump is running — extraction in progress' : 'Pump is off'}
              </p>
            </div>
            <span className="ml-auto text-xs font-bold px-2 py-1 rounded-lg"
              style={{
                background: r.pumpStatus === 'on' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                color: r.pumpStatus === 'on' ? '#22c55e' : 'rgba(255,255,255,0.4)',
              }}>
              {r.pumpStatus.toUpperCase()}
            </span>
          </div>

          {/* Alerts */}
          {sensor.alerts.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'rgba(255,255,255,0.35)' }}>
                Notifications ({sensor.alerts.filter((a) => !a.acknowledged).length} unread)
              </p>
              <AnimatePresence>
                {sensor.alerts.map((alert) => (
                  <AlertItem
                    key={alert.id}
                    alert={alert}
                    onAck={() => onAckAlert(alert.id)}
                  />
                ))}
              </AnimatePresence>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main FarmerDashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function FarmerDashboard() {
  const [sensors, setSensors]               = useState<VRSensor[]>([]);
  const [dbLoading, setDbLoading]           = useState(true);
  const [countdown, setCountdown]           = useState(HOUR_IN_SECONDS);
  const [lastCheckTime, setLastCheckTime]   = useState<string>(new Date().toISOString());
  const [selectedSensor, setSelectedSensor]   = useState<VRSensor | null>(null);
  const [simulatingSensor, setSimulatingSensor] = useState<VRSensor | null>(null);
  const [checkPulse, setCheckPulse]             = useState(false);

  // ── Initial load from Supabase ──────────────────────────────────────────────
  useEffect(() => {
    fetchVRSensors()
      .then(setSensors)
      .catch((err) => console.error('FarmerDashboard: failed to load VR sensors', err))
      .finally(() => setDbLoading(false));
  }, []);

  // ── hourly check — run logic + persist changes to Supabase ──────────────────
  const performCheck = useCallback(() => {
    const now = new Date().toISOString();
    setSensors((prev: VRSensor[]) => {
      const updated = runHourlyCheck(prev);

      // Persist each sensor's new state to Supabase (fire-and-forget)
      updated.forEach((sensor) => {
        updateSprinklerState(sensor.id, sensor.sprinklerState, sensor.lastChecked)
          .catch(console.error);

        // Persist any new unacknowledged alerts that weren't in prev
        const prevSensor  = prev.find((p) => p.id === sensor.id);
        const prevAlertIds = new Set((prevSensor?.alerts ?? []).map((a) => a.id));
        sensor.alerts
          .filter((a) => !prevAlertIds.has(a.id))
          .forEach((a) => insertFarmerAlert(a).catch(console.error));
      });

      return updated;
    });
    setLastCheckTime(now);
    setCountdown(HOUR_IN_SECONDS);
    setCheckPulse(true);
    setTimeout(() => setCheckPulse(false), 1200);
  }, []);

  // ── countdown timer (1-second tick) ─────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((s) => {
        if (s <= 1) { performCheck(); return HOUR_IN_SECONDS; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [performCheck]);

  // Sync selected sensor view when sensors update
  useEffect(() => {
    if (selectedSensor) {
      const updated = sensors.find((s) => s.id === selectedSensor.id);
      if (updated) setSelectedSensor(updated);
    }
  }, [sensors]);

  const handleSimulatePushComplete = useCallback(async (_sensorId: string, _newState: string) => {
    try {
      const refreshed = await fetchVRSensors();
      setSensors(refreshed);
    } catch (err) {
      console.error('FarmerDashboard: failed to refresh sensors after simulate push', err);
    }
  }, []);

  const handleAckAlert = (sensorId: string, alertId: string) => {
    // Optimistic update — then persist to DB
    setSensors((prev: VRSensor[]) => acknowledgeAlert(prev, sensorId, alertId));
    acknowledgeAlertInDB(alertId).catch(console.error);
  };

  // ── derived stats ────────────────────────────────────────────────────────────
  const critical      = sensors.filter((s) => s.sprinklerState === 'blocked').length;
  const active        = sensors.filter((s) => s.sprinklerState === 'active').length;
  const standby       = sensors.filter((s) => s.sprinklerState === 'standby').length;
  const totalUnread   = sensors.reduce(
    (sum, s) => sum + s.alerts.filter((a) => !a.acknowledged).length, 0
  );
  const lastCheckFmt = (() => {
    const d = new Date(lastCheckTime);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  })();

  return (
    <motion.div
      className="absolute inset-0 z-[900] flex flex-col"
      style={{ background: '#0a0f1e', overflow: 'hidden' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* DB loading overlay */}
      {dbLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ background: '#0a0f1e' }}>
          <div className="text-center">
            <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
              style={{ borderColor: '#22c55e', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading sensor data…</p>
          </div>
        </div>
      )}
      {/* ── Top stats bar ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-0 overflow-x-auto flex-shrink-0 px-1"
        style={{ background: 'rgba(15,23,42,0.98)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        {[
          { label: 'VR Sensors', value: sensors.length, color: '#38bdf8' },
          { label: 'Sprinkler Active',  value: active,   color: '#22c55e' },
          { label: 'Blocked (Low)',     value: critical,  color: '#ef4444' },
          { label: 'Standby (Warning)', value: standby,  color: '#f59e0b' },
          { label: 'Unread Alerts',     value: totalUnread, color: totalUnread > 0 ? '#ef4444' : '#94a3b8' },
        ].map((s, i, arr) => (
          <div
            key={s.label}
            className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
            style={{ borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
          >
            <span className="text-lg font-bold tabular-nums" style={{ color: s.color }}>
              {s.value}
            </span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</span>
          </div>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Hourly check controls */}
        <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
          style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
          <motion.div
            animate={checkPulse ? { scale: [1, 1.2, 1], opacity: [1, 0.6, 1] } : {}}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-1.5"
          >
            <Activity size={13} style={{ color: checkPulse ? '#22c55e' : 'rgba(255,255,255,0.4)' }} />
            <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Next check: <span style={{ color: '#38bdf8' }}>{formatCountdown(countdown)}</span>
            </span>
          </motion.div>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Last: {lastCheckFmt}
          </span>
          <button
            onClick={performCheck}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
            style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}
            title="Trigger hourly check now"
          >
            <RefreshCw size={12} />
            Check Now
          </button>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: sensor cards grid */}
        <div className="flex-1 overflow-y-auto p-4" style={{ minWidth: 0 }}>
          {/* Section header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-bold text-base">VR Field Sensors</h2>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                5 IoT groundwater sensors · Checked every hour
              </p>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400 font-medium">LIVE</span>
            </div>
          </div>

          {/* Sensor grid */}
          <div className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {sensors.map((sensor) => (
              <SensorCard
                key={sensor.id}
                sensor={sensor}
                onClick={() => setSelectedSensor(sensor)}
                onSimulate={() => setSimulatingSensor(sensor)}
              />
            ))}
          </div>

          {/* How it works legend */}
          <div className="mt-5 p-4 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: 'rgba(255,255,255,0.3)' }}>
              Sprinkler Decision Logic (Hourly)
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { color: '#ef4444', icon: '🚫', title: 'Blocked (Low Water)', desc: 'Depth > 12 m — aquifer depleted. Sprinkler OFF. Farmer alerted via notification.' },
                { color: '#f59e0b', icon: '⏸',  title: 'Standby (Warning)',   desc: 'Depth 8–12 m — borderline zone. Sprinkler paused. Monitor closely.' },
                { color: '#22c55e', icon: '💧',  title: 'Active (Safe)',       desc: 'Depth < 8 m — water table healthy. Sprinkler ACTIVATED automatically.' },
              ].map((row) => (
                <div key={row.title} className="flex items-start gap-2 p-3 rounded-lg"
                  style={{ background: `${row.color}0d`, border: `1px solid ${row.color}20` }}>
                  <span className="text-base">{row.icon}</span>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: row.color }}>{row.title}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      {row.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Alerts panel */}
        <div
          className="hidden lg:flex flex-col flex-shrink-0 overflow-hidden"
          style={{
            width: 320,
            background: 'rgba(15,23,42,0.9)',
            borderLeft: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2">
              <Bell size={15} style={{ color: totalUnread > 0 ? '#ef4444' : 'rgba(255,255,255,0.4)' }} />
              <span className="text-sm font-semibold text-white">Farmer Alerts</span>
              {totalUnread > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: '#ef444420', color: '#ef4444' }}>
                  {totalUnread}
                </span>
              )}
            </div>
            {totalUnread > 0 && (
              <button
                onClick={() =>
                  sensors.forEach((s) =>
                    s.alerts
                      .filter((a) => !a.acknowledged)
                      .forEach((a) => handleAckAlert(s.id, a.id))
                  )
                }
                className="text-xs hover:opacity-80 transition-opacity"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {sensors.every((s) => s.alerts.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <BellOff size={32} style={{ color: 'rgba(255,255,255,0.15)' }} className="mb-3" />
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>No alerts yet</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  Alerts appear here when water levels drop
                </p>
              </div>
            ) : (
              sensors
                .filter((s) => s.alerts.length > 0)
                .flatMap((s) =>
                  s.alerts.map((a) => ({
                    ...a,
                    sensorId: s.id,
                  }))
                )
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, 20)
                .map((alert) => (
                  <AlertItem
                    key={alert.id}
                    alert={alert}
                    onAck={() => handleAckAlert(alert.sensorId, alert.id)}
                  />
                ))
            )}
          </div>

          {/* Sensor health footer */}
          <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs uppercase tracking-wider mb-2 px-1 pt-2"
              style={{ color: 'rgba(255,255,255,0.25)' }}>
              Sensor Health
            </p>
            {sensors.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-1.5 px-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: s.currentReading.signalStrength > 50 ? '#22c55e' : '#f59e0b' }}
                  />
                  <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {s.id}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    🔋 {s.currentReading.batteryLevel}%
                  </span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    📶 {s.currentReading.signalStrength}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sensor detail modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {simulatingSensor && (
          <SensorSimulator
            key={`sim-${simulatingSensor.id}`}
            sensor={simulatingSensor}
            onClose={() => setSimulatingSensor(null)}
            onPushComplete={handleSimulatePushComplete}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedSensor && (
          <SensorDetailModal
            sensor={selectedSensor}
            onClose={() => setSelectedSensor(null)}
            onAckAlert={(alertId) => handleAckAlert(selectedSensor.id, alertId)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
