import { IndustrySensor, DailyExtraction, RainfallForecast } from '@/types';

const REFERENCE_DATE = new Date('2026-03-10');

function getPastDates(days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(REFERENCE_DATE);
    d.setDate(d.getDate() - (days - i));
    return d.toISOString().split('T')[0];
  });
}

function getFutureDates(days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(REFERENCE_DATE);
    d.setDate(d.getDate() + (i + 1));
    return d.toISOString().split('T')[0];
  });
}

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generateExtractions(
  base: number,
  variance: number,
  seed: number
): DailyExtraction[] {
  const dates = getPastDates(30);
  const rand = seededRand(seed);
  return dates.map((date) => ({
    date,
    liters: Math.max(0, Math.round(base + (rand() - 0.5) * 2 * variance)),
  }));
}

function generateRainfall(seed: number): RainfallForecast[] {
  const dates = getFutureDates(7);
  const rand = seededRand(seed * 17);
  return dates.map((date) => ({
    date,
    mm: parseFloat((rand() * 25).toFixed(1)),
    probability: Math.round(rand() * 100),
  }));
}

// ── Zone definitions ──────────────────────────────────────────────────────────
// Each zone has a base lat/lng; sensors inside are offset by tiny deltas (~300 m–1.5 km apart)
//
//  Zone A — Tiruppur Textile Industrial Estate    (6 sensors)
//  Zone B — Coimbatore SIPCOT Industrial Park     (6 sensors)
//  Zone C — Chennai Ambattur Industrial Estate    (7 sensors)
//  Zone D — Madurai Kappalur Industrial Area      (5 sensors)
// ─────────────────────────────────────────────────────────────────────────────

export const SENSOR_ZONES = [
  { id: 'A', label: 'Tiruppur Textile Estate',         lat: 11.108, lng: 77.343, color: '#38bdf8' },
  { id: 'B', label: 'Coimbatore SIPCOT Park',          lat: 11.022, lng: 76.960, color: '#a78bfa' },
  { id: 'C', label: 'Chennai Ambattur Industrial Estate', lat: 13.094, lng: 80.162, color: '#fb923c' },
  { id: 'D', label: 'Madurai Kappalur Industrial Area', lat: 9.930,  lng: 78.122, color: '#34d399' },
];

