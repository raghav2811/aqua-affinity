import { getSupabase } from './supabase';
import { IndustrySensor, VRSensor, SensorReading, FarmerAlert, DailyExtraction, RainfallForecast } from '@/types';
import { industrySensors as staticIndustrySensors } from './data';
import { vrSensors as staticVRSensors }              from './farmerSensors';

// ─────────────────────────────────────────────────────────────────────────────
//  INDUSTRY SENSORS
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchIndustrySensors(): Promise<IndustrySensor[]> {
  const db = getSupabase();
  if (!db) return staticIndustrySensors;    // fallback when Supabase not configured

  try {
    const { data, error } = await db
      .from('industry_sensors')
      .select(`
        *,
        daily_extractions (date, liters),
        rainfall_forecasts (date, mm, probability)
      `);

    if (error) {
      console.warn('[fetchIndustrySensors] DB error, using static fallback:', error.message);
      return staticIndustrySensors;
    }
    if (!data || data.length === 0) return staticIndustrySensors;

    return data.map((row) => ({
    id:                  row.id,
    name:                row.name,
    industryName:        row.industry_name,
    location:            row.location,
    lat:                 row.lat,
    lng:                 row.lng,
    industryType:        row.industry_type,
    hasNOC:              row.has_noc,
    groundwaterLevel:    row.groundwater_level,
    moisturePercentage:  row.moisture_percentage,
    todayExtraction:     row.today_extraction,
    dailyExtractions:    (row.daily_extractions as DailyExtraction[])
                           .slice()
                           .sort((a, b) => a.date.localeCompare(b.date)),
    rainfallForecast:    (row.rainfall_forecasts as RainfallForecast[])
                           .slice()
                           .sort((a, b) => a.date.localeCompare(b.date)),
    }));
  } catch (err) {
    console.warn('[fetchIndustrySensors] unexpected error, using static fallback:', err);
    return staticIndustrySensors;
  }
}

