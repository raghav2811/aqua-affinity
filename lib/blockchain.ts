/**
 * lib/blockchain.ts — Ganache blockchain logger (server-side only)
 *
 * Each sensor reading is SHA-256 hashed and anchored on-chain via a
 * self-directed zero-value transaction whose `data` field carries the hash.
 * When Ganache is not available the function falls back to a deterministic
 * "simulation" hash so the rest of the app keeps working.
 *
 * Configuration (in .env.local):
 *   BLOCKCHAIN_RPC_URL      — defaults to http://127.0.0.1:7545
 *   BLOCKCHAIN_PRIVATE_KEY  — (optional) specific account private key
 *
 * How signing works:
 *   1. If a private key is configured AND that account has ETH → use it.
 *   2. Otherwise use provider.getSigner(0) — Ganache unlocks all accounts
 *      by default, so account[0] always has 100 ETH and needs no key.
 *   3. If Ganache is unreachable → fall back to deterministic simulation.
 */

import { createHash } from 'crypto';

export interface BlockchainTx {
  txHash:      string;
  blockNumber: number;
  dataHash:    string;
  simulated:   boolean;   // true when Ganache is unreachable
  reason?:     string;    // why it fell back to simulation (for debugging)
}

/** Derive a deterministic 0x-prefixed SHA-256 hex hash from any JSON payload. */
export function hashPayload(payload: unknown): string {
  return '0x' + createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Log a payload to the Ganache blockchain.
 * Returns the tx hash + block number on success, or a simulated record on failure.
 */
export async function logToBlockchain(
  payload:  unknown,
  sensorId: string,
): Promise<BlockchainTx> {
  const dataHash = hashPayload({ sensorId, payload, ts: new Date().toISOString() });
  const rpcUrl   = process.env.BLOCKCHAIN_RPC_URL ?? 'http://127.0.0.1:7545';

  // ── Try real Ganache transaction ─────────────────────────────────────────
  try {
    // Dynamic import keeps ethers out of client bundles
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Quick connectivity check — throws immediately if Ganache is not running
    await provider.getBlockNumber();

    // Resolve signer: prefer configured private-key wallet if it has ETH,
    // otherwise fall back to Ganache's auto-unlocked account[0].
    let signer: import('ethers').Signer;
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;

    if (privateKey) {
      const wallet  = new ethers.Wallet(privateKey, provider);
      const balance = await provider.getBalance(wallet.address);
      if (balance > BigInt(0)) {
        signer = wallet;
      } else {
        console.warn(
          `[blockchain] Wallet ${wallet.address} has 0 ETH — using Ganache account[0] instead.`,
        );
        signer = await provider.getSigner(0);
      }
    } else {
      // No private key configured: use Ganache's first unlocked account
      signer = await provider.getSigner(0);
    }

    const from = await signer.getAddress();
    const tx = await signer.sendTransaction({
      to:    from,       // self-transfer so there is always a valid recipient
      value: BigInt(0),
      data:  dataHash,   // 32-byte payload hash stored permanently on-chain
    });

    const receipt = await tx.wait(1);
    return {
      txHash:      tx.hash,
      blockNumber: receipt?.blockNumber ?? 0,
      dataHash,
      simulated:   false,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error('[blockchain] Transaction failed — falling back to simulation:', reason);

    // ── Simulation fallback ────────────────────────────────────────────────
    const simulatedBlock = Math.floor(Date.now() / 1000) % 1048576;
    return {
      txHash:      dataHash,
      blockNumber: simulatedBlock,
      dataHash,
      simulated:   true,
      reason,
    };
  }
}
