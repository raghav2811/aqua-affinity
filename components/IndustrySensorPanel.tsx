'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, CheckCircle, Clock, Droplets, Activity, CloudRain, TrendingUp, BarChart2 } from 'lucide-react';
import GroundwaterForecastChart from './GroundwaterForecastChart';
import { IndustrySensor } from '@/types';
import { calculateFine, formatLitres, formatINR, getStatusColor, getStatusLabel } from '@/lib/fineCalculation';
import type { IndustryFineEmailData } from '@/lib/emailTemplates';
import ExtractionChart from './ExtractionChart';
import RainfallChart from './RainfallChart';

type Tab = 'overview' | 'extraction' | 'rainfall' | 'forecast';

interface Props {
  sensor: IndustrySensor | null;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
}

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',  label: 'Overview',    icon: <Activity   size={14} /> },
  { id: 'extraction',label: 'Daily Chart', icon: <TrendingUp size={14} /> },
  { id: 'rainfall',  label: 'Rainfall',    icon: <CloudRain  size={14} /> },
  { id: 'forecast',  label: 'ML Forecast', icon: <BarChart2  size={14} /> },
];

const GEO_LAYERS: {
  key: string; label: string; from: number; to: number;
  grad: [string, string]; metric: string; getValue: (s: IndustrySensor) => string;
}[] = [
  { key:'L1', label:'L1 — Topsoil',    from:0,    to:0.32, grad:['#8B6914','#A07830'], metric:'Soil Moisture',  getValue:(s)=>`${s.moisturePercentage}%` },
  { key:'L2', label:'L2 — Subsoil',    from:0.32, to:0.59, grad:['#7A5E34','#614A26'], metric:'Compaction',     getValue:()=>'Medium' },
  { key:'L3', label:'L3 — Deep Clay',  from:0.59, to:0.83, grad:['#4a3a1e','#3a2a10'], metric:'Permeability',   getValue:()=>'Low' },
  { key:'L4', label:'L4 — Transition', from:0.83, to:1,    grad:['#2a3838','#1e2e2e'], metric:'Saturation',     getValue:(s)=>`${Math.min(35,Math.round(s.moisturePercentage*1.4))}%` },
];

