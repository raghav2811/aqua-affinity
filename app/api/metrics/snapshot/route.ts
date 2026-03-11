import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 24), 168);
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const { data, error } = await db
    .from('metrics_snapshots')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ snapshots: (data ?? []).reverse() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const {
    totalSensors, sensorsActive, sensorsBlocked, sensorsStandby,
    avgGroundwaterLevelM, minGroundwaterLevelM, maxGroundwaterLevelM,
    totalFlowRateLpm, estDailyUsageLiters,
    avgSoilMoisturePct, avgTemperatureC,
    sensorsPumpOn, totalAlertsUnread,
  } = body;

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const { data, error } = await db
    .from('metrics_snapshots')
    .insert({
      total_sensors:             totalSensors,
      sensors_active:            sensorsActive,
      sensors_blocked:           sensorsBlocked,
      sensors_standby:           sensorsStandby,
      avg_groundwater_level_m:   avgGroundwaterLevelM,
      min_groundwater_level_m:   minGroundwaterLevelM,
      max_groundwater_level_m:   maxGroundwaterLevelM,
      total_flow_rate_lpm:       totalFlowRateLpm,
      est_daily_usage_liters:    estDailyUsageLiters,
      avg_soil_moisture_pct:     avgSoilMoisturePct,
      avg_temperature_c:         avgTemperatureC,
      sensors_pump_on:           sensorsPumpOn,
      total_alerts_unread:       totalAlertsUnread,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ snapshot: data }, { status: 201 });
}
