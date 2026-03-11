import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const csvPath = path.join(process.cwd(), 'gwl-daily.csv');
    const content = fs.readFileSync(csvPath, 'utf-8');

    const lines = content.split('\n');
    const headers = lines[0].split(',');

    const dateIdx = headers.indexOf('MSMT_DATE');
    const gseIdx  = headers.indexOf('GSE_WSE');   // depth to water below ground (feet)

    if (dateIdx === -1 || gseIdx === -1) {
      return NextResponse.json({ error: 'Expected columns not found in CSV' }, { status: 400 });
    }

    const dayMap = new Map<string, { sum: number; count: number }>();

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length <= Math.max(dateIdx, gseIdx)) continue;

      const dateStr = cols[dateIdx]?.trim();
      const gseVal  = parseFloat(cols[gseIdx]?.trim() ?? '');

      if (!dateStr || isNaN(gseVal) || gseVal <= 0) continue;

      // Parse MM/DD/YYYY → ISO
      const parts = dateStr.split('/');
      if (parts.length !== 3) continue;
      const [mm, dd, yyyy] = parts;
      const isoDate = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;

      const rec = dayMap.get(isoDate) ?? { sum: 0, count: 0 };
      rec.sum   += gseVal;
      rec.count += 1;
      dayMap.set(isoDate, rec);
    }

    const all = Array.from(dayMap.entries())
      .map(([date, { sum, count }]) => ({
        date,
        depthFt: parseFloat((sum / count).toFixed(3)),
        depthM:  parseFloat(((sum / count) * 0.3048).toFixed(3)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Return last 90 days
    const last90 = all.slice(-90);

    return NextResponse.json({ data: last90, totalDays: all.length });
  } catch (err) {
    console.error('[gwl-history]', err);
    return NextResponse.json({ error: 'Failed to process GWL data' }, { status: 500 });
  }
}