export default function IndustrySensorPanel({ sensor, onClose, userEmail, userName }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Send a fine/violation email once per unique sensor open (not on every re-render)
  const notifiedSensorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!sensor || !userEmail) return;
    if (notifiedSensorRef.current === sensor.id) return; // already notified for this sensor

    const fine = calculateFine(sensor);
    if (fine.status !== 'critical' && fine.status !== 'no_noc' && fine.status !== 'warning') return;

    notifiedSensorRef.current = sensor.id;

    const emailData: IndustryFineEmailData = {
      recipientName:  userName ?? 'Industry Official',
      industryName:   sensor.industryName,
      sensorId:       sensor.id,
      location:       sensor.location,
      industryType:   sensor.industryType,
      violationType:  fine.status as 'critical' | 'no_noc' | 'warning',
      todayExtraction: sensor.todayExtraction,
      dailyLimit:     fine.dailyLimit,
      finePerDay:     fine.finePerDay,
      daysExceeded:   fine.daysExceeded,
      totalFine30Days: fine.totalFine30Days,
      nocAnnualFine:  fine.nocAnnualFine,
      nocFineCategory: fine.nocFineCategory,
      timestamp:      new Date().toISOString(),
    };

    fetch('/api/notifications/send-email', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ type: 'industry_fine', to: userEmail, data: emailData }),
    }).catch(console.error);
  }, [sensor?.id, userEmail, userName]);

  if (!sensor) return null;

  return (
    <div className="flex w-full h-full overflow-hidden">
      {/* LEFT — Geological Cross-Section 44% */}
      <GeoSection sensor={sensor} onClose={onClose} />

      {/* RIGHT — Data Panel 56% */}
      <div
        className="flex flex-col overflow-hidden"
        style={{
          flex: '0 0 56%',
          background: '#ffffff',
          borderLeft: '1px solid #bae6fd',
          boxShadow: '-8px 0 40px rgba(14,165,233,0.12)',
        }}
      >
        <PanelContent
          sensor={sensor}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

function Cloud() {
  return (
    <div style={{ position:'relative', width:48, height:20 }}>
      <div style={{ position:'absolute', bottom:0, left:4, right:4, height:12, background:'rgba(255,255,255,0.82)', borderRadius:8 }} />
      <div style={{ position:'absolute', bottom:6, left:10, width:18, height:16, background:'rgba(255,255,255,0.82)', borderRadius:'50%' }} />
      <div style={{ position:'absolute', bottom:4, left:22, width:14, height:14, background:'rgba(255,255,255,0.82)', borderRadius:'50%' }} />
    </div>
  );
}

function GeoSection({ sensor, onClose: _onClose }: { sensor: IndustrySensor; onClose: () => void }) {
  const gwl = sensor.groundwaterLevel;
  return (
    <div
      className="relative flex flex-col overflow-hidden"
      style={{ flex:'0 0 44%', background:'#0a1628' }}
    >
      <style>{`@keyframes ispwave { 0%{transform:translateX(0)} 100%{transform:translateX(-60px)} }`}</style>

      {/* Sky / Atmosphere */}
      <div style={{ height:64, background:'linear-gradient(180deg,#87ceeb,#b8e4f3)', position:'relative', flexShrink:0 }}>
        <div style={{ position:'absolute', top:10, right:32, width:28, height:28, background:'radial-gradient(circle,#ffe066,#ffcc00)', borderRadius:'50%', boxShadow:'0 0 16px 4px rgba(255,220,0,0.4)' }} />
        <div style={{ position:'absolute', top:14, left:'20%' }}><Cloud /></div>
        <div style={{ position:'absolute', top:20, left:'55%', transform:'scale(0.7)' }}><Cloud /></div>
        <div style={{ position:'absolute', bottom:4, left:12, fontSize:9, color:'#0e4f72', letterSpacing:'0.08em', fontWeight:600 }}>SKY / ATMOSPHERE</div>
      </div>

      {/* Ground Surface */}
      <div style={{ height:14, background:'linear-gradient(180deg,#6B4226,#4a2e14)', flexShrink:0, display:'flex', alignItems:'center' }}>
        <span style={{ fontSize:8, color:'#c4956a', marginLeft:10, letterSpacing:'0.08em', fontWeight:600 }}>GROUND SURFACE — 0 m</span>
      </div>

      {/* Geological Layers */}
      <div className="relative flex flex-col" style={{ flex:'0 0 52%' }}>
        <div style={{ position:'absolute', left:'42%', top:0, bottom:0, width:2, background:'linear-gradient(180deg,rgba(56,189,248,0.6),rgba(56,189,248,0.9))', zIndex:2 }} />
        {GEO_LAYERS.map((layer) => {
          const pct = (layer.to - layer.from) * 100;
          const depthStart = (gwl * layer.from).toFixed(1);
          const depthEnd   = (gwl * layer.to).toFixed(1);
          return (
            <div key={layer.key} style={{
              flex:`0 0 ${pct}%`,
              background:`linear-gradient(180deg,${layer.grad[0]},${layer.grad[1]})`,
              position:'relative', borderBottom:'1px solid rgba(255,255,255,0.04)', overflow:'hidden',
            }}>
              <div style={{ position:'absolute', top:4, left:8, zIndex:3 }}>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', letterSpacing:'0.06em' }}>{layer.label}</div>
                <div style={{ fontSize:7.5, color:'rgba(255,255,255,0.35)', marginTop:1 }}>{depthStart}m – {depthEnd}m</div>
              </div>
              <div style={{ position:'absolute', top:4, right:8, textAlign:'right', zIndex:3 }}>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)' }}>{layer.metric}</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.75)', fontWeight:700 }}>{layer.getValue(sensor)}</div>
              </div>
              <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle,rgba(255,255,255,0.06) 1px,transparent 1px)', backgroundSize:'10px 10px', zIndex:1 }} />
            </div>
          );
        })}
        <div style={{ position:'absolute', bottom:-6, left:'calc(42% - 5px)', width:11, height:11, borderRadius:'50%', background:'#38bdf8', boxShadow:'0 0 8px 3px rgba(56,189,248,0.5)', zIndex:4 }} />
      </div>

      {/* Aquifer Zone */}
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden"
        style={{ background:'linear-gradient(180deg,#0a2a5e,#0e3a6e)' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:18, overflow:'hidden' }}>
          <div style={{ width:'calc(100% + 60px)', height:22, background:'rgba(56,189,248,0.12)', borderRadius:'50%', animation:'ispwave 3s linear infinite' }} />
        </div>
        <div style={{ textAlign:'center', zIndex:2 }}>
          <div style={{ fontSize:9, color:'rgba(56,189,248,0.5)', letterSpacing:'0.15em', marginBottom:4 }}>AQUIFER ZONE</div>
          <div style={{ fontSize:24, fontWeight:800, color:'#38bdf8', letterSpacing:'-0.02em' }}>{gwl} m</div>
          <div style={{ fontSize:9, color:'rgba(56,189,248,0.45)', marginTop:2 }}>groundwater depth</div>
        </div>
        <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle,rgba(56,189,248,0.08) 1px,transparent 1px)', backgroundSize:'14px 14px' }} />
      </div>

      {/* Bottom bar */}
      <div style={{ height:38, background:'rgba(0,0,0,0.7)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between', paddingLeft:12, paddingRight:12, borderTop:'1px solid rgba(56,189,248,0.15)' }}>
        <span style={{ fontSize:9.5, color:'rgba(255,255,255,0.55)' }}>Today: <span style={{ color:'#38bdf8', fontWeight:700 }}>{formatLitres(sensor.todayExtraction)}</span></span>
        <span style={{ fontSize:9.5, color:'rgba(255,255,255,0.55)' }}>Depth: <span style={{ color:'#38bdf8', fontWeight:700 }}>{gwl} m</span></span>
      </div>
    </div>
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

  return (
    <>
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-5 pb-4"
        style={{ borderBottom: '1px solid #e0f2fe' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono px-2 py-0.5 rounded"
                style={{ background: '#f0f9ff', color: '#64748b', border: '1px solid #e0f2fe' }}>
                {sensor.id}
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-medium"
                style={{ background: `${statusColor}20`, color: statusColor }}>
                {statusLabel}
              </span>
            </div>
            <h2 className="font-bold text-base leading-tight truncate" style={{ color: '#0c4a6e' }}>{sensor.industryName}</h2>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{sensor.location}</p>
          </div>
          <button onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg transition-colors"
            style={{ color: '#94a3b8', background: '#f0f9ff', border: '1px solid #e0f2fe' }}>
            <X size={18} />
          </button>
        </div>


      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-0.5 px-5 pt-3 pb-0"
        style={{ borderBottom: '1px solid #e0f2fe', background: '#f8fafc' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-3 pb-2.5 pt-1 text-xs font-medium transition-colors relative"
            style={{ color: activeTab === tab.id ? '#0284c7' : '#94a3b8' }}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="isp-tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ background: '#0284c7' }}
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
            {activeTab === 'forecast' && (
              <ForecastTab sensor={sensor} />
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
  const industryLabel = sensor.industryType === 'small_micro' ? 'Small / Micro' : 'Water Intensive';
  return (
    <div className="space-y-4">
      {/* Industry Type + NOC Status cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3.5" style={{ background:'rgba(2,132,199,0.08)', border:'1px solid rgba(2,132,199,0.25)' }}>
          <p className="text-xs mb-1" style={{ color:'#64748b' }}>Industry Type</p>
          <p className="text-sm font-bold leading-tight" style={{ color:'#0284c7' }}>{industryLabel}</p>
        </div>
        <div className="rounded-xl p-3.5" style={
          sensor.hasNOC
            ? { background:'rgba(34,197,94,0.08)',  border:'1px solid rgba(34,197,94,0.25)' }
            : { background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.3)' }
        }>
          <p className="text-xs mb-1" style={{ color:'#64748b' }}>NOC Status</p>
          <p className="text-sm font-bold leading-tight" style={{ color: sensor.hasNOC ? '#22c55e' : '#f97316' }}>
            {sensor.hasNOC ? 'Registered' : 'Not Registered'}
          </p>
          {!sensor.hasNOC && <p className="text-xs mt-0.5" style={{ color:'#f97316', opacity:0.7 }}>Penalty applicable</p>}
        </div>
      </div>

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
              <p className="text-xs" style={{ color: '#64748b' }}>Per year · {fine.nocFineCategory}</p>
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
              <p className="text-xs" style={{ color: '#64748b' }}>
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
      <div className="rounded-xl p-4" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: '#64748b' }}>Today's Extraction</span>
          <span className="text-xs font-mono" style={{ color: '#94a3b8' }}>
            Limit: {formatLitres(fine.dailyLimit)}
          </span>
        </div>
        <p className="text-2xl font-bold mb-3" style={{ color: statusColor }}>
          {formatLitres(sensor.todayExtraction)}
        </p>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#e0f2fe' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: statusColor }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(limitPct, 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          />
        </div>
        <p className="text-xs mt-1.5 text-right" style={{ color: '#94a3b8' }}>
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
      <div className="rounded-xl p-4" style={{ background: '#f8fafc', border: '1px solid #e0f2fe' }}>
        <h3 className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: '#64748b' }}>
          30-Day Summary
        </h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Avg Daily', value: formatLitres(Math.round(sensor.dailyExtractions.reduce((s: number, d: { liters: number }) => s + d.liters, 0) / sensor.dailyExtractions.length)) },
            { label: 'Peak Day', value: formatLitres(Math.max(...sensor.dailyExtractions.map((d: { liters: number }) => d.liters))) },
            { label: 'Violations', value: String(fine.daysExceeded) + ' days' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs" style={{ color: '#64748b' }}>{label}</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: '#0c4a6e' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Coordinates */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{ background: '#f8fafc', border: '1px solid #e0f2fe' }}>
        <span className="text-xs font-mono" style={{ color: '#94a3b8' }}>
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
        <h3 className="text-sm font-semibold mb-1" style={{ color: '#0c4a6e' }}>Daily Extraction — Last 14 Days</h3>
        <p className="text-xs mb-4" style={{ color: '#64748b' }}>
          Red bars indicate days exceeding the {formatLitres(fine.dailyLimit)}/day limit
        </p>
        <ExtractionChart extractions={sensor.dailyExtractions} dailyLimit={fine.dailyLimit} />
      </div>

      {recentViolations.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #fecaca' }}>
          <div className="px-4 py-2.5" style={{ background: 'rgba(239,68,68,0.06)' }}>
            <h4 className="text-xs font-semibold text-red-500">Recent Violations</h4>
          </div>
          {recentViolations.map((v: any) => (
            <div key={v.date} className="flex items-center justify-between px-4 py-2.5"
              style={{ borderTop: '1px solid #fee2e2', background: '#fff' }}>
              <span className="text-xs font-mono" style={{ color: '#64748b' }}>{v.date}</span>
              <span className="text-xs text-red-400">{formatLitres(v.liters)}</span>
              <span className="text-xs" style={{ color: '#94a3b8' }}>+{formatLitres(v.excess)}</span>
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
        <h3 className="text-sm font-semibold mb-1" style={{ color: '#0c4a6e' }}>7-Day Rainfall Forecast</h3>
        <p className="text-xs mb-4" style={{ color: '#64748b' }}>
          Predicted rainfall and probability for the region
        </p>
        <RainfallChart forecast={sensor.rainfallForecast} />
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #bae6fd' }}>
        <div className="px-4 py-2.5" style={{ background: 'rgba(14,165,233,0.07)' }}>
          <h4 className="text-xs font-semibold" style={{ color: '#0284c7' }}>Forecast Details</h4>
        </div>
        {sensor.rainfallForecast.map((f) => (
          <div key={f.date} className="flex items-center justify-between px-4 py-2.5"
            style={{ borderTop: '1px solid #e0f2fe', background: '#fff' }}>
            <span className="text-xs font-mono" style={{ color: '#64748b' }}>{f.date}</span>
            <div className="flex items-center gap-1">
              <span className="text-sky-400 text-xs font-medium">{f.mm} mm</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: '#e0f2fe' }}>
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

function ForecastTab({ sensor }: { sensor: IndustrySensor }) {
  return (
    <div className="space-y-3">
      <GroundwaterForecastChart sensor={sensor} />
    </div>
  );
}

function MetricCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="rounded-xl p-3.5"
      style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs" style={{ color: '#64748b' }}>{label}</span>
      </div>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{sub}</p>
    </div>
  );
}
