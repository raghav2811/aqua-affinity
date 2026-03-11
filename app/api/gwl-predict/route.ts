import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// ── Tiny linear-algebra helpers for OLS regression ───────────────────────────

function transpose(m: number[][]): number[][] {
  return m[0].map((_, j) => m.map(row => row[j]));
}

function matMul(A: number[][], B: number[][]): number[][] {
  const rows = A.length, inner = B.length, cols = B[0].length;
  const out = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++)
    for (let k = 0; k < inner; k++)
      for (let j = 0; j < cols; j++)
        out[i][j] += A[i][k] * B[k][j];
  return out;
}

/** Gauss-Jordan inversion for an n×n matrix */
function invertMatrix(mat: number[][]): number[][] | null {
  const n = mat.length;
  const aug = mat.map((row, i) => [
    ...row.map(v => v),
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) return null;         // singular
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= f * aug[col][j];
    }
  }
  return aug.map(row => row.slice(n));
}

/** OLS: w = (XᵀX)⁻¹ Xᵀy */
function fitOLS(X: number[][], y: number[]): number[] | null {
  const Xt   = transpose(X);
  const XtX  = matMul(Xt, X);
  const XtXi = invertMatrix(XtX);
  if (!XtXi) return null;
  const XtY = matMul(Xt, y.map(v => [v]));
  return matMul(XtXi, XtY).map(v => v[0]);
}

/** Feature vector: [intercept, time-trend, sin-seasonal, cos-seasonal] */
function features(t: number, doy: number): number[] {
  return [1, t, Math.sin((2 * Math.PI * doy) / 365), Math.cos((2 * Math.PI * doy) / 365)];
}

function predict(w: number[], f: number[]): number {
  return w.reduce((s, wi, i) => s + wi * f[i], 0);
}

function computeR2(actual: number[], predicted: number[]): number {
  const mean  = actual.reduce((a, b) => a + b, 0) / actual.length;
  const ssTot = actual.reduce((s, y) => s + (y - mean) ** 2, 0);
  const ssRes = actual.reduce((s, y, i) => s + (y - predicted[i]) ** 2, 0);
  return ssTot === 0 ? 1 : 1 - ssRes / ssTot;
}

function dayOfYear(d: Date): number {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
}

