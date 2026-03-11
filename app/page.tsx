'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '@/components/Header';
import StatsBar from '@/components/StatsBar';
import GWLAnalyticsBar from '@/components/GWLAnalyticsBar';
import MapWrapper from '@/components/MapWrapper';
import MapLegend from '@/components/MapLegend';
import IndustrySensorPanel from '@/components/IndustrySensorPanel';
import FarmerDashboard from '@/components/FarmerDashboard';
import BlockchainView from '@/components/BlockchainView';
import AuthPage from '@/components/AuthPage';
import AIChatBot from '@/components/AIChatBot';
import ZapMorph from '@/components/GTATransition';
import { AnimatePresence } from 'framer-motion';
import { fetchIndustrySensors } from '@/lib/supabaseQueries';
import { Session, loadSession, saveSession, clearSession } from '@/lib/auth';
import { IndustrySensor, UserType } from '@/types';

type MorphMode = 'idle' | 'enter' | 'active' | 'exit';

export default function HomePage() {
  const [session, setSession]   = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [userType, setUserType] = useState<UserType>('industry');

  const [activeSensor, setActiveSensor]   = useState<IndustrySensor | null>(null);
  const pendingSensorRef                  = useRef<IndustrySensor | null>(null);

  // ZapMorph state
  const [morphMode, setMorphMode]     = useState<MorphMode>('idle');
  const [morphOrigin, setMorphOrigin] = useState({ x: 0.5, y: 0.5 });

  // Sensors
  const [sensors, setSensors] = useState<IndustrySensor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = loadSession();
    setSession(s);
    if (s?.role === 'farmer') setUserType('farmer');
    setHydrated(true);
  }, []);

  const logIndustryToBlockchain = useCallback((list: IndustrySensor[]) => {
    if (list.length === 0) return;
    const readings = list.map(s => ({
      sensor_id: s.id, industry_name: s.industryName, location: s.location,
      industry_type: s.industryType, has_noc: s.hasNOC,
      timestamp: new Date().toISOString(), groundwater_level: s.groundwaterLevel,
      moisture_pct: s.moisturePercentage, today_extraction: s.todayExtraction,
    }));
    fetch('/api/blockchain/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ readings }) })
      .then(r => r.json())
      .then(d => { if (d.success) console.info(`[blockchain] logged ${d.transactions?.length ?? 0} sensor(s)`); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!activeSensor) return;
    const reading = {
      sensor_id: activeSensor.id, industry_name: activeSensor.industryName,
      location: activeSensor.location, industry_type: activeSensor.industryType,
      has_noc: activeSensor.hasNOC, timestamp: new Date().toISOString(),
      groundwater_level: activeSensor.groundwaterLevel,
      moisture_pct: activeSensor.moisturePercentage,
      today_extraction: activeSensor.todayExtraction,
    };
    fetch('/api/blockchain/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ readings: [reading] }) })
      .then(r => r.json())
      .then(d => { if (d.success) console.info(`[blockchain] logged sensor ${activeSensor.id}`); })
      .catch(console.error);
  }, [activeSensor]);

  useEffect(() => {
    if (!session) return;
    fetchIndustrySensors()
      .then(data => { setSensors(data); logIndustryToBlockchain(data); })
      .catch(err => console.error('Failed to load sensors:', err))
      .finally(() => setLoading(false));

    const interval = setInterval(() => {
      fetchIndustrySensors()
        .then(data => { setSensors(data); logIndustryToBlockchain(data); })
        .catch(console.error);
    }, 3_600_000);
    return () => clearInterval(interval);
  }, [session, logIndustryToBlockchain]);

  if (!hydrated) return null;

  if (!session) {
    return (
      <AuthPage
        onAuth={s => {
          saveSession(s);
          setSession(s);
          setUserType(s.role === 'farmer' ? 'farmer' : 'industry');
        }}
      />
    );
  }

  function handleSignOut() {
    clearSession(); setSession(null); setUserType('industry');
    setMorphMode('idle'); setActiveSensor(null);
  }

  function handleUserTypeChange(type: UserType) {
    setUserType(type);
    if (morphMode !== 'idle') { setMorphMode('idle'); setActiveSensor(null); }
  }

  /**
   * Called when a sensor is clicked.
   * `clickEvent` carries the raw mouse event so we can compute
   * the normalized origin for the zoom.
   */
  function handleSensorSelect(sensor: IndustrySensor | null, clickEvent?: MouseEvent) {
    if (!sensor) { if (morphMode === 'active') handleCloseData(); return; }
    if (session!.role === 'industry' && session!.companyName
        && sensor.industryName !== session!.companyName) return;

    // Compute normalized click origin (fallback: center)
    if (clickEvent) {
      setMorphOrigin({
        x: clickEvent.clientX / window.innerWidth,
        y: clickEvent.clientY / window.innerHeight,
      });
    }

    pendingSensorRef.current = sensor;
    // Set active sensor immediately so GeoSection renders during morph
    setActiveSensor(sensor);
    setMorphMode('enter');
  }

  function handleEnterComplete() {
    setMorphMode('active');
  }

  function handleCloseData() {
    setMorphMode('exit');
  }

  function handleExitComplete() {
    setActiveSensor(null);
    pendingSensorRef.current = null;
    setMorphMode('idle');
  }

  const displayedSensors = (session.role === 'industry' && session.companyName)
    ? sensors.filter(s => s.industryName === session.companyName)
    : sensors;

  const isDataView = morphMode === 'active';
  const isTransitioning = morphMode === 'enter' || morphMode === 'exit';

  // ── Map scene (always rendered) ──────────────────────────────────────────
  const mapScene = (
    <div className="absolute inset-0">
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
          selectedSensorId={activeSensor?.id}
          onSensorSelect={(s, e) => handleSensorSelect(s, e)}
          restrictedToCompany={session!.role === 'industry' ? session!.companyName : undefined}
        />
      )}
      {userType === 'industry' && <MapLegend hidden={isDataView || isTransitioning} />}
      <AnimatePresence>
        {userType === 'farmer' && (
          <FarmerDashboard userEmail={session.email} userName={session.name}
            filterFarmerName={session.role === 'farmer' ? session.farmerName : undefined} />
        )}
      </AnimatePresence>
      <AnimatePresence>{userType === 'blockchain' && <BlockchainView />}</AnimatePresence>
    </div>
  );

  // ── Data scene (only meaningful when sensor is set) ──────────────────────
  const dataScene = (
    <div className="absolute inset-0" style={{ background: '#ffffff' }}>
      {/* Back-to-map button */}
      {activeSensor && (
        <>
          {/* Frosted back button */}
          <button
            onClick={handleCloseData}
            disabled={isTransitioning}
            style={{
              position: 'absolute',
              top: 12, left: 12,
              zIndex: 200,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              background: 'rgba(0,0,0,0.52)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(56,189,248,0.35)',
              borderRadius: 8,
              color: '#38bdf8',
              fontSize: 12,
              fontWeight: 700,
              cursor: isTransitioning ? 'default' : 'pointer',
              letterSpacing: '0.05em',
              opacity: isTransitioning ? 0 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            ← Back to Map
          </button>

          <IndustrySensorPanel
            sensor={activeSensor}
            onClose={handleCloseData}
            userEmail={session.email}
            userName={session.name}
          />
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: '#f0f9ff', overflow: 'hidden' }}>
      <Header
        userType={userType}
        onUserTypeChange={handleUserTypeChange}
        sensorCount={displayedSensors.length}
        userName={session.name}
        userRole={session.role}
        onSignOut={handleSignOut}
      />

      {/* Stats / analytics bars — slide away during data view */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: isDataView ? 0 : 120,
          opacity: isDataView ? 0 : 1,
          transition: isTransitioning
            ? `max-height 0.5s ease, opacity 0.3s ease`
            : 'none',
        }}
      >
        {userType === 'industry' && <StatsBar sensors={displayedSensors} />}
        {userType === 'industry' && <GWLAnalyticsBar />}
      </div>

      {/* Main morph area */}
      <div className="relative flex-1 overflow-hidden">
        {userType === 'industry' ? (
          <ZapMorph
            fromScene={mapScene}
            toScene={dataScene}
            mode={morphMode}
            origin={morphOrigin}
            onEnterComplete={handleEnterComplete}
            onExitComplete={handleExitComplete}
          />
        ) : (
          mapScene
        )}
      </div>

      <AIChatBot session={session} />
    </div>
  );
}
