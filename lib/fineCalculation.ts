import { IndustrySensor, FineDetail, FineResult, SensorStatus } from '@/types';

const DAILY_LIMITS: Record<string, number> = {
  small_micro: 10000,       // 10,000 litres/day
  water_intensive: 100000,  // 100 KLD = 100,000 litres/day
};

const DAILY_FINES: Record<string, number> = {
  small_micro: 500,         // ₹500/day
  water_intensive: 5000,    // ₹5,000/day
};

// NOC annual fine tiers based on average daily extraction
function getNOCFine(avgDailyLitres: number): { fine: number; category: string } {
  if (avgDailyLitres < 30000) {
    return { fine: 200000, category: 'Low Extraction (<30 KLD)' };
  } else if (avgDailyLitres < 70000) {
    return { fine: 500000, category: 'Medium Extraction (30–70 KLD)' };
  } else if (avgDailyLitres < 120000) {
    return { fine: 700000, category: 'High Extraction (70–120 KLD)' };
  } else {
    return { fine: 1000000, category: 'Very High Extraction (>120 KLD)' };
  }
}

export function calculateFine(sensor: IndustrySensor): FineResult {
  const limit = DAILY_LIMITS[sensor.industryType];
  const finePerDay = DAILY_FINES[sensor.industryType];

  const exceedanceDays: FineDetail[] = sensor.dailyExtractions
    .filter((d) => d.liters > limit)
    .map((d) => ({
      date: d.date,
      liters: d.liters,
      limit,
      excess: d.liters - limit,
      fine: finePerDay,
    }));

  const totalFine30Days = exceedanceDays.length * finePerDay;

  // Determine status
  const todayPct = (sensor.todayExtraction / limit) * 100;
  let status: SensorStatus;

  if (!sensor.hasNOC) {
    status = 'no_noc';
  } else if (sensor.todayExtraction > limit) {
    status = 'critical';
  } else if (todayPct >= 80) {
    status = 'warning';
  } else {
    status = 'normal';
  }

  let nocAnnualFine: number | undefined;
  let nocFineCategory: string | undefined;

  if (!sensor.hasNOC) {
    const avgDaily =
      sensor.dailyExtractions.reduce((s, d) => s + d.liters, 0) /
      sensor.dailyExtractions.length;
    const result = getNOCFine(avgDaily);
    nocAnnualFine = result.fine;
    nocFineCategory = result.category;
  }

  return {
    status,
    dailyLimit: limit,
    finePerDay,
    daysExceeded: exceedanceDays.length,
    totalFine30Days,
    exceedanceDays,
    nocAnnualFine,
    nocFineCategory,
  };
}

export function formatLitres(litres: number): string {
  if (litres >= 1000000) return `${(litres / 1000000).toFixed(2)} MLD`;
  if (litres >= 1000) return `${(litres / 1000).toFixed(1)} KLD`;
  return `${litres.toLocaleString('en-IN')} L`;
}

export function formatINR(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} Lakhs`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function getStatusColor(status: SensorStatus): string {
  switch (status) {
    case 'normal':   return '#22c55e';
    case 'warning':  return '#f59e0b';
    case 'critical': return '#ef4444';
    case 'no_noc':   return '#8b5cf6';
  }
}

export function getStatusLabel(status: SensorStatus): string {
  switch (status) {
    case 'normal':   return 'Within Limits';
    case 'warning':  return 'Approaching Limit';
    case 'critical': return 'Limit Exceeded';
    case 'no_noc':   return 'No NOC Registered';
  }
}