export const industrySensors: IndustrySensor[] = [
  // ══════════════════════════════════════════════════════
  //  ZONE A — Tiruppur Textile Industrial Estate
  // ══════════════════════════════════════════════════════
  {
    id: 'TRP-01',
    name: 'Sensor TRP-01',
    industryName: 'Tiruppur Spinning Mills Ltd.',
    location: 'Zone A · Tiruppur',
    lat: 11.108,
    lng: 77.343,
    industryType: 'water_intensive',
    hasNOC: false,
    groundwaterLevel: 18.4,
    moisturePercentage: 22,
    dailyExtractions: generateExtractions(145000, 30000, 1001),
    rainfallForecast: generateRainfall(1001),
    todayExtraction: 148000,
  },
  {
    id: 'TRP-02',
    name: 'Sensor TRP-02',
    industryName: 'KPR Knit Wear Processing Unit',
    location: 'Zone A · Tiruppur',
    lat: 11.112,
    lng: 77.348,
    industryType: 'water_intensive',
    hasNOC: true,
    groundwaterLevel: 16.1,
    moisturePercentage: 25,
    dailyExtractions: generateExtractions(118000, 22000, 1002),
    rainfallForecast: generateRainfall(1002),
    todayExtraction: 121000,
  },
  {
    id: 'TRP-03',
    name: 'Sensor TRP-03',
    industryName: 'Texvalley Bleaching & Dyeing',
    location: 'Zone A · Tiruppur',
    lat: 11.104,
    lng: 77.351,
    industryType: 'water_intensive',
    hasNOC: true,
    groundwaterLevel: 19.7,
    moisturePercentage: 19,
    dailyExtractions: generateExtractions(135000, 18000, 1003),
    rainfallForecast: generateRainfall(1003),
    todayExtraction: 142000,
  },
  {
    id: 'TRP-04',
    name: 'Sensor TRP-04',
    industryName: 'Prem Knits Export House',
    location: 'Zone A · Tiruppur',
    lat: 11.116,
    lng: 77.339,
    industryType: 'small_micro',
    hasNOC: true,
    groundwaterLevel: 11.2,
    moisturePercentage: 34,
    dailyExtractions: generateExtractions(8800, 1900, 1004),
    rainfallForecast: generateRainfall(1004),
    todayExtraction: 9100,
  },
  {
    id: 'TRP-05',
    name: 'Sensor TRP-05',
    industryName: 'Ace Garments Processing',
    location: 'Zone A · Tiruppur',
    lat: 11.101,
    lng: 77.345,
    industryType: 'water_intensive',
    hasNOC: false,
    groundwaterLevel: 21.3,
    moisturePercentage: 16,
    dailyExtractions: generateExtractions(128000, 25000, 1005),
    rainfallForecast: generateRainfall(1005),
    todayExtraction: 133000,
  },
  {
    id: 'TRP-06',
    name: 'Sensor TRP-06',
    industryName: 'Frontier Hosiery Mills',
    location: 'Zone A · Tiruppur',
    lat: 11.119,
    lng: 77.355,
    industryType: 'small_micro',
    hasNOC: true,
    groundwaterLevel: 10.5,
    moisturePercentage: 38,
    dailyExtractions: generateExtractions(7200, 1600, 1006),
    rainfallForecast: generateRainfall(1006),
    todayExtraction: 6900,
  },

  // ══════════════════════════════════════════════════════
  //  ZONE B — Coimbatore SIPCOT Industrial Park
  // ══════════════════════════════════════════════════════
  {
    id: 'CBE-01',
    name: 'Sensor CBE-01',
    industryName: 'Coimbatore Precision Engineering Co.',
    location: 'Zone B · Coimbatore',
    lat: 11.022,
    lng: 76.960,
    industryType: 'small_micro',
    hasNOC: true,
    groundwaterLevel: 9.8,
    moisturePercentage: 45,
    dailyExtractions: generateExtractions(7500, 2000, 2001),
    rainfallForecast: generateRainfall(2001),
    todayExtraction: 7200,
  },
  {
    id: 'CBE-02',
    name: 'Sensor CBE-02',
    industryName: 'Roots Industries Pump Works',
    location: 'Zone B · Coimbatore',
    lat: 11.027,
    lng: 76.966,
    industryType: 'small_micro',
    hasNOC: true,
    groundwaterLevel: 8.4,
    moisturePercentage: 49,
    dailyExtractions: generateExtractions(9100, 2200, 2002),
    rainfallForecast: generateRainfall(2002),
    todayExtraction: 8700,
  },
  {
    id: 'CBE-03',
    name: 'Sensor CBE-03',
    industryName: 'Kgisl Electronics Assembly',
    location: 'Zone B · Coimbatore',
    lat: 11.017,
    lng: 76.956,
    industryType: 'small_micro',
    hasNOC: false,
    groundwaterLevel: 12.6,
    moisturePercentage: 41,
    dailyExtractions: generateExtractions(11200, 2500, 2003),
    rainfallForecast: generateRainfall(2003),
    todayExtraction: 11800,
  },
  {
    id: 'CBE-04',
    name: 'Sensor CBE-04',
    industryName: 'Lakshmi Machine Works Ltd.',
    location: 'Zone B · Coimbatore',
    lat: 11.030,
    lng: 76.952,
    industryType: 'water_intensive',
    hasNOC: true,
    groundwaterLevel: 15.2,
    moisturePercentage: 30,
    dailyExtractions: generateExtractions(92000, 14000, 2004),
    rainfallForecast: generateRainfall(2004),
    todayExtraction: 88000,
  },
  {
    id: 'CBE-05',
    name: 'Sensor CBE-05',
    industryName: 'Pricol Auto Parts Plant',
    location: 'Zone B · Coimbatore',
    lat: 11.013,
    lng: 76.970,
    industryType: 'small_micro',
    hasNOC: true,
    groundwaterLevel: 7.9,
    moisturePercentage: 52,
    dailyExtractions: generateExtractions(6400, 1400, 2005),
    rainfallForecast: generateRainfall(2005),
    todayExtraction: 5800,
  },
  {
    id: 'CBE-06',
    name: 'Sensor CBE-06',
    industryName: 'Sakthi Beverages & Cold Chain',
    location: 'Zone B · Coimbatore',
    lat: 11.035,
    lng: 76.963,
    industryType: 'water_intensive',
    hasNOC: true,
    groundwaterLevel: 17.4,
    moisturePercentage: 26,
    dailyExtractions: generateExtractions(108000, 16000, 2006),
    rainfallForecast: generateRainfall(2006),
    todayExtraction: 114000,
  },

  // ══════════════════════════════════════════════════════
  //  ZONE C — Chennai Ambattur Industrial Estate
  // ══════════════════════════════════════════════════════
  {
    id: 'CHN-01',
    name: 'Sensor CHN-01',
    industryName: 'Chennai Chemical & Pharma Ltd.',
    location: 'Zone C · Ambattur, Chennai',
    lat: 13.094,
    lng: 80.162,
    industryType: 'water_intensive',
    hasNOC: false,
    groundwaterLevel: 25.3,
    moisturePercentage: 14,
    dailyExtractions: generateExtractions(95000, 15000, 3001),
    rainfallForecast: generateRainfall(3001),
    todayExtraction: 97000,
  },
  {
    id: 'CHN-02',
    name: 'Sensor CHN-02',
    industryName: 'Ashok Leyland Assembly Plant',
    location: 'Zone C · Ambattur, Chennai',
    lat: 13.100,
    lng: 80.168,
    industryType: 'water_intensive',
    hasNOC: true,
    groundwaterLevel: 23.8,
    moisturePercentage: 17,
    dailyExtractions: generateExtractions(112000, 18000, 3002),
    rainfallForecast: generateRainfall(3002),
    todayExtraction: 108000,
  },
  {
    id: 'CHN-03',
    name: 'Sensor CHN-03',
    industryName: 'India Pistons Engineering',
    location: 'Zone C · Ambattur, Chennai',
    lat: 13.088,
    lng: 80.158,
    industryType: 'small_micro',
    hasNOC: true,
    groundwaterLevel: 20.1,
    moisturePercentage: 21,
    dailyExtractions: generateExtractions(9200, 2100, 3003),
    rainfallForecast: generateRainfall(3003),
    todayExtraction: 9600,
  },
  {
    id: 'CHN-04',
    name: 'Sensor CHN-04',
    industryName: 'Hyundai Paint & Coating Unit',
    location: 'Zone C · Ambattur, Chennai',
    lat: 13.097,
    lng: 80.154,
    industryType: 'water_intensive',
    hasNOC: false,
    groundwaterLevel: 27.6,
    moisturePercentage: 11,
    dailyExtractions: generateExtractions(142000, 22000, 3004),
    rainfallForecast: generateRainfall(3004),
    todayExtraction: 151000,
  },
  {
    id: 'CHN-05',
    name: 'Sensor CHN-05',
    industryName: 'Rane Group Auto Components',
    location: 'Zone C · Ambattur, Chennai',
    lat: 13.104,
    lng: 80.173,
    industryType: 'small_micro',
    hasNOC: true,
    groundwaterLevel: 18.9,
    moisturePercentage: 24,
    dailyExtractions: generateExtractions(7800, 1700, 3005),
    rainfallForecast: generateRainfall(3005),
    todayExtraction: 8100,
  },
  {
    id: 'CHN-06',
    name: 'Sensor CHN-06',
    industryName: 'Saint-Gobain Glass Processing',
    location: 'Zone C · Ambattur, Chennai',
    lat: 13.083,
    lng: 80.166,
    industryType: 'water_intensive',
    hasNOC: true,
    groundwaterLevel: 22.5,
    moisturePercentage: 18,
    dailyExtractions: generateExtractions(78000, 13000, 3006),
    rainfallForecast: generateRainfall(3006),
    todayExtraction: 82000,
  },
  {
    id: 'CHN-07',
    name: 'Sensor CHN-07',
    industryName: 'Foxconn Electronics MFG',
    location: 'Zone C · Ambattur, Chennai',
    lat: 13.091,
    lng: 80.171,
    industryType: 'water_intensive',
    hasNOC: true,
    groundwaterLevel: 24.2,
    moisturePercentage: 15,
    dailyExtractions: generateExtractions(120000, 20000, 3007),
    rainfallForecast: generateRainfall(3007),
    todayExtraction: 116000,
  },

  // ══════════════════════════════════════════════════════
  //  ZONE D — Madurai Kappalur Industrial Area
  // ══════════════════════════════════════════════════════
  {
    id: 'MDU-01',
    name: 'Sensor MDU-01',
    industryName: 'Madurai Garment Exports Pvt.',
    location: 'Zone D · Kappalur, Madurai',
    lat: 9.930,
    lng: 78.122,
    industryType: 'water_intensive',
    hasNOC: true,
    groundwaterLevel: 16.7,
    moisturePercentage: 28,
    dailyExtractions: generateExtractions(108000, 18000, 4001),
    rainfallForecast: generateRainfall(4001),
    todayExtraction: 112000,
  },
  {
    id: 'MDU-02',
    name: 'Sensor MDU-02',
    industryName: 'Pandian Cement Works',
    location: 'Zone D · Kappalur, Madurai',
    lat: 9.937,
    lng: 78.128,
    industryType: 'water_intensive',
    hasNOC: false,
    groundwaterLevel: 19.4,
    moisturePercentage: 22,
    dailyExtractions: generateExtractions(135000, 24000, 4002),
    rainfallForecast: generateRainfall(4002),
    todayExtraction: 139000,
  },
  {
    id: 'MDU-03',
    name: 'Sensor MDU-03',
    industryName: 'Southern Petrochemicals Ltd.',
    location: 'Zone D · Kappalur, Madurai',
    lat: 9.923,
    lng: 78.116,
    industryType: 'water_intensive',
    hasNOC: true,
    groundwaterLevel: 14.8,
    moisturePercentage: 32,
    dailyExtractions: generateExtractions(88000, 12000, 4003),
    rainfallForecast: generateRainfall(4003),
    todayExtraction: 91000,
  },
  {
    id: 'MDU-04',
    name: 'Sensor MDU-04',
    industryName: 'Kappalur Agro Processing Unit',
    location: 'Zone D · Kappalur, Madurai',
    lat: 9.942,
    lng: 78.119,
    industryType: 'small_micro',
    hasNOC: true,
    groundwaterLevel: 10.3,
    moisturePercentage: 41,
    dailyExtractions: generateExtractions(8600, 2000, 4004),
    rainfallForecast: generateRainfall(4004),
    todayExtraction: 9000,
  },
  {
    id: 'MDU-05',
    name: 'Sensor MDU-05',
    industryName: 'Madurai Steel & Alloys',
    location: 'Zone D · Kappalur, Madurai',
    lat: 9.926,
    lng: 78.131,
    industryType: 'water_intensive',
    hasNOC: true,
    groundwaterLevel: 17.9,
    moisturePercentage: 26,
    dailyExtractions: generateExtractions(102000, 16000, 4005),
    rainfallForecast: generateRainfall(4005),
    todayExtraction: 98000,
  },
];

export const MAP_CENTER: [number, number] = [11.5, 78.2];
export const MAP_ZOOM = 7;
