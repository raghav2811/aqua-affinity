'use client';

import { UserType } from '@/types';
import { Droplets, LogOut } from 'lucide-react';

interface HeaderProps {
  userType: UserType;
  onUserTypeChange: (type: UserType) => void;
  sensorCount: number;
  userName?: string;
  userRole?: 'industry' | 'farmer';
  onSignOut?: () => void;
}

export default function Header({
  userType, onUserTypeChange, sensorCount,
  userName, userRole, onSignOut,
}: HeaderProps) {
  const avatarColor = userRole === 'farmer' ? '#059669' : '#0284c7';
  const initial     = userName ? userName.charAt(0).toUpperCase() : '?';

  return (
    <header className="flex items-center justify-between px-6 py-3 z-50 relative flex-shrink-0"
      style={{
        background: '#ffffff',
        borderBottom: '1px solid #bae6fd',
        boxShadow: '0 1px 12px rgba(14,165,233,0.08)',
      }}>
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl" style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid #bae6fd' }}>
          <Droplets size={22} style={{ color: '#0ea5e9' }} />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-none tracking-wide" style={{ color: '#0c4a6e' }}>GroundwaterIQ</h1>
          <p className="text-xs leading-none mt-0.5" style={{ color: '#64748b' }}>
            IoT Groundwater Monitoring — Tamil Nadu
          </p>
        </div>
      </div>

      {/* Live badge */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full"
        style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid #bae6fd' }}>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#10b981' }} />
        <span className="text-xs font-medium" style={{ color: '#10b981' }}>LIVE</span>
        <span className="text-xs" style={{ color: '#64748b' }}>{sensorCount} sensors · 4 zones</span>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        {/* User type switch */}
        <div className="flex items-center gap-1 p-1 rounded-xl"
          style={{ background: 'rgba(14,165,233,0.07)', border: '1px solid #bae6fd' }}>
          {(['industry', 'farmer'] as UserType[]).map((type) => (
            <button
              key={type}
              onClick={() => onUserTypeChange(type)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 capitalize"
              style={
                userType === type
                  ? { background: '#0ea5e9', color: '#fff', boxShadow: '0 2px 12px rgba(14,165,233,0.35)' }
                  : { color: '#64748b', background: 'transparent' }
              }
            >
              {type === 'industry' ? '🏭 Industry' : '🌾 Farmer'}
            </button>
          ))}
        </div>

        {/* Avatar + sign out */}
        {userName && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl"
              style={{ background: 'rgba(14,165,233,0.07)', border: '1px solid #bae6fd' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: avatarColor }}>
                {initial}
              </div>
              <span className="text-sm font-medium hidden sm:block" style={{ color: '#0c4a6e', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userName}
              </span>
            </div>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all hover:scale-105"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                title="Sign out"
              >
                <LogOut size={14} />
                <span className="hidden sm:block">Sign Out</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

