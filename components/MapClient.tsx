'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import {
  MapContainer, TileLayer, Marker,
  Tooltip, Circle,
  useMap, useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Patch Leaflet focus listeners to guard against tooltip being unbound before
// the focus event fires (race condition during React unmount / map animation).
if (typeof window !== 'undefined') {
  const proto = (L as unknown as Record<string, { prototype: Record<string, unknown> }>)
    .Layer?.prototype;
  if (proto?._addFocusListenersOnLayer) {
    proto._addFocusListenersOnLayer = function (
      this: Record<string, unknown>,
      layer: unknown,
    ) {
      const getEl = (layer as { getElement?: () => HTMLElement | null }).getElement;
      const el = typeof getEl === 'function' ? getEl.call(layer) : null;
      if (!el) return;
      const self = this;
      L.DomEvent.on(el, 'focus', function () {
        if (!self._tooltip) return;
        (self._tooltip as Record<string, unknown>)._source = layer;
        (self as { openTooltip: () => void }).openTooltip();
      });
      L.DomEvent.on(el, 'blur', function () {
        if (!self._tooltip) return;
        (self as { closeTooltip: () => void }).closeTooltip();
      });
    };
  }
}
import { IndustrySensor } from '@/types';
import { SENSOR_ZONES, MAP_CENTER, MAP_ZOOM } from '@/lib/data';
import {
  calculateFine, getStatusColor, getStatusLabel,
  formatLitres,
} from '@/lib/fineCalculation';

// â”€â”€ Zoom constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ZOOM_GROUND  = 17;   // street-level dive
const ZOOM_SKY     = 5;    // sky during pan
const ZOOM_ZONE_HIDE = 14; // zone rings hidden above this zoom

// â”€â”€ Small dot icon (unselected) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function createSensorIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'sensor-icon-wrapper',
    html: `
      <div class="sensor-dot-inner" style="width:13px;height:13px;background:${color};box-shadow:0 0 0 2px rgba(0,0,0,0.4),0 0 10px ${color}60;"></div>
      <div class="sensor-ring" style="border-color:${color};"></div>
      <div class="sensor-ring-outer" style="border-color:${color};"></div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

// â”€â”€ Physical IoT pole icon (selected â€” street level) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function createGroundIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'iot-pole-wrapper',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;position:relative;width:56px;height:82px;">

        <!-- sensor head box -->
        <div style="
          width:30px;height:22px;border-radius:5px;flex-shrink:0;
          background:#1e293b;border:2px solid ${color};
          box-shadow:0 0 16px ${color}55;
          display:flex;align-items:center;justify-content:center;position:relative;">
          <!-- 3 sensor dots -->
          <div style="display:flex;gap:3px;">
            <div style="width:4px;height:4px;border-radius:50%;background:${color};"></div>
            <div style="width:4px;height:4px;border-radius:50%;background:${color}88;"></div>
            <div style="width:4px;height:4px;border-radius:50%;background:${color};"></div>
          </div>
          <!-- blinking LED -->
          <div class="iot-led" style="
            position:absolute;top:-4px;right:-4px;
            width:8px;height:8px;border-radius:50%;
            background:${color};box-shadow:0 0 8px ${color};"></div>
        </div>

        <!-- metal pole -->
        <div style="
          width:3px;height:44px;flex-shrink:0;
          background:linear-gradient(to bottom,${color}80,${color}20);"></div>

        <!-- ground anchor plate -->
        <div style="
          width:16px;height:4px;border-radius:2px;flex-shrink:0;
          background:${color}40;border:1px solid ${color}60;"></div>

        <!-- ground ripple rings -->
        <div class="ground-ripple" style="
          position:absolute;bottom:2px;
          width:28px;height:8px;border-radius:50%;
          border:1px solid ${color};"></div>
        <div class="ground-ripple ground-ripple-2" style="
          position:absolute;bottom:1px;
          width:46px;height:12px;border-radius:50%;
          border:1px solid ${color};"></div>
      </div>
    `,
    iconSize: [56, 82],
    iconAnchor: [28, 78],
  });
}

// â”€â”€ waitForMoveEnd â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function waitForMoveEnd(map: L.Map): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, 60);
    map.once('moveend', () => { clearTimeout(t); resolve(); });
  });
}

// â”€â”€ Zone circles â€” hidden above ZOOM_ZONE_HIDE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ZoneCircles() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  if (zoom > ZOOM_ZONE_HIDE) return null;
  return (
    <>
      {SENSOR_ZONES.map((zone) => (
        <Circle
          key={zone.id}
          center={[zone.lat, zone.lng]}
          radius={1800}
          pathOptions={{
            color: zone.color, fillColor: zone.color,
            fillOpacity: 0.04, opacity: 0.35,
            weight: 1.5, dashArray: '6 5',
          }}
        >
          <Tooltip direction="top" permanent opacity={1} className="zone-label-tooltip">
            <span style={{ color: zone.color, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
              {zone.label}
            </span>
          </Tooltip>
        </Circle>
      ))}
    </>
  );
}

// â”€â”€ Clears selection when user clicks blank map area â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function MapClickHandler({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: onClear });
  return null;
}

