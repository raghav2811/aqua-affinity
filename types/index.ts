export type IndustryType = 'small_micro' | 'water_intensive';
export type UserType = 'industry' | 'farmer' | 'blockchain';
export type SensorStatus = 'normal' | 'warning' | 'critical' | 'no_noc';

export interface DailyExtraction {
  date: string;
  liters: number;
}

export interface RainfallForecast {
  date: string;
  mm: number;
  probability: number;
}

export interface IndustrySensor {
  id: string;
  name: string;
  industryName: string;
  location: string;
  lat: number;
  lng: number;
  industryType: IndustryType;
  hasNOC: boolean;
  groundwaterLevel: number; // meters below ground
  moisturePercentage: number;
  dailyExtractions: DailyExtraction[]; // last 30 days
  rainfallForecast: RainfallForecast[]; // next 7 days
  todayExtraction: number; // liters
}

export interface FarmerSensor {
  id: string;
  name: string;
  farmerName: string;
  location: string;
  lat: number;
  lng: number;
  cropType: string;
  groundwaterLevel: number;
  moisturePercentage: number;
  dailyExtractions: DailyExtraction[];
  rainfallForecast: RainfallForecast[];
}

export interface FineDetail {
  date: string;
  liters: number;
  limit: number;
  excess: number;
  fine: number;
}

export interface FineResult {
  status: SensorStatus;
  dailyLimit: number;
  finePerDay: number;
  daysExceeded: number;
  totalFine30Days: number;
  exceedanceDays: FineDetail[];
  nocAnnualFine?: number;
  nocFineCategory?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  VR Sensor / Farmer types
// ─────────────────────────────────────────────────────────────────────────────

export type AlertLevel    = 'info' | 'warning' | 'critical';
export type SprinklerState = 'active' | 'blocked' | 'standby';

/**
 * Single timestamped payload pushed by each VR sensor.
 * All 5 sensors in the VR world must send this exact shape once per hour
 * (or on-demand). Fields marked [required] are needed for the sprinkler
 * decision engine; the others feed the analytics dashboard.
 */
export interface SensorReading {
  timestamp: string;           // ISO 8601 — when the reading was taken [required]

  // --- Groundwater -----------------------------------------------------------
  groundwaterLevel: number;    // metres below ground surface              [required]
  soilMoisture: number;        // 0–100 % volumetric water content         [required]

  // --- Hydraulics ------------------------------------------------------------
  waterFlowRate: number;       // litres / minute — current extraction rate
  pumpStatus: 'on' | 'off';   // is the pump currently running?

  // --- Environment -----------------------------------------------------------
  temperature: number;         // °C — air/ground temperature
  ph: number;                  // 6.5–8.5 — groundwater pH
  turbidity: number;           // NTU — water clarity (0 = crystal clear)

  // --- Sensor health ---------------------------------------------------------
  batteryLevel: number;        // 0–100 %
  signalStrength: number;      // 0–100 %  (LoRa / Wi-Fi RSSI normalised)
}

export interface FarmerAlert {
  id: string;
  sensorId: string;
  timestamp: string;
  level: AlertLevel;
  message: string;
  acknowledged: boolean;
}

export interface VRSensor {
  id: string;                          // e.g. "VRS-01"
  name: string;
  farmerName: string;
  location: string;
  lat: number;
  lng: number;
  cropType: string;
  fieldAreaHectares: number;

  /** If groundwaterLevel EXCEEDS this → water is LOW → block sprinkler + alert */
  criticalDepthThreshold: number;      // metres

  /** If groundwaterLevel is BELOW this → water is HIGH → activate sprinkler */
  safeDepthThreshold: number;          // metres

  currentReading: SensorReading;
  hourlyHistory: SensorReading[];      // last 24 readings
  sprinklerState: SprinklerState;
  lastChecked: string;                 // ISO timestamp of last hourly check
  alerts: FarmerAlert[];
}
