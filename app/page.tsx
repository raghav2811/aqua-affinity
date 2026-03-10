'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';
import StatsBar from '@/components/StatsBar';
import MapWrapper from '@/components/MapWrapper';
import MapLegend from '@/components/MapLegend';
import IndustrySensorPanel from '@/components/IndustrySensorPanel';
import FarmerDashboard from '@/components/FarmerDashboard';
import StreetSimView from '@/components/StreetSimView';
import AuthPage from '@/components/AuthPage';
import { fetchIndustrySensors } from '@/lib/supabaseQueries';
import { Session, loadSession, saveSession, clearSession } from '@/lib/auth';
import { IndustrySensor, UserType } from '@/types';

export default function HomePage() {
  const [session, setSession]               = useState<Session | null>(null);
  const [hydrated, setHydrated]             = useState(false);
  const [userType, setUserType]             = useState<UserType>('industry');
  const [selectedSensor, setSelectedSensor] = useState<IndustrySensor | null>(null);
  const [simSensor, setSimSensor]           = useState<IndustrySensor | null>(null);

  // ── Industry sensors from Supabase ──────────────────────────────────────
  const [sensors, setSensors]   = useState<IndustrySensor[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setSession(loadSession());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchIndustrySensors()
      .then(setSensors)
      .catch((err) => console.error('Failed to load sensors:', err))
      .finally(() => setLoading(false));
  }, [session]);

  // ── Hydration guard ──────────────────────────────────────────────────────
  if (!hydrated) return null;

  // ── Auth gate ────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <AuthPage
        onAuth={(s) => {
          saveSession(s);
          setSession(s);
        }}
      />
    );
  }

  function handleSignOut() {
    clearSession();
    setSession(null);
  }

  function handleUserTypeChange(type: UserType) {
    setUserType(type);
    setSelectedSensor(null);
    setSimSensor(null);
  }

  function handleSensorSelect(sensor: IndustrySensor | null) {
    setSelectedSensor(sensor);
    if (!sensor) setSimSensor(null);
  }

  function handleCinematicComplete(sensorId: string) {
    const s = sensors.find(x => x.id === sensorId) ?? null;
    setSimSensor(s);
  }

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: '#f0f9ff', overflow: 'hidden' }}>
      <Header
        userType={userType}
        onUserTypeChange={handleUserTypeChange}
        sensorCount={sensors.length}
        userName={session.name}
        userRole={session.role}
        onSignOut={handleSignOut}
      />

      {userType === 'industry' && <StatsBar sensors={sensors} />}

      {/* Map area */}
      <div className="relative flex-1 overflow-hidden">
        {loading && userType === 'industry' ? (
          <div className="w-full h-full flex items-center justify-center" style={{ background: '#f0f9ff' }}>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
                style={{ borderColor: '#0ea5e9', borderTopColor: 'transparent' }} />
              <p className="text-sm" style={{ color: '#64748b' }}>Connecting to database…</p>
            </div>
          </div>
        ) : (
          <MapWrapper
            userType={userType}
            sensors={sensors}
            selectedSensorId={selectedSensor?.id}
            onSensorSelect={handleSensorSelect}
            onCinematicComplete={handleCinematicComplete}
          />
        )}

        {userType === 'industry' && <MapLegend />}

        {userType === 'industry' && (
          <IndustrySensorPanel
            sensor={selectedSensor}
            onClose={() => handleSensorSelect(null)}
          />
        )}

        <AnimatePresence>
          {userType === 'farmer' && <FarmerDashboard />}
        </AnimatePresence>

        {/* Ground scan simulation — fires after cinematic dive completes */}
        <AnimatePresence>
          {simSensor && (
            <StreetSimView
              key={simSensor.id}
              sensor={simSensor}
              onClose={() => setSimSensor(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


