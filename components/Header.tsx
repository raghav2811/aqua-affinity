'use client';

import { UserType } from '@/types';
import { Droplets } from 'lucide-react';

interface HeaderProps {
  userType: UserType;
  onUserTypeChange: (type: UserType) => void;
  sensorCount: number;
}

export default function Header({ userType, onUserTypeChange, sensorCount }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-3 z-50 relative"
      style={{ background: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' }}>
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl" style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)' }}>
          <Droplets size={22} className="text-green-400" />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg leading-none tracking-wide">GroundwaterIQ</h1>
          <p className="text-xs leading-none mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
            IoT Groundwater Monitoring — Tamil Nadu
          </p>
        </div>
      </div>

      {/* Live badge */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full"
        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs text-green-400 font-medium">LIVE</span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{sensorCount} sensors · 4 zones</span>
      </div>

      {/* User type switch */}
      <div className="flex items-center gap-1 p-1 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
        {(['industry', 'farmer'] as UserType[]).map((type) => (
          <button
            key={type}
            onClick={() => onUserTypeChange(type)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 capitalize"
            style={
              userType === type
                ? { background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', boxShadow: '0 2px 12px rgba(34,197,94,0.4)' }
                : { color: 'rgba(255,255,255,0.6)', background: 'transparent' }
            }
          >
            {type === 'industry' ? '🏭 Industry' : '🌾 Farmer'}
          </button>
        ))}
      </div>
    </header>
  );
}
