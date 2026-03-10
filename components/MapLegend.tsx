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
        background: 'rgba(240,249,255,0.97)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #bae6fd',
        boxShadow: '0 8px 32px rgba(14,165,233,0.10)',
        minWidth: 210,
      }}
    >
      {/* Status legend */}
      <div>
        <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#64748b' }}>
          Sensor Status
        </p>
        <div className="space-y-1.5">
          {statusItems.map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="text-xs" style={{ color: '#0c4a6e' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Zone legend */}
      <div style={{ borderTop: '1px solid #e0f2fe', paddingTop: 10 }}>
        <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#64748b' }}>
          Industrial Zones
        </p>
        <div className="space-y-1.5">
          {SENSOR_ZONES.map((zone) => (
            <div key={zone.id} className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border"
                style={{ borderColor: zone.color, background: `${zone.color}22` }} />
              <span className="text-xs" style={{ color: '#0c4a6e' }}>
                <span style={{ color: zone.color, fontWeight: 600 }}>Zone {zone.id}</span> · {zone.label.split('·')[0]?.trim() ?? zone.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid #e0f2fe', paddingTop: 8 }}>
        <p className="text-xs" style={{ color: '#64748b' }}>
          Click any sensor for details
        </p>
      </div>
    </div>
  );
}

