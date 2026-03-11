'use client';

import { useState, useEffect } from 'react';
import { UserType } from '@/types';
import { Droplets, LogOut, Eye, EyeOff } from 'lucide-react';

interface HeaderProps {
  userType: UserType;
  onUserTypeChange: (type: UserType) => void;
  sensorCount: number;
  userName?: string;
  userRole?: 'industry' | 'farmer' | 'admin';
  onSignOut?: () => void;
}

export default function Header({
  userType, onUserTypeChange, sensorCount,
  userName, userRole, onSignOut,
}: HeaderProps) {
  const initial = userName ? userName.charAt(0).toUpperCase() : '?';

  // Persisted toggle: whether the Chain tab is visible in the nav
  const [chainVisible, setChainVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('chainTabVisible') !== 'false';
  });

  // Keep localStorage in sync and redirect away from blockchain if hidden
  useEffect(() => {
    localStorage.setItem('chainTabVisible', String(chainVisible));
    if (!chainVisible && userType === 'blockchain') {
      onUserTypeChange('industry');
    }
  }, [chainVisible, userType, onUserTypeChange]);

  const visibleTypes = ((): UserType[] => {
    if (userRole === 'industry') return ['industry'];
    if (userRole === 'farmer')   return ['farmer'];
    // admin: apply chain toggle logic
    return (chainVisible ? ['industry', 'farmer', 'blockchain'] : ['industry', 'farmer']) as UserType[];
  })();

  return (
    <header className="flex items-center justify-between px-6 py-3 z-50 relative flex-shrink-0"
      style={{
        background: '#0ea5e9',
        borderBottom: '1px solid #0284c7',
        boxShadow: '0 2px 16px rgba(14,165,233,0.4)',
      }}>
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}>
          <Droplets size={22} style={{ color: '#ffffff' }} />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-none tracking-wide" style={{ color: '#ffffff' }}>GroundwaterIQ</h1>
          <p className="text-xs leading-none mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
            IoT Groundwater Monitoring — Tamil Nadu
          </p>
        </div>
      </div>

      {/* Live badge */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full"
        style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)' }}>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#86efac' }} />
        <span className="text-xs font-medium" style={{ color: '#86efac' }}>LIVE</span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>{sensorCount} sensors · 4 zones</span>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        {/* User type switch */}
        <div className="flex items-center gap-1 p-1 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }}>
          {visibleTypes.map((type) => (
            <button
              key={type}
              onClick={() => onUserTypeChange(type)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 capitalize"
              style={
                userType === type
                  ? { background: '#ffffff', color: '#0284c7', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }
                  : { color: 'rgba(255,255,255,0.85)', background: 'transparent' }
              }
            >
              {type === 'industry' ? '🏭 Industry' : type === 'farmer' ? '🌾 Farmer' : '⛓️ Chain'}
            </button>
          ))}
        </div>

        {/* Chain tab visibility toggle — admin only */}
        {(!userRole || userRole === 'admin') && (
          <button
            onClick={() => setChainVisible(v => !v)}
            title={chainVisible ? 'Hide Chain tab' : 'Show Chain tab'}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:scale-110"
            style={{
              background: chainVisible ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: chainVisible ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
            }}
          >
            {chainVisible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        )}

        {/* Avatar + sign out */}
        {userName && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: '#ffffff', color: '#0284c7' }}>
                {initial}
              </div>
              <span className="text-sm font-medium hidden sm:block" style={{ color: '#ffffff', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userName}
              </span>
            </div>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all hover:scale-105"
                style={{ background: 'rgba(255,255,255,0.18)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)' }}
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

