import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { pushSensorReading, updateSprinklerState, insertFarmerAlert } from '@/lib/supabaseQueries';
import { evaluateWaterLevel, DEFAULT_CRITICAL_DEPTH, DEFAULT_SAFE_DEPTH } from '@/lib/sensorMonitor';
import { VRSensor } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      sensorId: string;
      values: {
        groundwaterLevel: number;
        soilMoisture:     number;
        waterFlowRate:    number;
        pumpStatus:       'on' | 'off';
        temperature:      number;
        ph:               number;
        turbidity:        number;
        batteryLevel:     number;
        signalStrength:   number;
      };
    };

    const { sensorId, values } = body;

    // Basic input validation
    if (!sensorId || typeof values !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    if (
      typeof values.groundwaterLevel !== 'number' ||
      values.groundwaterLevel < 0 || values.groundwaterLevel > 100
    ) {
      return NextResponse.json({ error: 'groundwaterLevel out of range' }, { status: 422 });
    }

    // 1. Persist the simulated reading
    await pushSensorReading(sensorId, values);

    // 2. Fetch sensor metadata (thresholds + display fields) from Supabase
    const db = getSupabase();
    let criticalDepth = DEFAULT_CRITICAL_DEPTH;
    let safeDepth     = DEFAULT_SAFE_DEPTH;
    let farmerName    = 'Farmer';
    let cropType      = 'Crop';
    let sensorName    = sensorId;

    if (db) {
      const { data } = await db
        .from('vr_sensors')
        .select('critical_depth_threshold, safe_depth_threshold, farmer_name, crop_type, name')
        .eq('id', sensorId)
        .single();

      if (data) {
        criticalDepth = data.critical_depth_threshold ?? DEFAULT_CRITICAL_DEPTH;
        safeDepth     = data.safe_depth_threshold     ?? DEFAULT_SAFE_DEPTH;
        farmerName    = data.farmer_name ?? farmerName;
        cropType      = data.crop_type  ?? cropType;
        sensorName    = data.name       ?? sensorName;
      }
    }

    // 3. Build a minimal VRSensor shape for the pure evaluation function
    const patchedSensor: Pick<VRSensor,
      | 'id' | 'name' | 'farmerName' | 'cropType'
      | 'criticalDepthThreshold' | 'safeDepthThreshold'
      | 'currentReading'
    > & Partial<VRSensor> = {
      id:                     sensorId,
      name:                   sensorName,
      farmerName,
      cropType,
      criticalDepthThreshold: criticalDepth,
      safeDepthThreshold:     safeDepth,
      currentReading: {
        timestamp:        new Date().toISOString(),
        groundwaterLevel: values.groundwaterLevel,
        soilMoisture:     values.soilMoisture,
        waterFlowRate:    values.waterFlowRate,
        pumpStatus:       values.pumpStatus,
        temperature:      values.temperature,
        ph:               values.ph,
        turbidity:        values.turbidity,
        batteryLevel:     values.batteryLevel,
        signalStrength:   values.signalStrength,
      },
    };

    // 4. Evaluate decision
    const evaluation = evaluateWaterLevel(patchedSensor as VRSensor);
    const now        = new Date().toISOString();

    // 5. Persist new sprinkler state
    await updateSprinklerState(sensorId, evaluation.state, now);

    // 6. Persist alert if warranted
    if (evaluation.shouldAlert) {
      await insertFarmerAlert({
        id:           `${sensorId}-sim-${Date.now()}`,
        sensorId,
        timestamp:    now,
        level:        evaluation.alertLevel,
        message:      evaluation.message,
        acknowledged: false,
      });
    }

    return NextResponse.json({
      success:          true,
      newSprinklerState: evaluation.state,
      shouldAlert:      evaluation.shouldAlert,
      alertLevel:       evaluation.alertLevel,
      message:          evaluation.message,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/simulate] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
