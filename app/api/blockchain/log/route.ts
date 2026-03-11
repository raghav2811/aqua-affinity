/**
 * POST /api/blockchain/log
 *
 * Fetches the latest sensor reading from Supabase, hashes it,
 * logs it to the Ganache blockchain (or simulation fallback),
 * and stores the resulting transaction record in Supabase.
 *
 * Body (optional JSON): { sensorId?: string }
 * If sensorId is omitted, all VR sensors are logged in bulk.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin }           from '@/lib/supabase';
import { logToBlockchain }            from '@/lib/blockchain';

export async function POST(req: NextRequest) {
  try {
    const body         = await req.json().catch(() => ({}));
    const sensorId     = typeof body.sensorId === 'string' ? body.sensorId : null;
    // Direct readings payload — skip DB fetch entirely when provided
    const directReadings: Record<string, unknown>[] | null =
      Array.isArray(body.readings) && body.readings.length > 0 ? body.readings : null;

    const db = getSupabaseAdmin();

    let unique: Record<string, unknown>[] = [];

    if (directReadings) {
      // Use readings supplied directly in the request body
      unique = directReadings;
    } else {
      // ── 1. Fetch latest readings from Supabase ──────────────────────────
      let query = db
        ? db.from('sensor_readings').select('*').order('timestamp', { ascending: false })
        : null;

      if (query && sensorId) {
        query = query.eq('sensor_id', sensorId).limit(1);
      } else if (query) {
        // Latest reading per sensor — fetch up to 5 recent rows, deduplicate
        query = query.limit(5);
      }

      let readings: Record<string, unknown>[] = [];
      if (query) {
        const { data, error } = await query;
        if (error) throw new Error(`fetch readings: ${error.message}`);
        readings = data ?? [];
      }

      // Deduplicate: keep the newest reading per sensor_id
      const seen = new Set<string>();
      unique = readings.filter(r => {
        const id = String(r.sensor_id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      // If no DB data, create a synthetic "heartbeat" payload
      if (unique.length === 0) {
        unique.push({
          sensor_id: sensorId ?? 'heartbeat',
          timestamp: new Date().toISOString(),
          heartbeat: true,
        });
      }
    }

    // ── 2. Log each reading to blockchain (sequential — parallel causes nonce collisions)
    const results: {
      sensorId: string; txHash: string; blockNumber: number;
      dataHash: string; simulated: boolean; timestamp: string;
    }[] = [];

    for (const reading of unique) {
      const sid = String(reading.sensor_id);
      const tx  = await logToBlockchain(reading, sid);

      // ── 3. Persist tx record in Supabase ──────────────────────────────
      if (db) {
        await db.from('blockchain_log').insert({
          tx_hash:      tx.txHash,
          block_number: tx.blockNumber,
          sensor_id:    sid,
          data_hash:    tx.dataHash,
          payload:      reading,
          chain:        tx.simulated ? 'simulation' : 'ganache_local',
        }).select();
      }

      results.push({
        sensorId:    sid,
        txHash:      tx.txHash,
        blockNumber: tx.blockNumber,
        dataHash:    tx.dataHash,
        simulated:   tx.simulated,
        timestamp:   new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, transactions: results });

  } catch (err) {
    console.error('[blockchain/log]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
