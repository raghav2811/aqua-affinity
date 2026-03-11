import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const BUCKET = 'sensor_images';

export async function POST(req: NextRequest) {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const body = await req.json() as { sensorId?: string; imageBase64?: string };
  const { sensorId, imageBase64 } = body;

  if (!sensorId || !imageBase64) {
    return NextResponse.json({ error: 'Missing sensorId or imageBase64' }, { status: 400 });
  }

  // Strip data-URI prefix and decode to Buffer
  const base64Data = imageBase64.replace(/^data:image\/jpeg;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  const filename = `${sensorId}.jpg`;

  // Upload to Storage (upsert so subsequent calls overwrite the same file)
  const { error: uploadErr } = await db.storage
    .from(BUCKET)
    .upload(filename, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // Upsert DB record: sensor_id → filename
  const { error: dbErr } = await db
    .from('sensor_chart_images')
    .upsert(
      { sensor_id: sensorId, image_filename: filename, updated_at: new Date().toISOString() },
      { onConflict: 'sensor_id' },
    );

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ filename }, { status: 200 });
}

// GET — return all sensor → filename mappings
export async function GET() {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const { data, error } = await db
    .from('sensor_chart_images')
    .select('sensor_id, image_filename, updated_at')
    .order('sensor_id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ images: data ?? [] });
}