/** Upsert a single industry sensor's live readings (groundwater, moisture, today_extraction) */
export async function updateIndustrySensorReading(
  sensorId: string,
  patch: { groundwaterLevel: number; moisturePercentage: number; todayExtraction: number }
): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db
    .from('industry_sensors')
    .update({
      groundwater_level:   patch.groundwaterLevel,
      moisture_percentage: patch.moisturePercentage,
      today_extraction:    patch.todayExtraction,
    })
    .eq('id', sensorId);
  if (error) throw new Error(`updateIndustrySensorReading: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  VR / FARMER SENSORS
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchVRSensors(): Promise<VRSensor[]> {
  const db = getSupabase();
  if (!db) return staticVRSensors;          // fallback when Supabase not configured

  try {
    // 1. Main sensor rows
    const { data: sensors, error: sErr } = await db
      .from('vr_sensors')
      .select('*');
    if (sErr) {
      console.warn('[fetchVRSensors] DB error, using static fallback:', sErr.message);
      return staticVRSensors;
    }

    const sensorIds = (sensors ?? []).map((s) => s.id as string);
    if (sensorIds.length === 0) return staticVRSensors;

    // 2. Last 25 hours of readings (enough for "latest" + 24h history)
    const since = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const { data: readings, error: rErr } = await db
      .from('sensor_readings')
      .select('*')
      .in('sensor_id', sensorIds)
      .gte('timestamp', since)
      .order('timestamp', { ascending: false });
    if (rErr) {
      console.warn('[fetchVRSensors] readings error, using static fallback:', rErr.message);
      return staticVRSensors;
    }

    // 3. All alerts for these sensors (most recent first)
    const { data: alerts, error: aErr } = await db
      .from('farmer_alerts')
      .select('*')
      .in('sensor_id', sensorIds)
      .order('timestamp', { ascending: false });
    if (aErr) {
      console.warn('[fetchVRSensors] alerts error, continuing without alerts:', aErr.message);
    }

    return (sensors ?? []).map((sensor) => {
    const sReadings = (readings ?? []).filter((r) => r.sensor_id === sensor.id);
    const current   = sReadings[0] ?? null;
    const history   = sReadings.slice(0, 24);
    const sAlerts   = (alerts ?? []).filter((a) => a.sensor_id === sensor.id);

    return {
      id:                      sensor.id,
      name:                    sensor.name,
      farmerName:              sensor.farmer_name,
      location:                sensor.location,
      lat:                     sensor.lat,
      lng:                     sensor.lng,
      cropType:                sensor.crop_type,
      fieldAreaHectares:       sensor.field_area_hectares,
      criticalDepthThreshold:  sensor.critical_depth_threshold,
      safeDepthThreshold:      sensor.safe_depth_threshold,
      sprinklerState:          sensor.sprinkler_state,
      lastChecked:             sensor.last_checked,
      currentReading:          current ? mapReading(current) : null,
      hourlyHistory:           history.map(mapReading),
      alerts:                  sAlerts.map(mapAlert).slice(0, 10),
      } as VRSensor;
    });
  } catch (err) {
    console.warn('[fetchVRSensors] unexpected error, using static fallback:', err);
    return staticVRSensors;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  VR SENSOR WRITE OPERATIONS  (called by VR world pushes + hourly check)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called when a VR sensor pushes a new hourly reading.
 * Inserts one row into sensor_readings.
 */
export async function pushSensorReading(
  sensorId: string,
  reading: Omit<SensorReading, 'timestamp'>
): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db.from('sensor_readings').insert({
    sensor_id:         sensorId,
    timestamp:         new Date().toISOString(),
    groundwater_level: reading.groundwaterLevel,
    soil_moisture:     reading.soilMoisture,
    water_flow_rate:   reading.waterFlowRate,
    pump_status:       reading.pumpStatus,
    temperature:       reading.temperature,
    ph:                reading.ph,
    turbidity:         reading.turbidity,
    battery_level:     reading.batteryLevel,
    signal_strength:   reading.signalStrength,
  });
  if (error) throw new Error(`pushSensorReading: ${error.message}`);
}

/**
 * After each hourly check, persist the new sprinkler state + last_checked.
 */
export async function updateSprinklerState(
  sensorId: string,
  sprinklerState: string,
  lastChecked: string
): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db
    .from('vr_sensors')
    .update({ sprinkler_state: sprinklerState, last_checked: lastChecked })
    .eq('id', sensorId);
  if (error) throw new Error(`updateSprinklerState: ${error.message}`);
}

/**
 * Persist a new farmer alert (called by runHourlyCheck when water level is low).
 */
export async function insertFarmerAlert(alert: FarmerAlert): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db.from('farmer_alerts').insert({
    id:           alert.id,
    sensor_id:    alert.sensorId,
    timestamp:    alert.timestamp,
    level:        alert.level,
    message:      alert.message,
    acknowledged: alert.acknowledged,
  });
  if (error) throw new Error(`insertFarmerAlert: ${error.message}`);
}

/**
 * Mark a specific alert as read in the database.
 */
export async function acknowledgeAlertInDB(alertId: string): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db
    .from('farmer_alerts')
    .update({ acknowledged: true })
    .eq('id', alertId);
  if (error) throw new Error(`acknowledgeAlertInDB: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function mapReading(r: Record<string, unknown>): SensorReading {
  return {
    timestamp:        r.timestamp as string,
    groundwaterLevel: r.groundwater_level as number,
    soilMoisture:     r.soil_moisture as number,
    waterFlowRate:    r.water_flow_rate as number,
    pumpStatus:       r.pump_status as 'on' | 'off',
    temperature:      r.temperature as number,
    ph:               r.ph as number,
    turbidity:        r.turbidity as number,
    batteryLevel:     r.battery_level as number,
    signalStrength:   r.signal_strength as number,
  };
}

function mapAlert(a: Record<string, unknown>): FarmerAlert {
  return {
    id:           a.id as string,
    sensorId:     a.sensor_id as string,
    timestamp:    a.timestamp as string,
    level:        a.level as FarmerAlert['level'],
    message:      a.message as string,
    acknowledged: a.acknowledged as boolean,
  };
}
