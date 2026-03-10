'use client';

import { IndustrySensor } from '@/types';
import { calculateFine } from '@/lib/fineCalculation';

export default function StatsBar({ sensors }: { sensors: IndustrySensor[] }) {
  const fines = sensors.map((s) => calculateFine(s));
  const critical = fines.filter((f) => f.status === 'critical').length;
  const noNoc = fines.filter((f) => f.status === 'no_noc').length;
  const warning = fines.filter((f) => f.status === 'warning').length;
  const normal = fines.filter((f) => f.status === 'normal').length;
  const totalFines = fines.reduce((sum, f) => sum + f.totalFine30Days, 0);

  const stats = [
    { label: 'Active Sensors', value: sensors.length, color: '#38bdf8' },
    { label: 'Zones', value: 4, color: '#94a3b8' },
    { label: 'Within Limits', value: normal, color: '#22c55e' },
    { label: 'Warning', value: warning, color: '#f59e0b' },
    { label: 'Exceeded', value: critical, color: '#ef4444' },
    { label: 'No NOC', value: noNoc, color: '#8b5cf6' },
    {
      label: '30-Day Fines',
      value: `₹${(totalFines / 100000).toFixed(1)}L`,
      color: '#ef4444',
    },
  ];

  return (
    <div
      className="flex items-center gap-0 overflow-x-auto flex-shrink-0"
      style={{ background: 'rgba(240,249,255,0.97)', borderBottom: '1px solid #bae6fd' }}
    >
      {stats.map((s, i) => (
        <div
          key={s.label}
          className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
          style={{ borderRight: i < stats.length - 1 ? '1px solid #e0f2fe' : 'none' }}
        >
          <span className="text-lg font-bold tabular-nums" style={{ color: s.color }}>
            {s.value}
          </span>
          <span className="text-xs" style={{ color: '#64748b' }}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}
