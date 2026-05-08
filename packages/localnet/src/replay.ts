import { 
  TxPlanArtifact, 
  TxReceiptArtifact, 
  calculateContentHash 
} from "@hardkas/artifacts";
import { applySimulatedPlan } from "./transactions.js";
import { LocalnetState, ReplayVerificationReport } from "./types.js";

/**
 * Verifies that a transaction replay matches the original artifacts.
 */
export function verifyReplay(
  state: LocalnetState,
  originalPlan: TxPlanArtifact,
  originalReceipt: TxReceiptArtifact
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

  if (replayReceipt.estimatedMass !== originalReceipt.estimatedMass) {
    errors.push(`Mass mismatch: expected ${originalReceipt.estimatedMass}, got ${replayReceipt.estimatedMass}`);
  }

  if (replayReceipt.estimatedFeeSompi !== originalReceipt.estimatedFeeSompi) {
    errors.push(`Fee mismatch: expected ${originalReceipt.estimatedFeeSompi}, got ${replayReceipt.estimatedFeeSompi}`);
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
