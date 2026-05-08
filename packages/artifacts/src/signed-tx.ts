import { validateTxPlanArtifact } from "./validate.js";
import type { TxPlanArtifact, SignedTxArtifact } from "./types.js";
import { HARDKAS_VERSION, ARTIFACT_SCHEMAS, HardkasArtifactMode } from "./constants.js";

export interface CreateSimulatedSignedTxArtifactInput {
  plan: TxPlanArtifact;
  account: string;
  signerAddress?: string | undefined;
  artifactPath?: string | undefined;
  metadata?: SignedTxArtifact["metadata"];
}

export function createSimulatedSignedTxArtifact(
  input: CreateSimulatedSignedTxArtifactInput
): SignedTxArtifact {
  const { plan } = input;
  
  // Basic sanity check
  const validation = validateTxPlanArtifact(plan);
  if (!validation.ok) {
    throw new Error(`Cannot sign invalid TxPlanArtifact: ${validation.errors.join(", ")}`);
  }

  if (plan.status !== "built" && (plan as any).status !== "unsigned") {
    throw new Error(`Cannot sign artifact with status: ${plan.status}`);
  }

  const signedId = `signed_${plan.planId.substring(0, 8)}_${Date.now().toString(36)}`;

  const artifact: SignedTxArtifact = {
    schema: ARTIFACT_SCHEMAS.SIGNED_TX,
    hardkasVersion: HARDKAS_VERSION,
    status: "signed",
    createdAt: new Date().toISOString(),
    signedId,

    sourcePlanId: plan.planId,
    sourcePlanPath: input.artifactPath ?? undefined,

    networkId: plan.networkId,
    mode: plan.mode,

    from: plan.from,
    to: plan.to,

    amountSompi: plan.amountSompi,
    amount: plan.amount,

    signedTransaction: {
      format: "simulated",
      payload: `simulated-signed-tx:${plan.planId}`
    },

    metadata: input.metadata
  };

  return artifact;
}

export function signedTxArtifactToJson(artifact: SignedTxArtifact): string {
  return JSON.stringify(artifact, null, 2) + "\n";
}

export interface BroadcastableSignedTx {
  readonly networkId: string;
  readonly mode: HardkasArtifactMode;
  readonly rawTransaction: string;
}

/**
 * Extracts and validates a broadcastable transaction from a signed artifact.
 */
export function getBroadcastableSignedTransaction(
  artifact: SignedTxArtifact
): BroadcastableSignedTx {
  if (artifact.status !== "signed") {
    throw new Error(`Signed artifact is in invalid state: ${artifact.status}`);
  }

  const networkId = artifact.networkId;

  if (artifact.mode === "simulated") {
    return {
      networkId,
      mode: "simulated",
      rawTransaction: artifact.signedTransaction?.payload || "simulated-tx-placeholder"
    };
  }

  if (!artifact.signedTransaction) {
    throw new Error("Signed artifact is missing the 'signedTransaction' object.");
  }

  if (artifact.signedTransaction.format === "unknown") {
    throw new Error("Signed artifact has an unknown transaction format.");
  }

  if (!artifact.signedTransaction.payload) {
    throw new Error("Signed artifact is missing the raw transaction payload.");
  }

  return {
    networkId,
    mode: artifact.mode,
    rawTransaction: artifact.signedTransaction.payload
  };
}
