'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff, Droplets, Sprout, CheckCircle, AlertTriangle,
  XCircle, Clock, Zap, RefreshCw, Wifi, WifiOff, Thermometer,
  Activity, ChevronRight, Check, Sliders, TrendingDown, TrendingUp, ShieldAlert,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import SensorSimulator from './SensorSimulator';
import { VRSensor, FarmerAlert, SprinklerState } from '@/types';
import {
  fetchVRSensors, acknowledgeAlertInDB,
  updateSprinklerState, insertFarmerAlert,
} from '@/lib/supabaseQueries';
import { vrSensors as staticVRSensors } from '@/lib/farmerSensors';
import {
  runHourlyCheck, acknowledgeAlert,
  getSprinklerColor, getSprinklerLabel,
  getWaterLevelLabel, getWaterLevelColor,
  formatCountdown, evaluateWaterLevel,
} from '@/lib/sensorMonitor';
import type { FarmerAlertEmailData } from '@/lib/emailTemplates';

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
  const level    = sensor.currentReading?.groundwaterLevel ?? 0;
  const maxDepth = 20;
  const fillPct  = Math.min((level / maxDepth) * 100, 100);
  const color    = getWaterLevelColor(sensor);

  return (
    <div style={{ width: '100%' }}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs" style={{ color: '#94a3b8' }}>0 m</span>
        <span className="text-xs font-bold" style={{ color }}>
          {level.toFixed(1)} m
        </span>
        <span className="text-xs" style={{ color: '#94a3b8' }}>20 m</span>
      </div>
      <div
        className="relative w-full rounded-full overflow-hidden"
        style={{ height: 8, background: '#e0f2fe' }}
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

// ── Small metric cell helper ─────────────────────────────────────────────────
function MetricCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="px-2.5 py-2 rounded-lg" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
      <p className="text-xs" style={{ color: '#94a3b8' }}>{label}</p>
      <p className="text-sm font-bold mt-0.5 truncate" style={{ color }}>{value}</p>
    </div>
  );
}

