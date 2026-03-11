/**
 * DELETE /api/blockchain/reset
 *
 * Clears all rows from the blockchain_log table in Supabase.
 * Use this after restarting Ganache to keep the ledger UI in sync
 * with the fresh chain state (block numbers reset to 0).
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function DELETE() {
  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { error } = await db
      .from('blockchain_log')
      .delete()
      .not('id', 'is', null);   // matches every row

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[blockchain/reset]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Reset failed' },
      { status: 500 },
    );
  }
}
