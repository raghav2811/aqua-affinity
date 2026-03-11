import { NextResponse } from 'next/server';

// Open-Meteo — free public API, no key required
// Coordinates: Tamil Nadu centroid (Coimbatore / Erode region)
const LAT = 11.127;
const LNG = 78.657;

export async function GET() {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${LAT}&longitude=${LNG}` +
      `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,weathercode` +
      `&forecast_days=14&timezone=Asia%2FKolkata`;

    const res = await fetch(url, { next: { revalidate: 3600 } }); // cache 1 hr
    if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);

    const raw = await res.json();

    const current = {
      temperature: raw.current?.temperature_2m ?? null,
      humidity: raw.current?.relative_humidity_2m ?? null,
      precipitation: raw.current?.precipitation ?? null,
      weathercode: raw.current?.weathercode ?? null,
    };

    const forecast = (raw.daily?.time ?? []).map((date: string, i: number) => ({
      date,
      precipitation_mm: raw.daily.precipitation_sum[i] ?? 0,
      temperature_max: raw.daily.temperature_2m_max[i] ?? 0,
      temperature_min: raw.daily.temperature_2m_min[i] ?? 0,
      rain_probability: raw.daily.precipitation_probability_max[i] ?? 0,
      weathercode: raw.daily.weathercode[i] ?? 0,
    }));

    return NextResponse.json({ current, forecast, location: 'Tamil Nadu, India' });
  } catch (err) {
    console.error('[weather]', err);
    return NextResponse.json({ error: 'Failed to fetch weather data' }, { status: 500 });
  }
}