// ── Single sensor card ────────────────────────────────────────────────────────
function SensorCard({
  sensor,
  onClick,
  onSimulate,
  expanded = false,
}: {
  sensor: VRSensor;
  onClick: () => void;
  onSimulate: () => void;
  expanded?: boolean;
}) {
  const sprinklerColor = getSprinklerColor(sensor.sprinklerState);
  const levelColor     = getWaterLevelColor(sensor);
  const unread         = sensor.alerts.filter((a) => !a.acknowledged).length;
  const r              = sensor.currentReading;
  if (!r) return null;

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onClick={onClick}
      className="cursor-pointer rounded-xl p-4"
      style={{
        background: 'rgba(15,23,42,0.04)',
        border: `1px solid ${sprinklerColor}22`,
        boxShadow: `0 0 20px ${sprinklerColor}06`,
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
            style={{ background: '#f0f9ff', color: '#64748b', border: '1px solid #e0f2fe' }}
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
          <p className="font-semibold text-sm mt-1 truncate" style={{ color: '#0c4a6e' }}>{sensor.farmerName}</p>
          <p className="text-xs truncate" style={{ color: '#64748b' }}>
            {sensor.location}
          </p>
        </div>
        <ChevronRight size={16} style={{ color: '#cbd5e1', flexShrink: 0 }} />
      </div>

      {/* Depth gauge */}
      <div className="mb-3">
        <DepthGauge sensor={sensor} />
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-xs font-bold" style={{ color: '#0284c7' }}>
            {r.soilMoisture}%
          </p>
          <p className="text-xs" style={{ color: '#94a3b8' }}>Moisture</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-bold" style={{ color: levelColor }}>
            {getWaterLevelLabel(sensor)}
          </p>
          <p className="text-xs" style={{ color: '#94a3b8' }}>Water Level</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-bold" style={{ color: '#a78bfa' }}>
            {r.temperature}°C
          </p>
          <p className="text-xs" style={{ color: '#94a3b8' }}>Temp</p>
        </div>
      </div>

      {/* Crop + signal row */}
      <div className="flex items-center justify-between mt-3 pt-3"
        style={{ borderTop: '1px solid #e0f2fe' }}>
        <span className="text-xs flex items-center gap-1" style={{ color: '#4ade80' }}>
          <Sprout size={11} /> {sensor.cropType}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onSimulate(); }}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors"
            style={{ color: '#64748b', border: '1px solid #e0f2fe', background: '#f8fafc' }}
            title="Open simulator"
          >
            <Sliders size={10} /> Sim
          </button>
          <div className="flex items-center gap-1">
            {r.signalStrength > 50
              ? <Wifi size={11} style={{ color: '#22c55e' }} />
              : <WifiOff size={11} style={{ color: '#f59e0b' }} />}
            <span className="text-xs" style={{ color: '#64748b' }}>
              {r.signalStrength}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Expanded full metrics (individual farmer view) ──────────────────── */}
      {expanded && (
        <>
          {/* Full metrics grid */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #e0f2fe' }}>
            <MetricCell label="Flow Rate" value={`${r.waterFlowRate.toFixed(1)} L/min`} color="#a78bfa" />
            <MetricCell
              label="Pump"
              value={r.pumpStatus === 'on' ? '● ON' : '○ OFF'}
              color={r.pumpStatus === 'on' ? '#22c55e' : '#94a3b8'}
            />
            <MetricCell label="Water pH" value={r.ph.toFixed(1)} color="#34d399" />
            <MetricCell label="Turbidity" value={`${r.turbidity.toFixed(1)} NTU`} color="#fb923c" />
            <MetricCell
              label="Battery"
              value={`${r.batteryLevel}%`}
              color={r.batteryLevel > 30 ? '#22c55e' : '#ef4444'}
            />
            <MetricCell label="Field Area" value={`${sensor.fieldAreaHectares} ha`} color="#38bdf8" />
          </div>

          {/* 24-hour GW depth sparkline */}
          {sensor.hourlyHistory.length > 0 && (() => {
            const sparkData = sensor.hourlyHistory.map(h => ({
              t: h.timestamp.slice(11, 16),
              v: h.groundwaterLevel,
            }));
            return (
              <div className="mt-3">
                <p className="text-xs mb-1.5" style={{ color: '#94a3b8' }}>
                  24 h Groundwater Depth (m)
                </p>
                <ResponsiveContainer width="100%" height={64}>
                  <LineChart data={sparkData} margin={{ top: 2, right: 4, left: -24, bottom: 0 }}>
                    <XAxis dataKey="t" tick={{ fontSize: 8, fill: '#94a3b8' }} interval={5} axisLine={false} tickLine={false} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #0ea5e9', borderRadius: 6, padding: '4px 8px' }}
                      labelStyle={{ color: '#94a3b8', fontSize: 10 }}
                      itemStyle={{ color: '#38bdf8', fontSize: 10 }}
                      formatter={(v) => [`${Number(v).toFixed(2)} m`, 'Depth']}
                    />
                    <Line type="monotone" dataKey="v" stroke="#0ea5e9" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </>
      )}
    </motion.div>
  );
}

// ── Inline full-detail view for a single logged-in farmer ────────────────────
function FarmerInlineView({
  sensor,
  onOpenModal,
  onSimulate,
}: {
  sensor: VRSensor;
  onOpenModal: () => void;
  onSimulate: () => void;
}) {
  const r              = sensor.currentReading;
  const sprinklerColor = getSprinklerColor(sensor.sprinklerState);
  const levelColor     = getWaterLevelColor(sensor);
  const unread         = sensor.alerts.filter((a) => !a.acknowledged).length;

  if (!r) return null;

  const stats: { label: string; value: string | number; unit?: string; color: string }[] = [
    { label: 'Groundwater Depth', value: r.groundwaterLevel.toFixed(1), unit: 'm',     color: levelColor },
    { label: 'Soil Moisture',     value: r.soilMoisture,                unit: '%',     color: '#38bdf8' },
    { label: 'Water Flow Rate',   value: r.waterFlowRate.toFixed(1),    unit: 'L/min', color: '#a78bfa' },
    { label: 'Water pH',          value: r.ph.toFixed(1),                              color: '#34d399' },
    { label: 'Turbidity',         value: r.turbidity.toFixed(1),        unit: 'NTU',   color: '#fb923c' },
    { label: 'Air Temperature',   value: r.temperature.toFixed(1),      unit: '°C',    color: '#f472b6' },
    { label: 'Battery',           value: r.batteryLevel,                unit: '%',     color: r.batteryLevel > 30 ? '#22c55e' : '#ef4444' },
    { label: 'Signal Strength',   value: r.signalStrength,              unit: '%',     color: r.signalStrength > 50 ? '#22c55e' : '#f59e0b' },
  ];

  return (
    <motion.div
      className="rounded-2xl overflow-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      style={{
        background: '#ffffff',
        border: `1px solid ${sprinklerColor}30`,
        boxShadow: '0 4px 24px rgba(14,165,233,0.09)',
      }}
    >
      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid #e0f2fe' }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-mono px-2 py-0.5 rounded"
                style={{ background: '#f0f9ff', color: '#64748b', border: '1px solid #e0f2fe' }}>
                {sensor.id}
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1"
                style={{ background: `${sprinklerColor}20`, color: sprinklerColor }}>
                <SprinklerIcon state={sensor.sprinklerState} size={11} />
                {getSprinklerLabel(sensor.sprinklerState)}
              </span>
              {unread > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: '#ef444422', color: '#ef4444' }}>
                  {unread} alert{unread > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <h2 className="font-bold text-base" style={{ color: '#0c4a6e' }}>{sensor.farmerName}</h2>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              {sensor.location} · {sensor.cropType} · {sensor.fieldAreaHectares} ha
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onSimulate}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
              style={{ color: '#64748b', border: '1px solid #e0f2fe', background: '#f8fafc' }}
              title="Open simulator"
            >
              <Sliders size={11} /> Sim
            </button>
            <button
              onClick={onOpenModal}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
              style={{ color: '#0284c7', border: '1px solid #bae6fd', background: '#f0f9ff' }}
              title="Open full detail"
            >
              <ChevronRight size={11} /> Detail
            </button>
          </div>
        </div>

        {/* Depth gauge */}
        <DepthGauge sensor={sensor} />
      </div>

      {/* ── Live readings ── */}
      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: '#64748b' }}>
          Live Readings
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {stats.map((s) => (
            <div key={s.label} className="px-3 py-2.5 rounded-xl"
              style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
              <p className="text-xs" style={{ color: '#64748b' }}>{s.label}</p>
              <p className="text-base font-bold mt-0.5" style={{ color: s.color }}>
                {s.value}<span className="text-xs font-normal ml-0.5">{s.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Pump status */}
        <div className="flex items-center gap-3 p-3 rounded-xl mb-4"
          style={{ background: '#f8fafc', border: '1px solid #e0f2fe' }}>
          <Zap size={15} style={{ color: r.pumpStatus === 'on' ? '#22c55e' : '#94a3b8' }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: '#0c4a6e' }}>Pump Status</p>
            <p className="text-xs" style={{ color: '#64748b' }}>
              {r.pumpStatus === 'on' ? 'Pump is running — extraction in progress' : 'Pump is off'}
            </p>
          </div>
          <span className="ml-auto text-xs font-bold px-2 py-1 rounded-lg"
            style={{
              background: r.pumpStatus === 'on' ? 'rgba(34,197,94,0.12)' : '#f0f9ff',
              color:      r.pumpStatus === 'on' ? '#22c55e' : '#94a3b8',
              border:     `1px solid ${r.pumpStatus === 'on' ? 'rgba(34,197,94,0.2)' : '#e0f2fe'}`,
            }}>
            {r.pumpStatus.toUpperCase()}
          </span>
        </div>

        {/* 24-hour sparkline */}
        {sensor.hourlyHistory.length > 1 && (() => {
          const sparkData = sensor.hourlyHistory.map(h => ({
            t: h.timestamp.slice(11, 16),
            v: h.groundwaterLevel,
          }));
          return (
            <div>
              <p className="text-xs mb-1.5" style={{ color: '#94a3b8' }}>
                24 h Groundwater Depth (m)
              </p>
              <ResponsiveContainer width="100%" height={72}>
                <LineChart data={sparkData} margin={{ top: 2, right: 4, left: -24, bottom: 0 }}>
                  <XAxis dataKey="t" tick={{ fontSize: 8, fill: '#94a3b8' }} interval={5} axisLine={false} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #0ea5e9', borderRadius: 6, padding: '4px 8px' }}
                    labelStyle={{ color: '#94a3b8', fontSize: 10 }}
                    itemStyle={{ color: '#38bdf8', fontSize: 10 }}
                    formatter={(v) => [`${Number(v).toFixed(2)} m`, 'Depth']}
                  />
                  <Line type="monotone" dataKey="v" stroke="#0ea5e9" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
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
        background: alert.acknowledged ? '#f8fafc' : `${color}0d`,
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
        <p className="text-xs leading-relaxed" style={{ color: '#334155' }}>
          {alert.message}
        </p>
        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{timeAgo}</p>
      </div>
      {!alert.acknowledged && (
        <button
          onClick={onAck}
          className="flex-shrink-0 p-1 rounded transition-colors"
          title="Mark as read"
        >
          <Check size={12} style={{ color: '#94a3b8' }} />
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

  if (!r) return (
    <motion.div className="absolute inset-0 flex items-center justify-center z-[2000]"
      style={{ background: 'rgba(14,165,233,0.10)', backdropFilter: 'blur(4px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <div className="rounded-2xl p-8 text-center" style={{ background: '#ffffff', border: '1px solid #bae6fd' }}>
        <p style={{ color: '#64748b' }}>No reading available for this sensor yet.</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg text-sm" style={{ background: '#0ea5e9', color: '#fff' }}>Close</button>
      </div>
    </motion.div>
  );

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
        style={{ background: 'rgba(14,165,233,0.10)', backdropFilter: 'blur(4px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: '#ffffff',
          border: `1px solid ${sprinklerColor}30`,
          width: 'min(580px, 96vw)',
          maxHeight: '88vh',
          boxShadow: '0 20px 60px rgba(14,165,233,0.15)',
        }}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid #e0f2fe' }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono px-2 py-0.5 rounded"
                  style={{ background: '#f0f9ff', color: '#64748b', border: '1px solid #e0f2fe' }}>
                  {sensor.id}
                </span>
                <span className="text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1"
                  style={{ background: `${sprinklerColor}20`, color: sprinklerColor }}>
                  <SprinklerIcon state={sensor.sprinklerState} size={11} />
                  {getSprinklerLabel(sensor.sprinklerState)}
                </span>
              </div>
              <h2 className="font-bold text-base" style={{ color: '#0c4a6e' }}>{sensor.farmerName}</h2>
              <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                {sensor.location} · {sensor.cropType} · {sensor.fieldAreaHectares} ha
              </p>
            </div>
            <button onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: '#94a3b8', background: '#f0f9ff', border: '1px solid #e0f2fe' }}>
              <XCircle size={18} />
            </button>
          </div>

          {/* Depth gauge */}
          <DepthGauge sensor={sensor} />
        </div>

        {/* Sensor readings grid */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: '#64748b' }}>
            Live Readings
          </p>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {stats.map((s) => (
              <div key={s.label} className="px-3 py-2.5 rounded-xl"
                style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                <p className="text-xs" style={{ color: '#64748b' }}>{s.label}</p>
                <p className="text-base font-bold mt-0.5" style={{ color: s.color ?? '#fff' }}>
                  {s.value}<span className="text-xs font-normal ml-0.5">{s.unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Pump status */}
          <div className="flex items-center gap-3 p-3 rounded-xl mb-5"
            style={{ background: '#f8fafc', border: '1px solid #e0f2fe' }}>
            <Zap size={16} style={{ color: r.pumpStatus === 'on' ? '#22c55e' : '#94a3b8' }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: '#0c4a6e' }}>Pump Status</p>
              <p className="text-xs" style={{ color: '#64748b' }}>
                {r.pumpStatus === 'on' ? 'Pump is running — extraction in progress' : 'Pump is off'}
              </p>
            </div>
            <span className="ml-auto text-xs font-bold px-2 py-1 rounded-lg"
              style={{
                background: r.pumpStatus === 'on' ? 'rgba(34,197,94,0.12)' : '#f0f9ff',
                color: r.pumpStatus === 'on' ? '#22c55e' : '#94a3b8',
                border: `1px solid ${r.pumpStatus === 'on' ? 'rgba(34,197,94,0.2)' : '#e0f2fe'}`,
              }}>
              {r.pumpStatus.toUpperCase()}
            </span>
          </div>

          {/* Alerts */}
          {sensor.alerts.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: '#64748b' }}>
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
export default function FarmerDashboard({ userEmail, userName, filterFarmerName }: { userEmail?: string; userName?: string; filterFarmerName?: string }) {
  const [sensors, setSensors]               = useState<VRSensor[]>([]);
  const [dbLoading, setDbLoading]           = useState(true);
  const [countdown, setCountdown]           = useState(HOUR_IN_SECONDS);
  const [lastCheckTime, setLastCheckTime]   = useState<string>(new Date().toISOString());
  const [selectedSensor, setSelectedSensor]   = useState<VRSensor | null>(null);
  const [simulatingSensor, setSimulatingSensor] = useState<VRSensor | null>(null);
  const [checkPulse, setCheckPulse]             = useState(false);

  const [gwlRisk, setGwlRisk] = useState<{
    level: 'safe' | 'warning' | 'critical';
    trend: string;
    trendFtPerDay: number;
    daysUntilCritical: number | null;
    currentDepthM: number;
  } | null>(null);
  const [gwlLoading, setGwlLoading] = useState(true);

  // Refs so performCheck always reads current values without stale closures
  const sensorsRef    = useRef<VRSensor[]>([]);
  const userEmailRef  = useRef<string | undefined>(userEmail);
  useEffect(() => { sensorsRef.current   = sensors;   }, [sensors]);
  useEffect(() => { userEmailRef.current = userEmail; }, [userEmail]);

  // metrics history (last 24 hourly snapshots)
  const [metricsHistory, setMetricsHistory] = useState<{
    captured_at: string;
    avg_groundwater_level_m: number | null;
    total_flow_rate_lpm: number | null;
    sensors_active: number | null;
  }[]>([]);

  // ── Fetch GWL risk on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/gwl-predict')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.risk) setGwlRisk(data.risk); })
      .catch(() => {})
      .finally(() => setGwlLoading(false));
  }, []);

  // ── Fetch metrics history on mount ──────────────────────────────────────────
  useEffect(() => {
    fetch('/api/metrics/snapshot?limit=24')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.snapshots) setMetricsHistory(data.snapshots); })
      .catch(() => {});
  }, []);

  // ── Initial load from Supabase (with static fallback for farmer view) ────────
  useEffect(() => {
    fetchVRSensors()
      .then(all => {
        // Case-insensitive trim match so old/differently-cased session names still work
        const filterKey = filterFarmerName?.trim().toLowerCase();
        const filtered = filterKey
          ? all.filter(s => s.farmerName?.trim().toLowerCase() === filterKey)
          : all;

        // For a logged-in farmer: if DB returned no sensors OR sensors have no readings,
        // fill in from the matching static sensor so the farmer always sees their data.
        const resolved = filtered.map(s => {
          if (s.currentReading) return s;
          // Try to borrow currentReading + hourlyHistory from static data
          const staticMatch = staticVRSensors.find(
            st => st.id === s.id ||
                  st.farmerName?.trim().toLowerCase() === s.farmerName?.trim().toLowerCase()
          );
          return {
            ...s,
            currentReading:  staticMatch?.currentReading  ?? s.hourlyHistory[0] ?? null,
            hourlyHistory:   s.hourlyHistory.length > 0   ? s.hourlyHistory : (staticMatch?.hourlyHistory ?? []),
            alerts:          s.alerts.length > 0          ? s.alerts        : (staticMatch?.alerts        ?? []),
          };
        });

        // If still no sensors for this farmer (e.g. DB seed not yet run), use static data
        if (resolved.length === 0 && filterKey) {
          const staticFiltered = staticVRSensors.filter(
            s => s.farmerName?.trim().toLowerCase() === filterKey
          );
          setSensors(staticFiltered);
        } else {
          setSensors(resolved);
        }
      })
      .catch((err) => {
        console.error('FarmerDashboard: failed to load VR sensors', err);
        // On fetch error for a farmer, fall back to static data completely
        if (filterFarmerName) {
          const key = filterFarmerName.trim().toLowerCase();
          setSensors(staticVRSensors.filter(s => s.farmerName?.trim().toLowerCase() === key));
        }
      })
      .finally(() => setDbLoading(false));
  }, [filterFarmerName]);

  // ── hourly check — run logic + persist changes to Supabase ──────────────────
  const performCheck = useCallback(() => {
    // Read current sensors from ref — avoids stale closure without needing deps
    const prev = sensorsRef.current;
    const now  = new Date().toISOString();
    const updated = runHourlyCheck(prev);

    // Update state with the computed value (NOT a functional updater —
    // so we can safely run all side effects below without React calling
    // the function multiple times in Strict Mode)
    setSensors(updated);

    // ── Side effects — all OUTSIDE setState ────────────────────────────────────
    updated.forEach((sensor) => {
      updateSprinklerState(sensor.id, sensor.sprinklerState, sensor.lastChecked)
        .catch(console.error);

      const prevSensor   = prev.find((p) => p.id === sensor.id);
      const prevAlertIds = new Set((prevSensor?.alerts ?? []).map((a) => a.id));
      const newAlerts    = sensor.alerts.filter((a) => !prevAlertIds.has(a.id));

      newAlerts.forEach((a) => {
        insertFarmerAlert(a).catch(console.error);

        // Send email for warning / critical alerts
        const email = userEmailRef.current;
        if (email && (a.level === 'warning' || a.level === 'critical')) {
          const emailData: FarmerAlertEmailData = {
            farmerName:             sensor.farmerName,
            sensorId:               sensor.id,
            sensorName:             sensor.name,
            location:               sensor.location,
            cropType:               sensor.cropType,
            alertLevel:             a.level as 'warning' | 'critical',
            alertMessage:           a.message,
            groundwaterLevel:       sensor.currentReading.groundwaterLevel,
            criticalDepthThreshold: sensor.criticalDepthThreshold,
            sprinklerState:         sensor.sprinklerState,
            timestamp:              a.timestamp,
          };
          fetch('/api/notifications/send-email', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ type: 'farmer_alert', to: email, data: emailData }),
          })
            .then(r => r.json().then(d => { if (!r.ok || d.error) console.error('[email]', d); else console.info('[email] sent to', email, '— id:', d.emailId); }))
            .catch(console.error);
        }
      });
    });

    setLastCheckTime(now);
    setCountdown(HOUR_IN_SECONDS);
    setCheckPulse(true);
    setTimeout(() => setCheckPulse(false), 1200);

    // POST metrics snapshot using `updated` directly (no second setSensors)
    const gwLevels = updated.map(s => s.currentReading?.groundwaterLevel ?? 0).filter(v => v > 0);
    const body = {
      totalSensors:           updated.length,
      sensorsActive:          updated.filter(s => s.sprinklerState === 'active').length,
      sensorsBlocked:         updated.filter(s => s.sprinklerState === 'blocked').length,
      sensorsStandby:         updated.filter(s => s.sprinklerState === 'standby').length,
      avgGroundwaterLevelM:   gwLevels.length ? +(gwLevels.reduce((a,b)=>a+b,0)/gwLevels.length).toFixed(2) : null,
      minGroundwaterLevelM:   gwLevels.length ? +Math.min(...gwLevels).toFixed(2) : null,
      maxGroundwaterLevelM:   gwLevels.length ? +Math.max(...gwLevels).toFixed(2) : null,
      totalFlowRateLpm:       +updated.reduce((s,x) => s+(x.currentReading?.waterFlowRate??0),0).toFixed(2),
      estDailyUsageLiters:    +updated.reduce((s,x) => s+(x.currentReading?.waterFlowRate??0),0)*60*24,
      avgSoilMoisturePct:     +(updated.reduce((s,x) => s+(x.currentReading?.soilMoisture??0),0)/Math.max(updated.length,1)).toFixed(1),
      avgTemperatureC:        +(updated.reduce((s,x) => s+(x.currentReading?.temperature??0),0)/Math.max(updated.length,1)).toFixed(1),
      sensorsPumpOn:          updated.filter(s => s.sprinklerState === 'active').length,
      totalAlertsUnread:      updated.reduce((s,x) => s+x.alerts.filter(a => !a.acknowledged).length, 0),
    };
    fetch('/api/metrics/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.snapshot) {
          setMetricsHistory(prev => [...prev.slice(-23), data.snapshot]);
        }
      })
      .catch(() => {});

    // Capture charts (pure canvas, no DOM)
    setTimeout(() => captureAndUploadCharts(updated), 600);

    // Hash & log all VR sensor readings to blockchain (fire-and-forget)
    const blockchainReadings = updated.map(s => ({
      sensor_id:         s.id,
      sensor_name:       s.name,
      farmer_name:       s.farmerName,
      location:          s.location,
      crop_type:         s.cropType,
      timestamp:         s.currentReading.timestamp,
      groundwater_level: s.currentReading.groundwaterLevel,
      soil_moisture:     s.currentReading.soilMoisture,
      water_flow_rate:   s.currentReading.waterFlowRate,
      pump_status:       s.currentReading.pumpStatus,
      temperature:       s.currentReading.temperature,
      ph:                s.currentReading.ph,
      turbidity:         s.currentReading.turbidity,
      battery_level:     s.currentReading.batteryLevel,
      signal_strength:   s.currentReading.signalStrength,
      sprinkler_state:   s.sprinklerState,
    }));
    fetch('/api/blockchain/log', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ readings: blockchainReadings }),
    })
      .then(r => r.json())
      .then(d => { if (d.success) console.info(`[blockchain] logged ${d.transactions?.length ?? 0} VR sensor(s)`); else console.warn('[blockchain]', d); })
      .catch(console.error);
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

  // (Farmer inline view is shown directly in the main content — no auto-modal needed)

  const handleSimulatePushComplete = useCallback(async (_sensorId: string, _newState: string) => {
    try {
      const refreshed = await fetchVRSensors();
      const filterKey = filterFarmerName?.trim().toLowerCase();
      const base = filterKey
        ? refreshed.filter(s => s.farmerName?.trim().toLowerCase() === filterKey)
        : refreshed;
      // Apply same static fallback as initial load
      const resolved = base.map(s => {
        if (s.currentReading) return s;
        const staticMatch = staticVRSensors.find(
          st => st.id === s.id || st.farmerName?.trim().toLowerCase() === s.farmerName?.trim().toLowerCase()
        );
        return {
          ...s,
          currentReading: staticMatch?.currentReading  ?? s.hourlyHistory[0] ?? null,
          hourlyHistory:  s.hourlyHistory.length > 0   ? s.hourlyHistory : (staticMatch?.hourlyHistory ?? []),
        };
      });
      setSensors(resolved.length > 0 ? resolved : base);
    } catch (err) {
      console.error('FarmerDashboard: failed to refresh sensors after simulate push', err);
    }
  }, [filterFarmerName]);

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

  // Water usage rate (aggregate across all sensors)
  const totalFlowRate = sensors.reduce(
    (sum, s) => sum + (s.currentReading?.waterFlowRate ?? 0), 0
  );
  const estimatedDailyUsageLiters = totalFlowRate * 60 * 24;   // L/min × 1440 min/day

  const riskColor = gwlRisk?.level === 'critical' ? '#ef4444'
    : gwlRisk?.level === 'warning' ? '#f59e0b'
    : '#22c55e';
  const RiskIcon  = gwlRisk?.level === 'critical' ? ShieldAlert
    : gwlRisk?.level === 'warning' ? AlertTriangle
    : CheckCircle;
  const lastCheckFmt = (() => {
    const d = new Date(lastCheckTime);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  })();

  return (
    <motion.div
      className="absolute inset-0 z-[900] flex flex-col"
      style={{ background: '#f0f9ff', overflow: 'hidden' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* DB loading overlay */}
      {dbLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ background: '#f0f9ff' }}>
          <div className="text-center">
            <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
              style={{ borderColor: '#0ea5e9', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: '#64748b' }}>Loading sensor data…</p>
          </div>
        </div>
      )}
      {/* ── Top stats bar ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-0 overflow-x-auto flex-shrink-0 px-1"
        style={{ background: 'rgba(240,249,255,0.97)', borderBottom: '1px solid #bae6fd' }}
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
            style={{ borderRight: i < arr.length - 1 ? '1px solid #e0f2fe' : 'none' }}
          >
            <span className="text-lg font-bold tabular-nums" style={{ color: s.color }}>
              {s.value}
            </span>
            <span className="text-xs" style={{ color: '#64748b' }}>{s.label}</span>
          </div>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Hourly check controls */}
        <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
          style={{ borderLeft: '1px solid #e0f2fe' }}>
          <motion.div
            animate={checkPulse ? { scale: [1, 1.2, 1], opacity: [1, 0.6, 1] } : {}}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-1.5"
          >
            <Activity size={13} style={{ color: checkPulse ? '#0ea5e9' : '#94a3b8' }} />
            <span className="text-xs font-mono" style={{ color: '#64748b' }}>
              Next check: <span style={{ color: '#38bdf8' }}>{formatCountdown(countdown)}</span>
            </span>
          </motion.div>
          <span className="text-xs" style={{ color: '#94a3b8' }}>
            Last: {lastCheckFmt}
          </span>
          <button
            onClick={performCheck}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
            style={{ background: 'rgba(14,165,233,0.10)', color: '#0284c7', border: '1px solid rgba(14,165,233,0.25)' }}
            title="Trigger hourly check now"
          >
            <RefreshCw size={12} />
            Check Now
          </button>
        </div>
      </div>

      {/* ── Water Usage + Depletion Risk analytics strip ────────────────────── */}
      <div
        className="flex items-stretch gap-0 overflow-x-auto flex-shrink-0"
        style={{ background: '#ffffff', borderBottom: '1px solid #bae6fd' }}
      >
        {/* Water Flow Rate */}
        <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
          style={{ borderRight: '1px solid #e0f2fe' }}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: 'rgba(14,165,233,0.10)' }}>
            <Droplets size={16} style={{ color: '#0ea5e9' }} />
          </div>
          <div>
            <p className="text-xs" style={{ color: '#64748b' }}>Total Water Flow Rate</p>
            <p className="text-lg font-bold tabular-nums leading-tight" style={{ color: '#0c4a6e' }}>
              {totalFlowRate.toFixed(1)}
              <span className="text-xs font-normal ml-1" style={{ color: '#64748b' }}>L/min</span>
            </p>
          </div>
        </div>

        {/* Estimated Daily Usage */}
        <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
          style={{ borderRight: '1px solid #e0f2fe' }}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: 'rgba(56,189,248,0.10)' }}>
            <Activity size={16} style={{ color: '#38bdf8' }} />
          </div>
          <div>
            <p className="text-xs" style={{ color: '#64748b' }}>Est. Daily Usage</p>
            <p className="text-lg font-bold tabular-nums leading-tight" style={{ color: '#0c4a6e' }}>
              {estimatedDailyUsageLiters >= 1000
                ? `${(estimatedDailyUsageLiters / 1000).toFixed(1)} KL`
                : `${Math.round(estimatedDailyUsageLiters)} L`}
            </p>
          </div>
        </div>

        {/* Groundwater Depletion Risk */}
        <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
          style={{ borderRight: '1px solid #e0f2fe' }}>
          {gwlLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: '#0ea5e9', borderTopColor: 'transparent' }} />
              <span className="text-xs" style={{ color: '#94a3b8' }}>Loading risk…</span>
            </div>
          ) : gwlRisk ? (
            <>
              <div className="flex items-center justify-center w-8 h-8 rounded-lg"
                style={{ background: `${riskColor}15` }}>
                <RiskIcon size={16} style={{ color: riskColor }} />
              </div>
              <div>
                <p className="text-xs" style={{ color: '#64748b' }}>GWL Depletion Risk</p>
                <div className="flex items-center gap-2">
                  <p className="text-base font-bold leading-tight capitalize" style={{ color: riskColor }}>
                    {gwlRisk.level}
                  </p>
                  <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                    style={{ background: `${riskColor}15`, color: riskColor }}>
                    {gwlRisk.trend === 'declining' ? '▼ Declining' : '▲ Recovering'}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <span className="text-xs" style={{ color: '#94a3b8' }}>Risk unavailable</span>
          )}
        </div>

        {/* Days Until Critical */}
        {gwlRisk && (
          <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
            style={{ borderRight: '1px solid #e0f2fe' }}>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.08)' }}>
              {gwlRisk.trend === 'declining'
                ? <TrendingDown size={16} style={{ color: '#ef4444' }} />
                : <TrendingUp   size={16} style={{ color: '#22c55e' }} />}
            </div>
            <div>
              <p className="text-xs" style={{ color: '#64748b' }}>
                {gwlRisk.daysUntilCritical !== null ? 'Critical in' : 'Current Depth'}
              </p>
              <p className="text-lg font-bold tabular-nums leading-tight"
                style={{ color: gwlRisk.daysUntilCritical !== null ? '#ef4444' : '#22c55e' }}>
                {gwlRisk.daysUntilCritical !== null
                  ? `${gwlRisk.daysUntilCritical} days`
                  : `${gwlRisk.currentDepthM?.toFixed(1)} m`
                }
              </p>
            </div>
          </div>
        )}

        {/* Trend rate */}
        {gwlRisk && (
          <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0">
            <div>
              <p className="text-xs" style={{ color: '#64748b' }}>Depth Trend</p>
              <p className="text-base font-bold tabular-nums leading-tight"
                style={{ color: gwlRisk.trendFtPerDay > 0 ? '#f59e0b' : '#22c55e' }}>
                {gwlRisk.trendFtPerDay > 0 ? '+' : ''}
                {(gwlRisk.trendFtPerDay * 30.48).toFixed(2)}
                <span className="text-xs font-normal ml-1" style={{ color: '#64748b' }}>cm/day</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: sensor cards grid */}
        <div className="flex-1 overflow-y-auto p-4" style={{ minWidth: 0 }}>
          {/* Section header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-base" style={{ color: '#0c4a6e' }}>VR Field Sensors</h2>
              <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                5 IoT groundwater sensors · Checked every hour
              </p>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-full"
              style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400 font-medium">LIVE</span>
            </div>
          </div>

          {/* Sensor display — inline detail panel for a logged-in farmer,
               compact card grid for admin / multi-sensor view */}
          {filterFarmerName && sensors.length > 0 ? (
            <FarmerInlineView
              sensor={sensors[0]}
              onOpenModal={() => setSelectedSensor(sensors[0])}
              onSimulate={() => setSimulatingSensor(sensors[0])}
            />
          ) : (
            <div className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {sensors.map((sensor) => (
                <SensorCard
                  key={sensor.id}
                  sensor={sensor}
                  onClick={() => setSelectedSensor(sensor)}
                  onSimulate={() => setSimulatingSensor(sensor)}
                  expanded={false}
                />
              ))}
            </div>
          )}

          {/* Metrics History Chart */}
          {metricsHistory.length > 0 && (
            <MetricsHistoryChart data={metricsHistory} />
          )}

          {/* How it works legend */}
          <div className="mt-5 p-4 rounded-xl"
            style={{ background: '#f8fafc', border: '1px solid #e0f2fe' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: '#64748b' }}>
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
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#64748b' }}>
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
            background: 'rgba(240,249,255,0.97)',
            borderLeft: '1px solid #bae6fd',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid #e0f2fe' }}>
            <div className="flex items-center gap-2">
              <Bell size={15} style={{ color: totalUnread > 0 ? '#ef4444' : '#94a3b8' }} />
              <span className="text-sm font-semibold" style={{ color: '#0c4a6e' }}>Farmer Alerts</span>
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
                style={{ color: '#64748b' }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {sensors.every((s) => s.alerts.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <BellOff size={32} style={{ color: '#cbd5e1' }} className="mb-3" />
                <p className="text-sm" style={{ color: '#64748b' }}>No alerts yet</p>
                <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
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
          <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid #e0f2fe' }}>
            <p className="text-xs uppercase tracking-wider mb-2 px-1 pt-2"
              style={{ color: '#64748b' }}>
              Sensor Health
            </p>
            {sensors.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-1.5 px-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: s.currentReading.signalStrength > 50 ? '#22c55e' : '#f59e0b' }}
                  />
                  <span className="text-xs font-mono" style={{ color: '#64748b' }}>
                    {s.id}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: '#94a3b8' }}>
                    🔋 {s.currentReading.batteryLevel}%
                  </span>
                  <span className="text-xs" style={{ color: '#94a3b8' }}>
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

// ─────────────────────────────────────────────────────────────────────────────
//  Pure-canvas chart generator — no DOM capture, works reliably every time.
//  Draws 4 metric lines (GW Depth · Flow Rate · Soil Moisture · Temperature)
//  over 24 h history for one VR sensor. Returns a base-64 JPEG string.
// ─────────────────────────────────────────────────────────────────────────────
function generateSensorChartJpeg(sensor: VRSensor): string | null {
  if (typeof window === 'undefined') return null;

  const W = 800, H = 440;
  const PAD = { top: 60, right: 28, bottom: 64, left: 58 };
  const CW = W - PAD.left - PAD.right;
  const CH = H - PAD.top - PAD.bottom;

  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const history = sensor.hourlyHistory.slice(-24);
  const n = history.length;
  if (n < 2) return null;

  const SERIES: { label: string; color: string; unit: string; values: number[] }[] = [
    { label: 'GW Depth',       color: '#38bdf8', unit: 'm',     values: history.map(r => r.groundwaterLevel) },
    { label: 'Flow Rate',      color: '#f59e0b', unit: 'L/min', values: history.map(r => r.waterFlowRate)    },
    { label: 'Soil Moisture',  color: '#22c55e', unit: '%',     values: history.map(r => r.soilMoisture)     },
    { label: 'Temperature',    color: '#f87171', unit: '\u00b0C',    values: history.map(r => r.temperature)      },
  ];

  // Normalise each series independently to the chart height
  const ranges = SERIES.map(s => {
    const min = Math.min(...s.values);
    const max = Math.max(...s.values);
    return { min, span: (max - min) || 1 };
  });

  const xOf  = (i: number) => PAD.left + (i / (n - 1)) * CW;
  const yOf  = (v: number, si: number) =>
    PAD.top + CH - ((v - ranges[si].min) / ranges[si].span) * CH;

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f0f9ff';
  ctx.fillRect(PAD.left, PAD.top, CW, CH);

  // ── Grid lines ──────────────────────────────────────────────────────────────
  ctx.strokeStyle = '#e0f2fe';
  ctx.lineWidth = 1;
  for (let g = 0; g <= 5; g++) {
    const gY = PAD.top + (g / 5) * CH;
    ctx.beginPath(); ctx.moveTo(PAD.left, gY); ctx.lineTo(PAD.left + CW, gY); ctx.stroke();
  }
  for (let g = 0; g <= 6; g++) {
    const gX = PAD.left + (g / 6) * CW;
    ctx.beginPath(); ctx.moveTo(gX, PAD.top); ctx.lineTo(gX, PAD.top + CH); ctx.stroke();
  }

  // ── Data lines ──────────────────────────────────────────────────────────────
  SERIES.forEach((s, si) => {
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.beginPath();
    s.values.forEach((v, i) => {
      const x = xOf(i), y = yOf(v, si);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    // dots
    s.values.forEach((v, i) => {
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(xOf(i), yOf(v, si), 3, 0, Math.PI * 2);
      ctx.fill();
    });
    // latest value label at right end
    const last = s.values[s.values.length - 1];
    ctx.fillStyle = s.color;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${last.toFixed(1)} ${s.unit}`, PAD.left + CW + 4, yOf(last, si) + 4);
    ctx.restore();
  });

  // ── Axes ────────────────────────────────────────────────────────────────────
  ctx.strokeStyle = '#bae6fd';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top);
  ctx.lineTo(PAD.left, PAD.top + CH);
  ctx.lineTo(PAD.left + CW, PAD.top + CH);
  ctx.stroke();

  // X axis time labels
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  const labelStep = Math.max(1, Math.floor(n / 7));
  for (let i = 0; i < n; i += labelStep) {
    const label = history[i].timestamp
      ? new Date(history[i].timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : `-${n - 1 - i}h`;
    ctx.fillText(label, xOf(i), PAD.top + CH + 16);
  }

  // ── Title ───────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#0c4a6e';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${sensor.id}  ·  ${sensor.location}  —  24 h Sensor Metrics`, PAD.left, 36);

  // Generated-at timestamp
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`Generated: ${new Date().toLocaleString('en-IN')}`, W - PAD.right, 18);

  // ── Legend (bottom) ─────────────────────────────────────────────────────────
  let lx = PAD.left;
  const legendY = H - 20;
  SERIES.forEach(s => {
    ctx.fillStyle = s.color;
    ctx.fillRect(lx, legendY - 6, 18, 4);
    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    const txt = `${s.label} (${s.unit})`;
    ctx.fillText(txt, lx + 22, legendY);
    lx += ctx.measureText(txt).width + 42;
  });

  return canvas.toDataURL('image/jpeg', 0.92);
}

function captureAndUploadCharts(sensors: VRSensor[]) {
  sensors.forEach((sensor) => {
    const imageBase64 = generateSensorChartJpeg(sensor);
    if (!imageBase64) return;
    fetch('/api/metrics/chart-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sensorId: sensor.id, imageBase64 }),
    }).catch(() => {});
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Metrics History Chart (last 24 hourly snapshots)
// ─────────────────────────────────────────────────────────────────────────────
function MetricsHistoryChart({ data }: {
  data: { captured_at: string; avg_groundwater_level_m: number | null; total_flow_rate_lpm: number | null; sensors_active: number | null }[];
}) {
  const chartData = data.map((row) => ({
    time: new Date(row.captured_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    gwLevel:    row.avg_groundwater_level_m ?? undefined,
    flowRate:   row.total_flow_rate_lpm     ?? undefined,
    active:     row.sensors_active          ?? undefined,
  }));

  return (
    <div className="mt-5 p-4 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e0f2fe' }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#64748b' }}>
        Hourly Metrics History (last {data.length} snapshots)
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: '#fff', border: '1px solid #bae6fd', borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: '#64748b' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
          <Line type="monotone" dataKey="gwLevel"  name="Avg GW Depth (m)"  stroke="#38bdf8" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="flowRate" name="Flow Rate (L/min)" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="active"   name="Active Sensors"    stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
