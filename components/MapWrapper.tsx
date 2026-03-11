'use client';

import dynamic from 'next/dynamic';
import { IndustrySensor } from '@/types';

const MapClient = dynamic(() => import('./MapClient'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: '#0d1117' }}
    >
      <div className="text-center">
        <div
          className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
          style={{ borderColor: '#22c55e', borderTopColor: 'transparent' }}
        />
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Loading Map…
        </p>
      </div>
    </div>
  ),
});

interface MapWrapperProps {
  userType: 'industry' | 'farmer' | 'blockchain';
  sensors: IndustrySensor[];
  selectedSensorId?: string;
  onSensorSelect: (sensor: IndustrySensor | null, e?: MouseEvent) => void;
  onCinematicComplete?: (sensorId: string) => void;
  restrictedToCompany?: string;
}

export default function MapWrapper({ userType, sensors, selectedSensorId, onSensorSelect, onCinematicComplete, restrictedToCompany }: MapWrapperProps) {
  return (
    <div className="w-full h-full">
      <MapClient
        userType={userType}
        sensors={sensors}
        selectedSensorId={selectedSensorId}
        onSensorSelect={onSensorSelect}
        onCinematicComplete={onCinematicComplete ?? (() => {})}
        restrictedToCompany={restrictedToCompany}
      />
    </div>
  );
}
