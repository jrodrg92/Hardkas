import { createHash } from "node:crypto";
import { formatSompi } from "@hardkas/core";
import type { TxPlan } from "@hardkas/tx-builder";
import type { TxPlanArtifact } from "./types.js";
import { HARDKAS_VERSION, ARTIFACT_SCHEMAS } from "./constants.js";

export interface CreateTxPlanArtifactInput {
  networkId: string;
  mode: "simulated" | "node" | "rpc";
  rpcUrl?: string | null;
  from: {
    input: string;
    address: string;
  };
  to: {
    input: string;
    address: string;
  };
  amountSompi: bigint;
  plan: TxPlan;
  metadata?: TxPlanArtifact["metadata"];
}

export function createTxPlanArtifact(input: CreateTxPlanArtifactInput): TxPlanArtifact {
  const artifact: TxPlanArtifact = {
    schema: ARTIFACT_SCHEMAS.TX_PLAN,
    hardkasVersion: HARDKAS_VERSION,
    status: "built", // Changed from "unsigned" to "built" to match new types
    createdAt: new Date().toISOString(),
    networkId: input.networkId,
    mode: input.mode,
    planId: "", // Placeholder
    rpcUrl: input.rpcUrl,
    from: input.from,
    to: input.to,
    amountSompi: input.amountSompi.toString(),
    amount: formatSompi(input.amountSompi),
    selectedUtxos: input.plan.inputs.map(utxo => ({
      outpoint: {
        transactionId: utxo.outpoint.transactionId,
        index: utxo.outpoint.index
      },
      address: utxo.address,
      amountSompi: utxo.amountSompi.toString(),
      scriptPublicKey: utxo.scriptPublicKey
    })),
    outputs: input.plan.outputs.map(output => ({
      address: output.address,
      amountSompi: output.amountSompi.toString(),
      amount: formatSompi(output.amountSompi),
      script: output.scriptPublicKey
    })),
    change: input.plan.change ? {
      address: input.plan.change.address,
      amountSompi: input.plan.change.amountSompi.toString(),
      amount: formatSompi(input.plan.change.amountSompi),
      script: input.plan.change.scriptPublicKey
    } : undefined,
    estimatedMass: input.plan.estimatedMass.toString(),
    estimatedFeeSompi: input.plan.estimatedFeeSompi.toString(),
    estimatedFee: formatSompi(input.plan.estimatedFeeSompi),
    metadata: input.metadata
  };

  artifact.planId = hashTxPlanArtifact(artifact).substring(0, 16);
  return artifact;
}

export function txPlanArtifactToJson(artifact: TxPlanArtifact): string {
  return JSON.stringify(artifact, null, 2) + "\n";
}

/**
 * Generates a stable SHA-256 hash of a TxPlanArtifact.
 */
export function hashTxPlanArtifact(artifact: TxPlanArtifact): string {
  const stable = stableStringify(artifact);
  return createHash("sha256").update(stable).digest("hex");
}

function stableStringify(val: any): string {
  if (val === null || typeof val !== "object" || Array.isArray(val)) {
    return JSON.stringify(val);
  }

  const sortedKeys = Object.keys(val).sort();
  return "{" + sortedKeys
    .filter(k => val[k] !== undefined)
    .map(k => `"${k}":${stableStringify(val[k])}`)
    .join(",") + "}";
}
