/**
 * GET /api/blockchain/history?limit=20
 *
 * Returns the most recent blockchain transaction records from Supabase.
 * Falls back to an empty list when the DB isn't configured.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin }           from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const limit = Math.min(
    parseInt(new URL(req.url).searchParams.get('limit') ?? '20', 10),
    100
  );

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ transactions: [], configured: false });
  }

  const { data, error } = await db
    .from('blockchain_log')
    .select('id, tx_hash, block_number, sensor_id, data_hash, chain, created_at, payload')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[blockchain/history]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    transactions: (data ?? []).map(row => ({
      id:          row.id,
      txHash:      row.tx_hash,
      blockNumber: row.block_number,
      sensorId:    row.sensor_id,
      dataHash:    row.data_hash,
      chain:       row.chain,
      createdAt:   row.created_at,
      payload:     row.payload,
    })),
    configured: true,
  });
}
