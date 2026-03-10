import { VRSensor, SensorReading, FarmerAlert } from '@/types';

// ── Deterministic pseudo-random helper (same pattern as data.ts) ──────────────
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ── Generate 24 hours of hourly readings ─────────────────────────────────────
function generateHourlyHistory(
  baseLevel: number,
  baseMoisture: number,
  baseTemp: number,
  seed: number
): SensorReading[] {
  const rand = seededRand(seed);
  const now = new Date('2026-03-10T14:00:00+05:30');

  return Array.from({ length: 24 }, (_, i) => {
    const ts = new Date(now);
    ts.setHours(ts.getHours() - (23 - i));
    return {
      timestamp: ts.toISOString(),
      groundwaterLevel: parseFloat((baseLevel + (rand() - 0.5) * 1.8).toFixed(2)),
      soilMoisture: Math.min(100, Math.max(5, Math.round(baseMoisture + (rand() - 0.5) * 12))),
      waterFlowRate: parseFloat((rand() * 14 + 1).toFixed(1)),
      pumpStatus: rand() > 0.45 ? 'on' : 'off',
      temperature: parseFloat((baseTemp + (rand() - 0.5) * 4).toFixed(1)),
      ph: parseFloat((6.9 + rand() * 0.9).toFixed(1)),
      turbidity: parseFloat((rand() * 8).toFixed(1)),
      batteryLevel: Math.round(55 + rand() * 45),
      signalStrength: Math.round(48 + rand() * 52),
    };
  });
}

// ── Pre-built alerts for sensors already in a bad state ──────────────────────
function makeAlert(
  sensorId: string,
  hoursAgo: number,
  level: FarmerAlert['level'],
  message: string
): FarmerAlert {
  const ts = new Date('2026-03-10T14:00:00+05:30');
  ts.setHours(ts.getHours() - hoursAgo);
  return {
    id: `${sensorId}-pre-${hoursAgo}`,
    sensorId,
    timestamp: ts.toISOString(),
    level,
    message,
    acknowledged: false,
  };
}

