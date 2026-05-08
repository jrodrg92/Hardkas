import { TxPlanV2, TxReceiptV2, SignedTxV2, ARTIFACT_V2_VERSION } from "./schemas.js";
import { calculateContentHash } from "./canonical.js";
import { HARDKAS_VERSION } from "./constants.js";

/**
 * Creates a v2 simulated signed transaction artifact.
 */
export function createSimulatedSignedTxArtifact(plan: TxPlanV2, payload: string): SignedTxV2 {
  const artifact: SignedTxV2 = {
    schema: "hardkas.signedTx.v2",
    hardkasVersion: HARDKAS_VERSION,
    version: ARTIFACT_V2_VERSION,
    createdAt: new Date().toISOString(),
    status: "signed",
    signedId: `signed-${Date.now()}`,
    sourcePlanId: plan.planId,
    networkId: plan.networkId,
    mode: plan.mode,
    from: { address: plan.from.address },
    to: { address: plan.to.address },
    amountSompi: plan.amountSompi,
    signedTransaction: {
      format: "simulated",
      payload
    }
  };

  artifact.contentHash = calculateContentHash(artifact);
  return artifact;
}

/**
 * Creates a v2 simulated receipt.
 */
export function createSimulatedTxReceipt(
  plan: TxPlanV2, 
  txId: string, 
  extra?: { 
    spentUtxoIds?: string[], 
    createdUtxoIds?: string[], 
    daaScore?: string 
  }
): TxReceiptV2 {
  const artifact: TxReceiptV2 = {
    schema: "hardkas.txReceipt.v2",
    hardkasVersion: HARDKAS_VERSION,
    version: ARTIFACT_V2_VERSION,
    createdAt: new Date().toISOString(),
    txId,
    status: "accepted",
    mode: "simulated",
    networkId: plan.networkId,
    from: { address: plan.from.address },
    to: { address: plan.to.address },
    amountSompi: plan.amountSompi,
    feeSompi: plan.estimatedFeeSompi,
    changeSompi: (plan as any).change?.amountSompi,
    spentUtxoIds: extra?.spentUtxoIds,
    createdUtxoIds: extra?.createdUtxoIds,
    daaScore: extra?.daaScore
  };

  artifact.contentHash = calculateContentHash(artifact);
  return artifact;
}

/**
 * Validates and extracts the raw transaction from a signed artifact.
 */
export function getBroadcastableSignedTransaction(artifact: any): {
  mode: string;
  rawTransaction: string;
} {
  if (!artifact.signedTransaction?.payload) {
    throw new Error("Signed artifact is missing the raw transaction payload.");
  }

  return {
    mode: artifact.mode || "rpc",
    rawTransaction: artifact.signedTransaction.payload
  };
}
