import { VRSensor, FarmerAlert, SprinklerState, AlertLevel } from '@/types';

// ── Decision thresholds (metres below ground) ─────────────────────────────────
//   The sensor's own criticalDepthThreshold / safeDepthThreshold are used per-
//   sensor, but these are the platform defaults applied when custom values
//   are not set.
export const DEFAULT_CRITICAL_DEPTH = 12;  // > 12 m  → water LOW  → block + alert
export const DEFAULT_SAFE_DEPTH = 8;       // < 8  m  → water HIGH → sprinkle

// ─────────────────────────────────────────────────────────────────────────────
//  evaluate — pure decision: given a sensor, what should happen?
// ─────────────────────────────────────────────────────────────────────────────
export function evaluateWaterLevel(sensor: VRSensor): {
  state: SprinklerState;
  shouldAlert: boolean;
  alertLevel: AlertLevel;
  message: string;
} {
  const level    = sensor.currentReading.groundwaterLevel;
  const critical = sensor.criticalDepthThreshold ?? DEFAULT_CRITICAL_DEPTH;
  const safe     = sensor.safeDepthThreshold     ?? DEFAULT_SAFE_DEPTH;

  if (level > critical) {
    // Water table is dangerously deep — aquifer being depleted
    return {
      state: 'blocked',
      shouldAlert: true,
      alertLevel: 'critical',
      message:
        `🚨 [${sensor.id}] Groundwater critically LOW at ${level.toFixed(1)} m depth. ` +
        `Sprinkler BLOCKED. Do NOT irrigate. Contact your Block Agriculture Officer. ` +
        `Crop: ${sensor.cropType} · Farmer: ${sensor.farmerName}`,
    };
  }

  if (level > safe) {
    // Warning zone — between safe and critical (always alert so emails are sent)
    return {
      state: 'standby',
      shouldAlert: true,
      alertLevel: 'warning',
      message:
        `⚠️ [${sensor.id}] Groundwater at ${level.toFixed(1)} m — approaching critical zone. ` +
        `Sprinkler on STANDBY. Schedule irrigation carefully. ` +
        `Crop: ${sensor.cropType} · Farmer: ${sensor.farmerName}`,
    };
  }

  // Water table is healthy — safe to irrigate
  return {
    state: 'active',
    shouldAlert: false,
    alertLevel: 'info',
    message:
      `✅ [${sensor.id}] Groundwater level healthy at ${level.toFixed(1)} m. ` +
      `Sprinkler ACTIVATED. Happy irrigating! ` +
      `Crop: ${sensor.cropType} · Farmer: ${sensor.farmerName}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  runHourlyCheck — called once per hour for all 5 VR sensors
//  Returns updated sensor array with:
//    • sprinklerState adjusted
//    • lastChecked updated
//    • new alerts prepended (max 10 kept per sensor)
// ─────────────────────────────────────────────────────────────────────────────
export function runHourlyCheck(sensors: VRSensor[]): VRSensor[] {
  const now = new Date().toISOString();

  return sensors.map((sensor) => {
    const evaluation = evaluateWaterLevel(sensor);

    // Build new alert if this check warrants one
    const newAlerts: FarmerAlert[] = [...sensor.alerts];
    if (evaluation.shouldAlert) {
      const newAlert: FarmerAlert = {
        id: `${sensor.id}-chk-${Date.now()}`,
        sensorId: sensor.id,
        timestamp: now,
        level: evaluation.alertLevel,
        message: evaluation.message,
        acknowledged: false,
      };
      newAlerts.unshift(newAlert);
    }

    return {
      ...sensor,
      sprinklerState: evaluation.state,
      lastChecked: now,
      alerts: newAlerts.slice(0, 10), // keep only the 10 most recent alerts
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  acknowledgeAlert — marks a specific alert as read on a sensor
// ─────────────────────────────────────────────────────────────────────────────
export function acknowledgeAlert(
  sensors: VRSensor[],
  sensorId: string,
  alertId: string
): VRSensor[] {
  return sensors.map((sensor) => {
    if (sensor.id !== sensorId) return sensor;
    return {
      ...sensor,
      alerts: sensor.alerts.map((a) =>
        a.id === alertId ? { ...a, acknowledged: true } : a
      ),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  getSprinklerLabel / getSprinklerColor — UI helpers
// ─────────────────────────────────────────────────────────────────────────────
export function getSprinklerLabel(state: SprinklerState): string {
  switch (state) {
    case 'active':  return 'Sprinkler Active';
    case 'blocked': return 'Sprinkler Blocked';
    case 'standby': return 'Sprinkler Standby';
  }
}

export function getSprinklerColor(state: SprinklerState): string {
  switch (state) {
    case 'active':  return '#22c55e';   // green
    case 'blocked': return '#ef4444';   // red
    case 'standby': return '#f59e0b';   // amber
  }
}

export function getWaterLevelLabel(sensor: VRSensor): string {
  const level    = sensor.currentReading.groundwaterLevel;
  const critical = sensor.criticalDepthThreshold;
  const safe     = sensor.safeDepthThreshold;

  if (level > critical) return 'Critically Low';
  if (level > safe)     return 'Warning Zone';
  return 'Healthy';
}

export function getWaterLevelColor(sensor: VRSensor): string {
  const level    = sensor.currentReading.groundwaterLevel;
  const critical = sensor.criticalDepthThreshold;
  const safe     = sensor.safeDepthThreshold;

  if (level > critical) return '#ef4444';
  if (level > safe)     return '#f59e0b';
  return '#22c55e';
}

// ── Format countdown seconds → "HH:MM:SS" ────────────────────────────────────
export function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}
