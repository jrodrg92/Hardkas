import type { TxPlanArtifact, SignedTxArtifact } from "./types.js";

export interface ArtifactValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateTxPlanArtifact(value: unknown): ArtifactValidationResult {
  const errors: string[] = [];
  
  if (typeof value !== "object" || value === null) {
    return { ok: false, errors: ["Artifact must be an object"] };
  }

  const v = value as any;

  if (v.schema !== "hardkas.txPlan") errors.push("Invalid schema: expected 'hardkas.txPlan'");
  if (v.version !== 1) errors.push("Unsupported version: expected 1");
  if (v.status !== "unsigned") errors.push("Invalid status: expected 'unsigned'");
  
  if (typeof v.network !== "string") errors.push("Missing or invalid network");
  if (!["simulated", "kaspa-node", "kaspa-rpc"].includes(v.mode)) errors.push("Invalid mode");

  if (!v.from || typeof v.from.address !== "string") errors.push("Missing or invalid 'from' address");
  if (!v.to || typeof v.to.address !== "string") errors.push("Missing or invalid 'to' address");

  if (typeof v.amountSompi !== "string" || isNaN(Number(v.amountSompi))) errors.push("Invalid amountSompi");
  
  if (!Array.isArray(v.selectedUtxos)) errors.push("Missing or invalid 'selectedUtxos' array");
  if (!Array.isArray(v.outputs)) errors.push("Missing or invalid 'outputs' array");

  if (typeof v.estimatedMass !== "string") errors.push("Missing or invalid estimatedMass");
  if (typeof v.estimatedFeeSompi !== "string") errors.push("Missing or invalid estimatedFeeSompi");
  if (typeof v.changeSompi !== "string") errors.push("Missing or invalid changeSompi");

  return {
    ok: errors.length === 0,
    errors
  };
}

export function assertValidTxPlanArtifact(value: unknown): asserts value is TxPlanArtifact {
  const result = validateTxPlanArtifact(value);
  if (!result.ok) {
    throw new Error(`Invalid tx plan artifact:\n${result.errors.map(e => `- ${e}`).join("\n")}`);
  }
}

export function validateSignedTxArtifact(value: unknown): ArtifactValidationResult {
  const errors: string[] = [];
  
  if (typeof value !== "object" || value === null) {
    return { ok: false, errors: ["Artifact must be an object"] };
  }

  const v = value as any;

  if (v.schema !== "hardkas.signedTx") errors.push("Invalid schema: expected 'hardkas.signedTx'");
  if (v.version !== 1) errors.push("Unsupported version: expected 1");
  if (v.status !== "signed") errors.push("Invalid status: expected 'signed'");
  
  if (!v.source || v.source.schema !== "hardkas.txPlan") errors.push("Missing or invalid source plan schema");
  
  if (typeof v.network !== "string") errors.push("Missing or invalid network");
  if (!["simulated", "kaspa-node", "kaspa-rpc"].includes(v.mode)) errors.push("Invalid mode");

  if (!v.from || typeof v.from.address !== "string") errors.push("Missing or invalid 'from' address");
  if (!v.to || typeof v.to.address !== "string") errors.push("Missing or invalid 'to' address");

  if (typeof v.amountSompi !== "string" || isNaN(Number(v.amountSompi))) errors.push("Invalid amountSompi");
  
  if (!Array.isArray(v.selectedUtxos)) errors.push("Missing or invalid 'selectedUtxos' array");
  if (!Array.isArray(v.outputs)) errors.push("Missing or invalid 'outputs' array");

  if (typeof v.estimatedMass !== "string") errors.push("Missing or invalid estimatedMass");
  if (typeof v.estimatedFeeSompi !== "string") errors.push("Missing or invalid estimatedFeeSompi");
  if (typeof v.changeSompi !== "string") errors.push("Missing or invalid changeSompi");

  if (!v.signature || !["simulated", "kaspa", "kaspa-placeholder", "external-wallet"].includes(v.signature.kind)) {
    errors.push("Missing or invalid signature kind");
  }
  if (v.signature && typeof v.signature.value !== "string") errors.push("Missing or invalid signature value");

  return {
    ok: errors.length === 0,
    errors
  };
}

export function assertValidSignedTxArtifact(value: unknown): asserts value is SignedTxArtifact {
  const result = validateSignedTxArtifact(value);
  if (!result.ok) {
    throw new Error(`Invalid signed tx artifact:\n${result.errors.map(e => `- ${e}`).join("\n")}`);
  }
}
