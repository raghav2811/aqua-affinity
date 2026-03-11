'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2, RefreshCw, AlertTriangle, CheckCircle,
  Cpu, Database, Hash, Blocks, Trash2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface BlockchainTx {
  id:          string;
  txHash:      string;
  blockNumber: number;
  sensorId:    string;
  dataHash:    string;
  chain:       string;
  createdAt:   string;
  payload:     Record<string, unknown> | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function truncateHash(hash: string, chars = 10): string {
  if (hash.length <= chars * 2 + 3) return hash;
  return `${hash.slice(0, chars)}…${hash.slice(-chars)}`;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ── Single transaction row ────────────────────────────────────────────────────
function TxRow({ tx }: { tx: BlockchainTx }) {
  const isSimulated = tx.chain === 'simulation';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-start gap-3 px-4 py-3"
      style={{ borderBottom: '1px solid #f0f9ff' }}
    >
      {/* Chain icon */}
      <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
        style={{ background: isSimulated ? 'rgba(148,163,184,0.12)' : 'rgba(14,165,233,0.10)' }}>
        <Blocks size={13} style={{ color: isSimulated ? '#94a3b8' : '#0ea5e9' }} />
      </div>

      <div className="flex-1 min-w-0">
        {/* Tx hash */}
        <div className="flex items-center gap-1.5 mb-0.5">
          <Hash size={10} style={{ color: '#94a3b8', flexShrink: 0 }} />
          <span className="text-xs font-mono truncate" style={{ color: '#0c4a6e' }}>
            {truncateHash(tx.txHash, 12)}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 font-medium"
            style={{
              background: isSimulated ? 'rgba(148,163,184,0.12)' : 'rgba(14,165,233,0.10)',
              color: isSimulated ? '#94a3b8' : '#0284c7',
            }}>
            {isSimulated ? 'SIMULATED' : `Block #${tx.blockNumber}`}
          </span>
        </div>

        {/* Sensor + data hash */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs px-1.5 py-0.5 rounded font-mono"
            style={{ background: '#f0f9ff', color: '#64748b', border: '1px solid #e0f2fe' }}>
            {tx.sensorId}
          </span>
          <span className="text-xs font-mono truncate" style={{ color: '#94a3b8' }}>
            data: {truncateHash(tx.dataHash, 8)}
          </span>
          <span className="text-xs ml-auto flex-shrink-0" style={{ color: '#94a3b8' }}>
            {timeAgo(tx.createdAt)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BlockchainView() {
  const [txs,        setTxs]        = useState<BlockchainTx[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [logging,    setLogging]    = useState(false);
  const [resetting,  setResetting]  = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [lastLog,    setLastLog]    = useState<string>('');
  const [dbConfigured, setDbConfigured] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/blockchain/history?limit=20');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTxs(data.transactions ?? []);
      setDbConfigured(data.configured !== false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleReset = async () => {
    setResetting(true);
    setError(null);
    setConfirmReset(false);
    try {
      const res  = await fetch('/api/blockchain/reset', { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Reset failed');
      setTxs([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  const handleLogAll = async () => {
    setLogging(true);
    setError(null);
    try {
      const res  = await fetch('/api/blockchain/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Log failed');
      setLastLog(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
      // Refresh list after a short delay to let DB propagate
      setTimeout(() => fetchHistory(), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Logging failed');
    } finally {
      setLogging(false);
    }
  };

  const totalSimulated  = txs.filter(t => t.chain === 'simulation').length;
  const totalOnChain    = txs.filter(t => t.chain !== 'simulation').length;
  const uniqueSensors   = new Set(txs.map(t => t.sensorId)).size;

  return (
    <motion.div
      className="absolute inset-0 z-[900] flex flex-col"
      style={{ background: '#f0f9ff', overflow: 'hidden' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
        style={{ background: '#ffffff', borderBottom: '1px solid #bae6fd' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(14,165,233,0.12)' }}>
            <Link2 size={18} style={{ color: '#0284c7' }} />
          </div>
          <div>
            <h1 className="font-bold text-base" style={{ color: '#0c4a6e' }}>
              Blockchain Ledger
            </h1>
            <p className="text-xs" style={{ color: '#64748b' }}>
              Immutable sensor-reading audit trail · Ganache local chain
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: '#f0f9ff', color: '#64748b', border: '1px solid #e0f2fe' }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          {/* Reset chain — shows confirm state first */}
          {confirmReset ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: '#ef4444' }}>Clear all records?</span>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                {resetting ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
                Yes, reset
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              disabled={loading || resetting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105 disabled:opacity-50"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <Trash2 size={12} />
              Reset Chain
            </button>
          )}

          <button
            onClick={handleLogAll}
            disabled={logging || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-105 disabled:opacity-50"
            style={{
              background: 'rgba(14,165,233,0.12)', color: '#0284c7',
              border: '1px solid rgba(14,165,233,0.25)',
            }}
          >
            <Database size={12} className={logging ? 'animate-spin' : ''} />
            {logging ? 'Logging…' : 'Log Sensor Readings Now'}
          </button>
        </div>
      </div>

      {/* ── Stats bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center flex-shrink-0"
        style={{ background: 'rgba(240,249,255,0.97)', borderBottom: '1px solid #e0f2fe' }}>
        {[
          { label: 'Total Transactions', value: txs.length,       color: '#38bdf8',  icon: Blocks },
          { label: 'On-Chain (Ganache)', value: totalOnChain,      color: '#22c55e',  icon: CheckCircle },
          { label: 'Simulated',          value: totalSimulated,    color: '#94a3b8',  icon: Cpu },
          { label: 'Unique Sensors',     value: uniqueSensors,     color: '#a78bfa',  icon: Database },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-2 px-5 py-2.5 flex-shrink-0"
              style={{ borderRight: '1px solid #e0f2fe' }}>
              <Icon size={13} style={{ color: s.color }} />
              <span className="text-lg font-bold tabular-nums" style={{ color: s.color }}>
                {s.value}
              </span>
              <span className="text-xs" style={{ color: '#64748b' }}>{s.label}</span>
            </div>
          );
        })}
        {lastLog && (
          <div className="ml-auto px-5 py-2.5 flex-shrink-0">
            <span className="text-xs" style={{ color: '#94a3b8' }}>Last logged: {lastLog}</span>
          </div>
        )}
      </div>

      {/* ── Setup notice when DB not configured ──────────────────────────────── */}
      {!dbConfigured && (
        <div className="mx-4 mt-4 px-4 py-3 rounded-xl flex items-start gap-3 flex-shrink-0"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <AlertTriangle size={15} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: '#92400e' }}>
              Supabase not configured
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              Add <code className="px-1 rounded" style={{ background: '#fef3c7' }}>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
              <code className="px-1 rounded" style={{ background: '#fef3c7' }}>SUPABASE_SERVICE_ROLE_KEY</code> to{' '}
              <code>.env.local</code>, then run the SQL migration in{' '}
              <code>supabase/migrations/add_blockchain_log.sql</code>.
            </p>
          </div>
        </div>
      )}

      {/* ── Ganache setup guide ───────────────────────────────────────────────── */}
      <div className="mx-4 mt-3 px-4 py-3 rounded-xl flex items-start gap-3 flex-shrink-0"
        style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid #bae6fd' }}>
        <Blocks size={14} style={{ color: '#0ea5e9', flexShrink: 0, marginTop: 1 }} />
        <p className="text-xs leading-relaxed" style={{ color: '#0c4a6e' }}>
          <strong>Ganache setup:</strong> Download{' '}
          <strong>Ganache Desktop</strong> (trufflesuite.com/ganache), start a workspace on port 7545,
          copy <strong>Account 0 private key</strong> (eye icon) into{' '}
          <code className="px-1 rounded" style={{ background: '#e0f2fe' }}>BLOCKCHAIN_PRIVATE_KEY</code> in
          your <code>.env.local</code>. Transactions will then appear as real on-chain records.
          Without the key, the app runs in <strong>simulation mode</strong>.
        </p>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-4 mt-3 px-4 py-2.5 rounded-xl flex items-center gap-2 flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle size={13} style={{ color: '#ef4444' }} />
            <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Transaction list ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto mt-3 mx-4 rounded-2xl overflow-hidden"
        style={{ border: '1px solid #e0f2fe', background: '#ffffff' }}>

        {/* List header */}
        <div className="flex items-center gap-2 px-4 py-2.5 sticky top-0"
          style={{ background: '#f8fafc', borderBottom: '1px solid #e0f2fe' }}>
          <Hash size={12} style={{ color: '#94a3b8' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
            Transaction Hash
          </span>
          <span className="ml-auto text-xs uppercase tracking-wider" style={{ color: '#94a3b8' }}>
            Block · Sensor · Age
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{
                height: 52, borderRadius: 8, background: '#f0f9ff',
                animation: 'pulse 1.5s ease-in-out infinite',
                opacity: 0.7 - i * 0.1,
              }} />
            ))}
          </div>
        ) : txs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Blocks size={36} style={{ color: '#cbd5e1', marginBottom: 12 }} />
            <p className="text-sm" style={{ color: '#64748b' }}>No transactions yet</p>
            <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
              Click "Log Sensor Readings Now" to create the first blockchain record
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {txs.map(tx => <TxRow key={tx.id} tx={tx} />)}
          </AnimatePresence>
        )}
      </div>

      <div className="h-4" />
    </motion.div>
  );
}
