'use client';

import { SENSOR_ZONES } from '@/lib/data';

export default function MapLegend() {
  const statusItems = [
    { color: '#22c55e', label: 'Within Limits' },
    { color: '#f59e0b', label: 'Approaching Limit (>80%)' },
    { color: '#ef4444', label: 'Limit Exceeded' },
    { color: '#8b5cf6', label: 'No NOC – Illegal Extraction' },
  ];

  return (
    <div
      className="absolute bottom-6 left-4 z-[1000] rounded-xl p-3 space-y-3"
      style={{
        background: 'rgba(15,23,42,0.9)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.1)',
        minWidth: 210,
      }}
    >
      {/* Status legend */}
      <div>
        <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Sensor Status
        </p>
        <div className="space-y-1.5">
          {statusItems.map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Zone legend */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
        <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Industrial Zones
        </p>
        <div className="space-y-1.5">
          {SENSOR_ZONES.map((zone) => (
            <div key={zone.id} className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border"
                style={{ borderColor: zone.color, background: `${zone.color}22` }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <span style={{ color: zone.color, fontWeight: 600 }}>Zone {zone.id}</span> · {zone.label.split('·')[0]?.trim() ?? zone.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Click any sensor for details
        </p>
      </div>
    </div>
  );
}