// ── API handler ───────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // ── 1. Parse CSV ─────────────────────────────────────────────────────────
    const csvPath = path.join(process.cwd(), 'gwl-daily.csv');
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines   = content.split('\n');
    const headers = lines[0].split(',');

    const dateIdx = headers.indexOf('MSMT_DATE');
    const gseIdx  = headers.indexOf('GSE_WSE');

    if (dateIdx === -1 || gseIdx === -1)
      return NextResponse.json({ error: 'CSV columns missing' }, { status: 400 });

    const dayMap = new Map<string, { sum: number; count: number }>();

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length <= Math.max(dateIdx, gseIdx)) continue;
      const dateStr = cols[dateIdx]?.trim();
      const val     = parseFloat(cols[gseIdx]?.trim() ?? '');
      if (!dateStr || isNaN(val) || val <= 0) continue;
      const parts = dateStr.split('/');
      if (parts.length !== 3) continue;
      const [mm, dd, yyyy] = parts;
      const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      const rec = dayMap.get(iso) ?? { sum: 0, count: 0 };
      rec.sum += val; rec.count++;
      dayMap.set(iso, rec);
    }

    const sorted = Array.from(dayMap.entries())
      .map(([date, { sum, count }]) => ({ date, depth: sum / count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (sorted.length < 30)
      return NextResponse.json({ error: 'Insufficient data' }, { status: 400 });

    // ── 2. Build training matrix ──────────────────────────────────────────────
    const startDate = new Date(sorted[0].date);
    const X: number[][] = [];
    const y: number[]   = [];

    for (const { date, depth } of sorted) {
      const d = new Date(date);
      const t = (d.getTime() - startDate.getTime()) / 86400000;
      X.push(features(t, dayOfYear(d)));
      y.push(depth);
    }

    // ── 3. Train OLS (used only for R² quality metric) ─────────────────────
    const weights = fitOLS(X, y);
    const r2 = weights
      ? computeR2(y, X.map(f => predict(weights, f)))
      : 0;

    // ── Holt's Damped Exponential Smoothing for stable forecasts ─────────────
    //   Level:   L[t] = α·y[t] + (1−α)·(L[t−1] + φ·T[t−1])
    //   Trend:   T[t] = β·(L[t] − L[t−1]) + (1−β)·φ·T[t−1]
    //   h-step:  ŷ = L[n] + T[n]·Σ_{i=1}^{h} φⁱ
    //   α=0.3, β=0.05, φ=0.85 → strong damping prevents trend runaway
    const ALPHA = 0.3, BETA = 0.05, PHI = 0.85;
    const vals  = sorted.map(d => d.depth);
    let lv = vals[0];
    let tr = vals.length > 1 ? vals[1] - vals[0] : 0;

    for (let i = 1; i < vals.length; i++) {
      const lv_prev = lv;
      lv = ALPHA * vals[i] + (1 - ALPHA) * (lv_prev + PHI * tr);
      tr = BETA  * (lv - lv_prev) + (1 - BETA) * PHI * tr;
    }

    // Safety bounds: clamp predictions to ±30 % of the last-30-day range
    const rMin = Math.min(...vals.slice(-30));
    const rMax = Math.max(...vals.slice(-30));
    const rPad = Math.max((rMax - rMin) * 0.3, 2);  // at least 2 ft leeway

    // ── 4. Fetch 30-day weather forecast (Open-Meteo) ─────────────────────────
    type WeatherDay = { date: string; precipitation_mm: number; temperature_max: number; rain_probability: number };
    let weatherForecast: WeatherDay[] = [];
    try {
      const wUrl =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=11.127&longitude=78.657` +
        `&daily=precipitation_sum,temperature_2m_max,precipitation_probability_max` +
        `&forecast_days=30&timezone=Asia%2FKolkata`;
      const wRes = await fetch(wUrl);
      if (wRes.ok) {
        const wd = await wRes.json();
        weatherForecast = wd.daily.time.map((date: string, i: number) => ({
          date,
          precipitation_mm: wd.daily.precipitation_sum[i] ?? 0,
          temperature_max:  wd.daily.temperature_2m_max[i] ?? 0,
          rain_probability: wd.daily.precipitation_probability_max[i] ?? 0,
        }));
      }
    } catch { /* weather optional — degrade gracefully */ }

    // ── 5. Generate 30-day predictions (Holt's damped forecast) ─────────────
    const lastDate = new Date(sorted[sorted.length - 1].date);
    let phiCum = 0;  // accumulates φ + φ² + … + φ^h

    const predictions = Array.from({ length: 30 }, (_, idx) => {
      const h = idx + 1;
      phiCum += Math.pow(PHI, h);

      const futureDate = new Date(lastDate);
      futureDate.setDate(futureDate.getDate() + h);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      // Damped Holt base prediction
      let pred = lv + tr * phiCum;

      // Rainfall recharge: each mm reduces depth ~0.025 ft
      const weather = weatherForecast.find(w => w.date === futureDateStr);
      const rain    = weather?.precipitation_mm ?? 0;
      pred -= rain * 0.025;

      // Clamp to safety bounds
      pred = Math.max(rMin - rPad, Math.min(rMax + rPad, pred));
      pred = Math.max(0, pred);

      return {
        date:             futureDateStr,
        predictedDepthFt: parseFloat(pred.toFixed(3)),
        predictedDepthM:  parseFloat((pred * 0.3048).toFixed(3)),
        precipitation_mm: rain,
        temperature_max:  weather?.temperature_max ?? 0,
        rain_probability: weather?.rain_probability ?? 0,
      };
    });

    // ── 6. Risk assessment ───────────────────────────────────────────────────
    const recent30 = sorted.slice(-30).map(d => d.depth);
    const prev30   = sorted.slice(-60, -30).map(d => d.depth);

    const avgRecent = recent30.reduce((a, b) => a + b, 0) / recent30.length;
    const avgPrev   = prev30.length ? prev30.reduce((a, b) => a + b, 0) / prev30.length : avgRecent;

    const trendFtPerDay = (avgRecent - avgPrev) / 30;
    const historicalMax = Math.max(...sorted.map(d => d.depth));
    const criticalDepthFt = historicalMax * 0.93; // 93 % of all-time max = critical
    const currentDepthFt  = sorted[sorted.length - 1].depth;

    const predictedMax = Math.max(...predictions.map(p => p.predictedDepthFt));

    let riskLevel: 'safe' | 'warning' | 'critical';
    if (trendFtPerDay > 0.03 || predictedMax >= criticalDepthFt)        riskLevel = 'critical';
    else if (trendFtPerDay > 0.008 || predictedMax >= criticalDepthFt * 0.88) riskLevel = 'warning';
    else                                                                        riskLevel = 'safe';

    let daysUntilCritical: number | null = null;
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i].predictedDepthFt >= criticalDepthFt) {
        daysUntilCritical = i + 1;
        break;
      }
    }

    // Historical last 30 days returned for the chart
    const historical = sorted.slice(-30).map(d => ({
      date:     d.date,
      depthFt:  parseFloat(d.depth.toFixed(3)),
      depthM:   parseFloat((d.depth * 0.3048).toFixed(3)),
    }));

    return NextResponse.json({
      historical,
      predictions,
      model: { weights: weights ?? [], r2: parseFloat(r2.toFixed(4)) },
      risk: {
        level:            riskLevel,
        trend:            trendFtPerDay > 0 ? 'declining' : 'recovering',
        trendFtPerDay:    parseFloat(trendFtPerDay.toFixed(5)),
        daysUntilCritical,
        currentDepthFt:   parseFloat(currentDepthFt.toFixed(3)),
        currentDepthM:    parseFloat((currentDepthFt * 0.3048).toFixed(3)),
        criticalDepthFt:  parseFloat(criticalDepthFt.toFixed(3)),
        criticalDepthM:   parseFloat((criticalDepthFt * 0.3048).toFixed(3)),
      },
    });

  } catch (err) {
    console.error('[gwl-predict]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
