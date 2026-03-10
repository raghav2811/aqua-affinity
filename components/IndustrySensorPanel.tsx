'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, CheckCircle, Clock, Droplets, Activity, CloudRain, TrendingUp } from 'lucide-react';
import { IndustrySensor } from '@/types';
import { calculateFine, formatLitres, formatINR, getStatusColor, getStatusLabel } from '@/lib/fineCalculation';
import ExtractionChart from './ExtractionChart';
import RainfallChart from './RainfallChart';

type Tab = 'overview' | 'extraction' | 'rainfall';

interface Props {
  sensor: IndustrySensor | null;
  onClose: () => void;
}

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Activity size={14} /> },
  { id: 'extraction', label: 'Daily Chart', icon: <TrendingUp size={14} /> },
  { id: 'rainfall', label: 'Rainfall', icon: <CloudRain size={14} /> },
];

export default function IndustrySensorPanel({ sensor, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <AnimatePresence>
      {sensor && (
        <>
          {/* Backdrop (mobile) */}
          <motion.div
            key="backdrop"
            className="absolute inset-0 md:hidden"
            style={{ background: 'rgba(0,0,0,0.5)', zIndex: 400 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Main Panel */}
          <motion.div
            key="panel"
            className="absolute top-0 right-0 h-full flex flex-col overflow-hidden"
            style={{
              width: 'min(440px, 100%)',
              zIndex: 500,
              background: '#0f172a',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
            }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          >
            <PanelContent
              sensor={sensor}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onClose={onClose}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function PanelContent({
  sensor,
  activeTab,
  setActiveTab,
  onClose,
}: {
  sensor: IndustrySensor;
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  onClose: () => void;
}) {
  const fine = calculateFine(sensor);
  const statusColor = getStatusColor(fine.status);
  const statusLabel = getStatusLabel(fine.status);
  const limitPct = Math.min((sensor.todayExtraction / fine.dailyLimit) * 100, 150);
  const industryLabel = sensor.industryType === 'small_micro' ? 'Small / Micro Industry' : 'Water Intensive Industry';

  return (
    <>
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-5 pb-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono px-2 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}>
                {sensor.id}
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-medium"
                style={{ background: `${statusColor}20`, color: statusColor }}>
                {statusLabel}
              </span>
            </div>
            <h2 className="text-white font-bold text-base leading-tight truncate">{sensor.industryName}</h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{sensor.location}</p>
          </div>
          <button onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.5)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Industry type & NOC row */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs px-2 py-1 rounded-lg"
            style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}>
            {industryLabel}
          </span>
          <span className="text-xs px-2 py-1 rounded-lg flex items-center gap-1"
            style={sensor.hasNOC
              ? { background: 'rgba(34,197,94,0.12)', color: '#22c55e' }
              : { background: 'rgba(239,68,68,0.12)', color: '#ef4444' }
            }>
            {sensor.hasNOC ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
            {sensor.hasNOC ? 'NOC Registered' : 'NOC Not Registered'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-0.5 px-5 pt-3 pb-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-3 pb-2.5 pt-1 text-xs font-medium transition-colors relative"
            style={{ color: activeTab === tab.id ? '#38bdf8' : 'rgba(255,255,255,0.45)' }}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ background: '#38bdf8' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-5"
          >
            {activeTab === 'overview' && (
              <OverviewTab sensor={sensor} fine={fine} statusColor={statusColor} limitPct={limitPct} />
            )}
            {activeTab === 'extraction' && (
              <ExtractionTab sensor={sensor} fine={fine} />
            )}
            {activeTab === 'rainfall' && (
              <RainfallTab sensor={sensor} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}

function OverviewTab({ sensor, fine, statusColor, limitPct }: {
  sensor: IndustrySensor;
  fine: ReturnType<typeof calculateFine>;
  statusColor: string;
  limitPct: number;
}) {
  return (
    <div className="space-y-4">
      {/* Fine Alert */}
      {(fine.status === 'critical' || fine.status === 'no_noc') && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl p-4"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-400" />
            <span className="text-red-400 font-bold text-sm">Fine Alert</span>
          </div>
          {fine.status === 'no_noc' ? (
            <div>
              <p className="text-xs text-red-300 mb-1">No NOC — Illegal Extraction Penalty</p>
              <p className="text-red-400 font-bold text-xl">{formatINR(fine.nocAnnualFine ?? 0)}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Per year · {fine.nocFineCategory}</p>
              {fine.daysExceeded > 0 && (
                <p className="text-red-300 text-xs mt-1">
                  + Additional ₹{fine.finePerDay.toLocaleString('en-IN')}/day for limit violations
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs text-red-300 mb-1">Limit exceeded on {fine.daysExceeded} days (last 30d)</p>
              <p className="text-red-400 font-bold text-xl">{formatINR(fine.totalFine30Days)}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                ₹{fine.finePerDay.toLocaleString('en-IN')}/day × {fine.daysExceeded} days
              </p>
            </div>
          )}
        </motion.div>
      )}

      {fine.status === 'warning' && (
        <div className="rounded-xl p-3 flex items-center gap-3"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <Clock size={15} className="text-amber-400 flex-shrink-0" />
          <p className="text-amber-400 text-xs">
            Extraction at {((sensor.todayExtraction / fine.dailyLimit) * 100).toFixed(0)}% of daily limit. Approaching threshold.
          </p>
        </div>
      )}

      {/* Today's extraction bar */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>Today's Extraction</span>
          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Limit: {formatLitres(fine.dailyLimit)}
          </span>
        </div>
        <p className="text-2xl font-bold mb-3" style={{ color: statusColor }}>
          {formatLitres(sensor.todayExtraction)}
        </p>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: statusColor }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(limitPct, 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          />
        </div>
        <p className="text-xs mt-1.5 text-right" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {limitPct.toFixed(0)}% of limit
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={<Droplets size={16} className="text-blue-400" />}
          label="Groundwater Level"
          value={`${sensor.groundwaterLevel} m`}
          sub="Below ground surface"
          color="#60a5fa"
        />
        <MetricCard
          icon={<Activity size={16} className="text-emerald-400" />}
          label="Soil Moisture"
          value={`${sensor.moisturePercentage}%`}
          sub="Average field capacity"
          color="#34d399"
        />
      </div>

      {/* 30-day summary */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <h3 className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
          30-Day Summary
        </h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Avg Daily', value: formatLitres(Math.round(sensor.dailyExtractions.reduce((s: number, d: { liters: number }) => s + d.liters, 0) / sensor.dailyExtractions.length)) },
            { label: 'Peak Day', value: formatLitres(Math.max(...sensor.dailyExtractions.map((d: { liters: number }) => d.liters))) },
            { label: 'Violations', value: String(fine.daysExceeded) + ' days' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
              <p className="text-sm font-bold text-white mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Coordinates */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
          📍 {sensor.lat.toFixed(4)}°N, {sensor.lng.toFixed(4)}°E
        </span>
      </div>
    </div>
  );
}

function ExtractionTab({ sensor, fine }: {
  sensor: IndustrySensor;
  fine: ReturnType<typeof calculateFine>;
}) {
  const recentViolations = fine.exceedanceDays.slice(-5);
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">Daily Extraction — Last 14 Days</h3>
        <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Red bars indicate days exceeding the {formatLitres(fine.dailyLimit)}/day limit
        </p>
        <ExtractionChart extractions={sensor.dailyExtractions} dailyLimit={fine.dailyLimit} />
      </div>

      {recentViolations.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-4 py-2.5" style={{ background: 'rgba(239,68,68,0.08)' }}>
            <h4 className="text-xs font-semibold text-red-400">Recent Violations</h4>
          </div>
          {recentViolations.map((v: any) => (
            <div key={v.date} className="flex items-center justify-between px-4 py-2.5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>{v.date}</span>
              <span className="text-xs text-red-400">{formatLitres(v.liters)}</span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>+{formatLitres(v.excess)}</span>
              <span className="text-xs font-medium text-red-400">{formatINR(v.fine)}</span>
            </div>
          ))}
        </div>
      )}

      {fine.daysExceeded === 0 && (
        <div className="rounded-xl p-4 text-center"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <CheckCircle size={20} className="text-green-400 mx-auto mb-2" />
          <p className="text-green-400 text-sm font-medium">No violations in last 30 days</p>
        </div>
      )}
    </div>
  );
}

function RainfallTab({ sensor }: { sensor: IndustrySensor }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">7-Day Rainfall Forecast</h3>
        <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Predicted rainfall and probability for the region
        </p>
        <RainfallChart forecast={sensor.rainfallForecast} />
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-4 py-2.5" style={{ background: 'rgba(56,189,248,0.08)' }}>
          <h4 className="text-xs font-semibold text-sky-400">Forecast Details</h4>
        </div>
        {sensor.rainfallForecast.map((f) => (
          <div key={f.date} className="flex items-center justify-between px-4 py-2.5"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>{f.date}</span>
            <div className="flex items-center gap-1">
              <span className="text-sky-400 text-xs font-medium">{f.mm} mm</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full" style={{ width: `${f.probability}%`, background: '#a78bfa' }} />
              </div>
              <span className="text-xs" style={{ color: 'rgba(167,139,250,0.8)' }}>{f.probability}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="rounded-xl p-3.5"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
      </div>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{sub}</p>
    </div>
  );
}