// â”€â”€ Cinematic camera controller â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CinematicController({
  selectedSensorId,
  sensors,
  onComplete,
}: {
  selectedSensorId?: string;
  sensors: IndustrySensor[];
  onComplete: (id: string) => void;
}) {
  const map = useMap();
  const prevIdRef   = useRef<string | undefined>(undefined);
  const genRef      = useRef(0);
  const completeRef = useRef(onComplete);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);

  const run = useCallback(async (
    target: L.LatLng, id: string, isFirst: boolean,
  ) => {
    const gen = ++genRef.current;
    const alive = () => gen === genRef.current;

    map.stop();
    await new Promise<void>((r) => setTimeout(r, 30));
    if (!alive()) return;

    if (isFirst) {
      // straight dive to street level
      map.flyTo(target, ZOOM_GROUND, { duration: 2.0, easeLinearity: 0.22 });
      await waitForMoveEnd(map);
      if (!alive()) return;
      completeRef.current(id);
      return;
    }

    // â”€â”€ Phase 1: zoom out to sky above current location â”€â”€
    map.flyTo(map.getCenter(), ZOOM_SKY, { duration: 0.9, easeLinearity: 0.35 });
    await waitForMoveEnd(map);
    if (!alive()) return;
    await new Promise<void>((r) => setTimeout(r, 80));
    if (!alive()) return;

    // â”€â”€ Phase 2: pan along sky to target â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    map.flyTo(target, ZOOM_SKY, { duration: 1.4, easeLinearity: 0.2 });
    await waitForMoveEnd(map);
    if (!alive()) return;
    await new Promise<void>((r) => setTimeout(r, 80));
    if (!alive()) return;

    // â”€â”€ Phase 3: dive down to street level â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    map.flyTo(target, ZOOM_GROUND, { duration: 1.6, easeLinearity: 0.28 });
    await waitForMoveEnd(map);
    if (!alive()) return;
    completeRef.current(id);
  }, [map]);

  useEffect(() => {
    if (!selectedSensorId) { prevIdRef.current = undefined; return; }
    const s = sensors.find((x) => x.id === selectedSensorId);
    if (!s) return;
    const isFirst = !prevIdRef.current || prevIdRef.current === selectedSensorId;
    prevIdRef.current = selectedSensorId;
    run(L.latLng(s.lat, s.lng), selectedSensorId, isFirst);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSensorId]);

  return null;
}

// -- Single sensor marker --
function SensorMarker({
  sensor, isSelected, onSelect,
}: {
  sensor: IndustrySensor;
  isSelected: boolean;
  onSelect: (s: IndustrySensor | null) => void;
}) {
  const fine  = calculateFine(sensor);
  const color = getStatusColor(fine.status);
  const icon  = isSelected ? createGroundIcon(color) : createSensorIcon(color);

  return (
    <Marker
      position={[sensor.lat, sensor.lng]}
      icon={icon}
      zIndexOffset={isSelected ? 2000 : 0}
      eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e as unknown as Event); onSelect(sensor); } }}
    >
      {!isSelected && (
        <Tooltip direction="top" offset={[0, -10]} opacity={1} className="sensor-tooltip">
          <div className="sensor-tooltip-content">
            <div className="sensor-tooltip-header">
              <span style={{ color }}>{getStatusLabel(fine.status)}</span>
              <span className="sensor-tooltip-id">{sensor.id}</span>
            </div>
            <div className="sensor-tooltip-name">{sensor.industryName}</div>
            <div className="sensor-tooltip-row">
              <span>Today:</span>
              <span style={{ color }}>{formatLitres(sensor.todayExtraction)}</span>
            </div>
            <div className="sensor-tooltip-row">
              <span>GW Depth:</span>
              <span>{sensor.groundwaterLevel} m</span>
            </div>
          </div>
        </Tooltip>
      )}
    </Marker>
  );
}

// -- Main export --
interface MapClientProps {
  userType: 'industry' | 'farmer';
  sensors: IndustrySensor[];
  selectedSensorId?: string;
  onSensorSelect: (sensor: IndustrySensor | null) => void;
  onCinematicComplete: (sensorId: string) => void;
}

export default function MapClient({ userType, sensors, selectedSensorId, onSensorSelect, onCinematicComplete }: MapClientProps) {
  return (
    <MapContainer
      center={MAP_CENTER}
      zoom={MAP_ZOOM}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap contributors &copy; CARTO'
        maxZoom={19}
      />

      <CinematicController
        selectedSensorId={selectedSensorId}
        sensors={sensors}
        onComplete={onCinematicComplete}
      />

      {/* Clears sensor selection when blank map is clicked */}
      <MapClickHandler onClear={() => onSensorSelect(null)} />

      {/* Zone rings (hidden at street zoom) */}
      {userType === 'industry' && <ZoneCircles />}

      {/* Sensors */}
      {userType === 'industry' && sensors.map((sensor) => (
        <SensorMarker
          key={sensor.id}
          sensor={sensor}
          isSelected={sensor.id === selectedSensorId}
          onSelect={onSensorSelect}
        />
      ))}
    </MapContainer>
  );
}