// =============================================================================
//  5 VR Sensors
//  Thresholds applied by sensorMonitor.ts:
//    groundwaterLevel > criticalDepthThreshold  →  LOW  → block + alert farmer
//    groundwaterLevel < safeDepthThreshold       →  HIGH → activate sprinkler
//    in between                                  →  WARNING → standby
// =============================================================================
export const vrSensors: VRSensor[] = [
  // ── VRS-01 · Tirunelveli — Paddy Field (CRITICAL — water table very low) ───
  {
    id: 'VRS-01',
    name: 'Sensor VRS-01',
    farmerName: 'Muthu Kumar',
    location: 'Tirunelveli · Paddy Belt',
    lat: 8.727,
    lng: 77.692,
    cropType: 'Paddy (Rice)',
    fieldAreaHectares: 3.2,
    criticalDepthThreshold: 12,
    safeDepthThreshold: 8,
    currentReading: {
      timestamp: '2026-03-10T14:00:00.000Z',
      groundwaterLevel: 14.2,   // DEEP — LOW water
      soilMoisture: 18,
      waterFlowRate: 2.1,
      pumpStatus: 'off',
      temperature: 32.4,
      ph: 7.1,
      turbidity: 5.8,
      batteryLevel: 72,
      signalStrength: 85,
    },
    hourlyHistory: generateHourlyHistory(14.0, 19, 32, 2001),
    sprinklerState: 'blocked',
    lastChecked: '2026-03-10T14:00:00.000Z',
    alerts: [
      makeAlert('VRS-01', 1, 'critical',
        '🚨 Groundwater critically low at 14.2 m depth. Sprinkler BLOCKED. Avoid irrigation until level recovers.'),
      makeAlert('VRS-01', 3, 'warning',
        '⚠️ Groundwater dropping — now at 13.8 m. Reduce extraction immediately.'),
      makeAlert('VRS-01', 7, 'warning',
        '⚠️ Groundwater exceeded safe zone at 12.3 m. Sprinkler placed on standby.'),
    ],
  },

  // ── VRS-02 · Thanjavur — Rice Farm (SAFE — healthy water table) ────────────
  {
    id: 'VRS-02',
    name: 'Sensor VRS-02',
    farmerName: 'Selvi Rajan',
    location: 'Thanjavur · Cauvery Delta',
    lat: 10.787,
    lng: 79.139,
    cropType: 'Short-grain Rice',
    fieldAreaHectares: 5.1,
    criticalDepthThreshold: 12,
    safeDepthThreshold: 8,
    currentReading: {
      timestamp: '2026-03-10T14:00:00.000Z',
      groundwaterLevel: 5.8,    // SHALLOW — HIGH water ✓
      soilMoisture: 68,
      waterFlowRate: 11.4,
      pumpStatus: 'on',
      temperature: 29.1,
      ph: 7.4,
      turbidity: 1.9,
      batteryLevel: 91,
      signalStrength: 94,
    },
    hourlyHistory: generateHourlyHistory(6.0, 65, 29, 2002),
    sprinklerState: 'active',
    lastChecked: '2026-03-10T14:00:00.000Z',
    alerts: [],
  },

  // ── VRS-03 · Salem — Mango Grove (WARNING — borderline zone) ─────────────
  {
    id: 'VRS-03',
    name: 'Sensor VRS-03',
    farmerName: 'Anbarasan Pillai',
    location: 'Salem · Mango Belt, Omalur',
    lat: 11.712,
    lng: 78.099,
    cropType: 'Alphonso Mango',
    fieldAreaHectares: 2.7,
    criticalDepthThreshold: 12,
    safeDepthThreshold: 8,
    currentReading: {
      timestamp: '2026-03-10T14:00:00.000Z',
      groundwaterLevel: 10.5,   // BORDERLINE — standby
      soilMoisture: 41,
      waterFlowRate: 5.3,
      pumpStatus: 'off',
      temperature: 30.8,
      ph: 7.0,
      turbidity: 3.2,
      batteryLevel: 64,
      signalStrength: 71,
    },
    hourlyHistory: generateHourlyHistory(10.3, 42, 31, 2003),
    sprinklerState: 'standby',
    lastChecked: '2026-03-10T14:00:00.000Z',
    alerts: [
      makeAlert('VRS-03', 2, 'warning',
        '⚠️ Groundwater at 10.5 m — approaching critical zone. Sprinkler on standby. Schedule irrigation carefully.'),
    ],
  },

  // ── VRS-04 · Erode — Sugarcane Field (SAFE — good level) ─────────────────
  {
    id: 'VRS-04',
    name: 'Sensor VRS-04',
    farmerName: 'Kavitha Subramaniam',
    location: 'Erode · Sugarcane Zone, Bhavani',
    lat: 11.448,
    lng: 77.717,
    cropType: 'Sugarcane',
    fieldAreaHectares: 4.8,
    criticalDepthThreshold: 12,
    safeDepthThreshold: 8,
    currentReading: {
      timestamp: '2026-03-10T14:00:00.000Z',
      groundwaterLevel: 6.2,    // SHALLOW — HIGH water ✓
      soilMoisture: 59,
      waterFlowRate: 13.2,
      pumpStatus: 'on',
      temperature: 31.5,
      ph: 7.3,
      turbidity: 2.4,
      batteryLevel: 88,
      signalStrength: 90,
    },
    hourlyHistory: generateHourlyHistory(6.4, 57, 31, 2004),
    sprinklerState: 'active',
    lastChecked: '2026-03-10T14:00:00.000Z',
    alerts: [],
  },

  // ── VRS-05 · Vellore — Groundnut Farm (CRITICAL — severe depletion) ────────
  {
    id: 'VRS-05',
    name: 'Sensor VRS-05',
    farmerName: 'Sundaram Naidu',
    location: 'Vellore · Groundnut Region, Gudiyatham',
    lat: 12.948,
    lng: 78.869,
    cropType: 'Groundnut',
    fieldAreaHectares: 2.4,
    criticalDepthThreshold: 12,
    safeDepthThreshold: 8,
    currentReading: {
      timestamp: '2026-03-10T14:00:00.000Z',
      groundwaterLevel: 15.8,   // VERY DEEP — CRITICAL LOW
      soilMoisture: 12,
      waterFlowRate: 0.8,
      pumpStatus: 'off',
      temperature: 33.2,
      ph: 6.8,
      turbidity: 7.1,
      batteryLevel: 57,
      signalStrength: 62,
    },
    hourlyHistory: generateHourlyHistory(15.5, 13, 33, 2005),
    sprinklerState: 'blocked',
    lastChecked: '2026-03-10T14:00:00.000Z',
    alerts: [
      makeAlert('VRS-05', 1, 'critical',
        '🚨 SEVERE: Groundwater at 15.8 m — extreme depletion detected. Sprinkler BLOCKED. Contact Block Agriculture Officer.'),
      makeAlert('VRS-05', 5, 'critical',
        '🚨 Groundwater at 14.9 m. Extraction banned. Do NOT irrigate.'),
      makeAlert('VRS-05', 12, 'warning',
        '⚠️ Groundwater dropped to 13.1 m. Risk of aquifer damage. Reduce pumping.'),
    ],
  },
];
