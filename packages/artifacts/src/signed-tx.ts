import { hashTxPlanArtifact } from "./tx-plan.js";
import { validateTxPlanArtifact } from "./validate.js";
import type { TxPlanArtifact, SignedTxArtifact } from "./types.js";

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
  const { plan, account } = input;
  
  // Basic sanity check
  const validation = validateTxPlanArtifact(plan);
  if (!validation.ok) {
    throw new Error(`Cannot sign invalid TxPlanArtifact: ${validation.errors.join(", ")}`);
  }

  if (plan.status !== "unsigned") {
    throw new Error(`Cannot sign artifact with status: ${plan.status}`);
  }

  const planHash = hashTxPlanArtifact(plan);

  return {
    schema: "hardkas.signedTx",
    version: 1,
    status: "signed",
    createdAt: new Date().toISOString(),

    source: {
      schema: "hardkas.txPlan",
      version: 1,
      artifactPath: input.artifactPath,
      planHash
    },

    network: plan.network,
    mode: plan.mode,

    from: plan.from,
    to: plan.to,

    amountSompi: plan.amountSompi,
    amount: plan.amount,

    selectedUtxos: plan.selectedUtxos,
    outputs: plan.outputs,

    estimatedMass: plan.estimatedMass,
    estimatedFeeSompi: plan.estimatedFeeSompi,
    estimatedFee: plan.estimatedFee,
    changeSompi: plan.changeSompi,
    change: plan.change,

    signature: {
      kind: "simulated",
      account,
      signerAddress: input.signerAddress,
      value: `simulated:${account}:${planHash}`
    },

    signedTransaction: {
      encoding: "simulated",
      value: `simulated-signed-tx:${planHash}`
    },

    metadata: input.metadata
  };
}

export function signedTxArtifactToJson(artifact: SignedTxArtifact): string {
  return JSON.stringify(artifact, null, 2) + "\n";
}

export interface BroadcastableSignedTx {
  readonly network: string;
  readonly mode: "kaspa-node" | "kaspa-rpc" | "simulated";
  readonly rawTransaction: string;
}

/**
 * Extracts and validates a broadcastable transaction from a signed artifact.
 * For real networks, it extracts the raw transaction.
 * For simulated networks, it allows the artifact but returns a placeholder.
 */
export function getBroadcastableSignedTransaction(
  artifact: SignedTxArtifact
): BroadcastableSignedTx {
  if (artifact.status !== "signed") {
    throw new Error(`Signed artifact is in invalid state: ${artifact.status}`);
  }

  if (artifact.mode === "simulated") {
    return {
      network: artifact.network,
      mode: "simulated",
      rawTransaction: artifact.signedTransaction?.value || "simulated-tx-placeholder"
    };
  }

  if (artifact.signature.kind !== "kaspa") {
    throw new Error(`Signed artifact is not broadcastable: signature kind is '${artifact.signature.kind}' (expected 'kaspa').`);
  }

  if (!artifact.signedTransaction) {
    throw new Error("Signed artifact is missing the 'signedTransaction' object.");
  }

  if (artifact.signedTransaction.encoding !== "kaspa-raw") {
    throw new Error(`Signed artifact is not broadcastable: expected signedTransaction.encoding = 'kaspa-raw' (got '${artifact.signedTransaction.encoding}').`);
  }

  if (!artifact.signedTransaction.value) {
    throw new Error("Signed artifact is missing the raw transaction value.");
  }

  return {
    network: artifact.network,
    mode: artifact.mode,
    rawTransaction: artifact.signedTransaction.value
  };
}
