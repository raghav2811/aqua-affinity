import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { industrySensors } from '@/lib/data';
import { vrSensors }        from '@/lib/farmerSensors';

/**
 * POST /api/seed
 * One-time endpoint to populate all Supabase tables with the static starter data.
 * Run once after applying supabase/schema.sql.
 *
 * Example:  curl -X POST http://localhost:3000/api/seed
 *
 * ⚠️  Remove or protect this route before deploying to production.
 */
export async function POST() {
  // Use service-role key if set; fall back to anon (fine for local dev)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key         = process.env.SUPABASE_SERVICE_ROLE_KEY
                   ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !key) {
    return NextResponse.json(
      { success: false, errors: ['Supabase credentials not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local'] },
      { status: 503 }
    );
  }

  const db = createClient(supabaseUrl, key);

  const errors: string[] = [];

  // ── 1. Industry sensors ──────────────────────────────────────────────────
  const sensorRows = industrySensors.map((s) => ({
    id:                  s.id,
    name:                s.name,
    industry_name:       s.industryName,
    location:            s.location,
    lat:                 s.lat,
    lng:                 s.lng,
    industry_type:       s.industryType,
    has_noc:             s.hasNOC,
    groundwater_level:   s.groundwaterLevel,
    moisture_percentage: s.moisturePercentage,
    today_extraction:    s.todayExtraction,
    zone_id:             s.id.split('-')[0],        // e.g. "TRP", "CBE"
  }));

  const { error: sensErr } = await db
    .from('industry_sensors')
    .upsert(sensorRows, { onConflict: 'id' });
  if (sensErr) errors.push(`industry_sensors: ${sensErr.message}`);

  // ── 2. Daily extractions ─────────────────────────────────────────────────
  const extractionRows = industrySensors.flatMap((s) =>
    s.dailyExtractions.map((e) => ({
      sensor_id: s.id,
      date:      e.date,
      liters:    e.liters,
    }))
  );

  const { error: extErr } = await db
    .from('daily_extractions')
    .upsert(extractionRows, { onConflict: 'sensor_id,date' });
  if (extErr) errors.push(`daily_extractions: ${extErr.message}`);

  // ── 3. Rainfall forecasts ────────────────────────────────────────────────
  const rainfallRows = industrySensors.flatMap((s) =>
    s.rainfallForecast.map((f) => ({
      sensor_id:   s.id,
      date:        f.date,
      mm:          f.mm,
      probability: f.probability,
    }))
  );

  const { error: rfErr } = await db
    .from('rainfall_forecasts')
    .upsert(rainfallRows, { onConflict: 'sensor_id,date' });
  if (rfErr) errors.push(`rainfall_forecasts: ${rfErr.message}`);

  // ── 4. VR sensors ────────────────────────────────────────────────────────
  const vrRows = vrSensors.map((s) => ({
    id:                       s.id,
    name:                     s.name,
    farmer_name:              s.farmerName,
    location:                 s.location,
    lat:                      s.lat,
    lng:                      s.lng,
    crop_type:                s.cropType,
    field_area_hectares:      s.fieldAreaHectares,
    critical_depth_threshold: s.criticalDepthThreshold,
    safe_depth_threshold:     s.safeDepthThreshold,
    sprinkler_state:          s.sprinklerState,
    last_checked:             s.lastChecked,
  }));

  const { error: vrErr } = await db
    .from('vr_sensors')
    .upsert(vrRows, { onConflict: 'id' });
  if (vrErr) errors.push(`vr_sensors: ${vrErr.message}`);

  // ── 5. Sensor readings (24h hourly history per VR sensor) ────────────────
  const readingRows = vrSensors.flatMap((s) =>
    s.hourlyHistory.map((r) => ({
      sensor_id:         s.id,
      timestamp:         r.timestamp,
      groundwater_level: r.groundwaterLevel,
      soil_moisture:     r.soilMoisture,
      water_flow_rate:   r.waterFlowRate,
      pump_status:       r.pumpStatus,
      temperature:       r.temperature,
      ph:                r.ph,
      turbidity:         r.turbidity,
      battery_level:     r.batteryLevel,
      signal_strength:   r.signalStrength,
    }))
  );

  // Also insert the "current" reading for each sensor
  vrSensors.forEach((s) => {
    readingRows.push({
      sensor_id:         s.id,
      timestamp:         s.currentReading.timestamp,
      groundwater_level: s.currentReading.groundwaterLevel,
      soil_moisture:     s.currentReading.soilMoisture,
      water_flow_rate:   s.currentReading.waterFlowRate,
      pump_status:       s.currentReading.pumpStatus,
      temperature:       s.currentReading.temperature,
      ph:                s.currentReading.ph,
      turbidity:         s.currentReading.turbidity,
      battery_level:     s.currentReading.batteryLevel,
      signal_strength:   s.currentReading.signalStrength,
    });
  });

  const { error: rdErr } = await db
    .from('sensor_readings')
    .insert(readingRows);
  if (rdErr) errors.push(`sensor_readings: ${rdErr.message}`);

  // ── 6. Farmer alerts ─────────────────────────────────────────────────────
  const alertRows = vrSensors.flatMap((s) =>
    s.alerts.map((a) => ({
      id:           a.id,
      sensor_id:    a.sensorId,
      timestamp:    a.timestamp,
      level:        a.level,
      message:      a.message,
      acknowledged: a.acknowledged,
    }))
  );

  if (alertRows.length > 0) {
    const { error: alErr } = await db
      .from('farmer_alerts')
      .upsert(alertRows, { onConflict: 'id' });
    if (alErr) errors.push(`farmer_alerts: ${alErr.message}`);
  }

  // ── Result ───────────────────────────────────────────────────────────────
  if (errors.length > 0) {
    return NextResponse.json(
      { success: false, errors },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    seeded: {
      industry_sensors:   sensorRows.length,
      daily_extractions:  extractionRows.length,
      rainfall_forecasts: rainfallRows.length,
      vr_sensors:         vrRows.length,
      sensor_readings:    readingRows.length,
      farmer_alerts:      alertRows.length,
    },
  });
}
