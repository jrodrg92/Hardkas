import { 
  TxPlanV2, 
  TxReceiptV2, 
  calculateContentHash 
} from "@hardkas/artifacts";
import { applySimulatedPlan } from "./transactions.js";
import { LocalnetState, ReplayVerificationReport } from "./types.js";

/**
 * Verifies that a transaction replay matches the original artifacts.
 */
export function verifyReplay(
  state: LocalnetState,
  originalPlan: TxPlanV2,
  originalReceipt: TxReceiptV2
): ReplayVerificationReport {
  const errors: string[] = [];
  
  // 1. Plan Integrity
  const currentPlanHash = calculateContentHash(originalPlan);
  if (originalPlan.contentHash && currentPlanHash !== originalPlan.contentHash) {
    errors.push(`TxPlan contentHash mismatch: expected ${originalPlan.contentHash}, got ${currentPlanHash}`);
  }

  // 2. Execute Replay (Dry-run by default as we don't return the new state)
  const result = applySimulatedPlan(state, originalPlan, { txId: originalReceipt.txId });
  const replayReceipt = result.receipt;

  // 3. Compare Invariants
  if (replayReceipt.status !== originalReceipt.status) {
    errors.push(`Status mismatch: expected ${originalReceipt.status}, got ${replayReceipt.status}`);
  }

  if (replayReceipt.mass !== originalReceipt.mass) {
    errors.push(`Mass mismatch: expected ${originalReceipt.mass}, got ${replayReceipt.mass}`);
  }

  if (replayReceipt.feeSompi !== originalReceipt.feeSompi) {
    errors.push(`Fee mismatch: expected ${originalReceipt.feeSompi}, got ${replayReceipt.feeSompi}`);
  }

  if (replayReceipt.preStateHash !== originalReceipt.preStateHash) {
    errors.push(`preStateHash mismatch: expected ${originalReceipt.preStateHash}, got ${replayReceipt.preStateHash}`);
  }

  if (replayReceipt.postStateHash !== originalReceipt.postStateHash) {
    errors.push(`postStateHash mismatch: expected ${originalReceipt.postStateHash}, got ${replayReceipt.postStateHash}`);
  }

  // Compare spent/created UTXOs count
  if (replayReceipt.spentUtxoIds?.length !== originalReceipt.spentUtxoIds?.length) {
    errors.push(`Spent UTXO count mismatch: expected ${originalReceipt.spentUtxoIds?.length}, got ${replayReceipt.spentUtxoIds?.length}`);
  }

  return {
    planOk: !errors.some(e => e.includes("TxPlan")),
    receiptOk: !errors.some(e => e.includes("Status") || e.includes("Hash")),
    invariantsOk: errors.length === 0,
    errors
  };
}

/**
 * Loads receipt and trace for a transaction and produces a summary.
 */
export async function getSimulatedReplaySummary(txId: string, options: { cwd?: string } = {}) {
  const { loadSimulatedReceipt } = await import("./receipts.js");
  const { loadSimulatedTrace } = await import("./traces.js");

  const receipt = await loadSimulatedReceipt(txId, options);
  const trace = await loadSimulatedTrace(txId, options);

  if (!receipt || !trace) {
    throw new Error(`Receipt or trace not found for transaction: ${txId}`);
  }

  return {
    receipt,
    trace,
    summary: {
      spentCount: receipt.spentUtxoIds?.length || 0,
      createdCount: receipt.createdUtxoIds?.length || 0,
      transferredSompi: BigInt(receipt.amountSompi),
      feeSompi: BigInt(receipt.feeSompi || "0"),
      changeSompi: BigInt(receipt.changeSompi || "0"),
      finalDaaScore: receipt.daaScore || "0"
    }
  };
}
