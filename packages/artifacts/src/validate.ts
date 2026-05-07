import type { TxPlanArtifact, SignedTxArtifact, RealTxPlanArtifact, RealSignedTxArtifact, RealTxSubmitReceipt } from "./types.js";
import { ARTIFACT_SCHEMAS } from "./constants.js";

export interface ArtifactValidationResult {
  ok: boolean;
  errors: string[];
}

export function isRealTxPlanArtifact(value: unknown): value is RealTxPlanArtifact {
  return validateRealTxPlanArtifact(value).ok;
}

export function validateRealTxPlanArtifact(value: unknown): ArtifactValidationResult {
  const errors: string[] = [];
  
  if (typeof value !== "object" || value === null) {
    return { ok: false, errors: ["Artifact must be an object"] };
  }

  const v = value as any;

  if (v.schema !== ARTIFACT_SCHEMAS.REAL_TX_PLAN) errors.push(`Invalid schema: expected '${ARTIFACT_SCHEMAS.REAL_TX_PLAN}'`);
  if (!v.hardkasVersion) errors.push("Missing hardkasVersion");
  if (!v.createdAt) errors.push("Missing createdAt");
  if (v.status !== "built") errors.push("Invalid status: expected 'built'");
  
  if (typeof v.networkId !== "string") errors.push("Missing or invalid networkId");
  if (!["node", "rpc"].includes(v.mode)) errors.push("Invalid mode: expected 'node' or 'rpc'");

  if (!v.from || typeof v.from.address !== "string") errors.push("Missing or invalid 'from' address");
  if (!v.to || typeof v.to.address !== "string") errors.push("Missing or invalid 'to' address");

  if (typeof v.amountSompi !== "string" || !isValidBigIntString(v.amountSompi)) {
    errors.push("Invalid amountSompi: must be a valid bigint string");
  }
  if (typeof v.feeRateSompiPerMass !== "string" || !isValidBigIntString(v.feeRateSompiPerMass)) {
    errors.push("Invalid feeRateSompiPerMass: must be a valid bigint string");
  }
  
  if (!Array.isArray(v.selectedUtxos)) {
    errors.push("Missing or invalid 'selectedUtxos' array");
  } else {
    v.selectedUtxos.forEach((u: any, i: number) => {
      if (!u.outpoint || typeof u.outpoint.transactionId !== "string") {
        errors.push(`UTXO[${i}]: Missing or invalid transactionId`);
      }
      if (typeof u.amountSompi !== "string" || !isValidBigIntString(u.amountSompi)) {
        errors.push(`UTXO[${i}]: Invalid amountSompi`);
      }
    });
  }

  if (!Array.isArray(v.outputs)) {
    errors.push("Missing or invalid 'outputs' array");
  }

  if (typeof v.estimatedMass !== "string" || !isValidBigIntString(v.estimatedMass)) {
    errors.push("Invalid estimatedMass");
  }
  if (typeof v.estimatedFeeSompi !== "string" || !isValidBigIntString(v.estimatedFeeSompi)) {
    errors.push("Invalid estimatedFeeSompi");
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function assertValidRealTxPlanArtifact(value: unknown): asserts value is RealTxPlanArtifact {
  const result = validateRealTxPlanArtifact(value);
  if (!result.ok) {
    throw new Error(`Invalid real tx plan artifact:\n${result.errors.map(e => `- ${e}`).join("\n")}`);
  }
}

function isValidBigIntString(val: string): boolean {
  try {
    BigInt(val);
    return true;
  } catch {
    return false;
  }
}

export function validateTxPlanArtifact(value: unknown): ArtifactValidationResult {
  const errors: string[] = [];
  
  if (typeof value !== "object" || value === null) {
    return { ok: false, errors: ["Artifact must be an object"] };
  }

  const v = value as any;

  if (v.schema !== ARTIFACT_SCHEMAS.TX_PLAN) errors.push(`Invalid schema: expected '${ARTIFACT_SCHEMAS.TX_PLAN}'`);
  if (!v.hardkasVersion) errors.push("Missing hardkasVersion");
  if (!v.createdAt) errors.push("Missing createdAt");
  if (v.status !== "unsigned") errors.push("Invalid status: expected 'unsigned'");
  
  if (typeof v.networkId !== "string") errors.push("Missing or invalid networkId");
  if (!["simulated", "node", "rpc"].includes(v.mode)) errors.push("Invalid mode");

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

  if (v.schema !== ARTIFACT_SCHEMAS.SIGNED_TX) errors.push(`Invalid schema: expected '${ARTIFACT_SCHEMAS.SIGNED_TX}'`);
  if (!v.hardkasVersion) errors.push("Missing hardkasVersion");
  if (!v.createdAt) errors.push("Missing createdAt");
  if (v.status !== "signed") errors.push("Invalid status: expected 'signed'");
  
  if (!v.source || (v.source.schema !== ARTIFACT_SCHEMAS.TX_PLAN && v.source.schema !== "hardkas.txPlan")) errors.push("Missing or invalid source plan schema");
  
  if (typeof v.networkId !== "string") errors.push("Missing or invalid networkId");
  if (!["simulated", "node", "rpc"].includes(v.mode)) errors.push("Invalid mode");

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

export function isRealSignedTxArtifact(value: unknown): value is RealSignedTxArtifact {
  return validateRealSignedTxArtifact(value).ok;
}

export function validateRealSignedTxArtifact(value: unknown): ArtifactValidationResult {
  const errors: string[] = [];
  
  if (typeof value !== "object" || value === null) {
    return { ok: false, errors: ["Artifact must be an object"] };
  }

  const v = value as any;

  if (v.schema !== ARTIFACT_SCHEMAS.REAL_SIGNED_TX) errors.push(`Invalid schema: expected '${ARTIFACT_SCHEMAS.REAL_SIGNED_TX}'`);
  if (!v.hardkasVersion) errors.push("Missing hardkasVersion");
  if (!v.createdAt) errors.push("Missing createdAt");
  if (v.status !== "signed") errors.push("Invalid status: expected 'signed'");
  
  if (typeof v.signedId !== "string" || !v.signedId) errors.push("Missing or invalid signedId");
  if (typeof v.sourcePlanId !== "string" || !v.sourcePlanId) errors.push("Missing or invalid sourcePlanId");
  if (typeof v.networkId !== "string") errors.push("Missing or invalid networkId");
  if (!["node", "rpc"].includes(v.mode)) errors.push("Invalid mode: expected 'node' or 'rpc'");

  if (!v.from || typeof v.from.address !== "string") errors.push("Missing or invalid 'from' address");
  if (!v.to || typeof v.to.address !== "string") errors.push("Missing or invalid 'to' address");

  if (typeof v.amountSompi !== "string" || !isValidBigIntString(v.amountSompi)) {
    errors.push("Invalid amountSompi: must be a valid bigint string");
  }
  if (typeof v.feeSompi !== "string" || !isValidBigIntString(v.feeSompi)) {
    errors.push("Invalid feeSompi: must be a valid bigint string");
  }
  
  if (!Array.isArray(v.selectedUtxos)) {
    errors.push("Missing or invalid 'selectedUtxos' array");
  }

  if (!v.signedTransaction) {
    errors.push("Missing signedTransaction object");
  } else {
    if (!["kaspa-sdk", "hex", "json", "unknown"].includes(v.signedTransaction.format)) {
      errors.push("Invalid signedTransaction.format");
    }
    if (typeof v.signedTransaction.payload !== "string" || !v.signedTransaction.payload) {
      errors.push("Missing or empty signedTransaction.payload");
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function assertValidRealSignedTxArtifact(value: unknown): asserts value is RealSignedTxArtifact {
  const result = validateRealSignedTxArtifact(value);
  if (!result.ok) {
    throw new Error(`Invalid real signed tx artifact:\n${result.errors.map(e => `- ${e}`).join("\n")}`);
  }
}

export function validateArtifact(data: unknown): ArtifactValidationResult {
  if (!data || typeof data !== "object") {
    return { ok: false, errors: ["Artifact must be an object"] };
  }

  const v = data as any;
  const schema = v.schema || v.kind;

  switch (schema) {
    case ARTIFACT_SCHEMAS.TX_PLAN:
    case "hardkas.txPlan":
      return validateTxPlanArtifact(data);
    case ARTIFACT_SCHEMAS.SIGNED_TX:
    case "hardkas.signedTx":
      return validateSignedTxArtifact(data);
    case ARTIFACT_SCHEMAS.REAL_TX_PLAN:
    case "hardkas.realTxPlan":
      return validateRealTxPlanArtifact(data);
    case ARTIFACT_SCHEMAS.REAL_SIGNED_TX:
    case "hardkas.realSignedTx":
      return validateRealSignedTxArtifact(data);
    case ARTIFACT_SCHEMAS.REAL_TX_SUBMIT_RECEIPT:
    case "hardkas.realTxSubmitReceipt":
      return validateRealTxSubmitReceipt(data);
    default:
      return { ok: false, errors: [`Unknown artifact schema/kind: ${schema}`] };
  }
}

export function isRealTxSubmitReceipt(value: unknown): value is RealTxSubmitReceipt {
  return validateRealTxSubmitReceipt(value).ok;
}

export function validateRealTxSubmitReceipt(value: unknown): ArtifactValidationResult {
  const errors: string[] = [];
  
  if (typeof value !== "object" || value === null) {
    return { ok: false, errors: ["Artifact must be an object"] };
  }

  const v = value as any;

  if (v.schema !== ARTIFACT_SCHEMAS.REAL_TX_SUBMIT_RECEIPT) errors.push(`Invalid schema: expected '${ARTIFACT_SCHEMAS.REAL_TX_SUBMIT_RECEIPT}'`);
  if (!v.hardkasVersion) errors.push("Missing hardkasVersion");
  if (!v.createdAt) errors.push("Missing createdAt");
  if (v.status !== "submitted") errors.push("Invalid status: expected 'submitted'");
  
  if (typeof v.txId !== "string" || !v.txId) errors.push("Missing or invalid txId");
  if (typeof v.sourceSignedId !== "string" || !v.sourceSignedId) errors.push("Missing or invalid sourceSignedId");
  if (typeof v.networkId !== "string") errors.push("Missing or invalid networkId");
  if (typeof v.mode !== "string") errors.push("Missing or invalid mode");
  if (typeof v.rpcUrl !== "string") errors.push("Missing or invalid rpcUrl");

  return {
    ok: errors.length === 0,
    errors
  };
}

export function assertValidRealTxSubmitReceipt(value: unknown): asserts value is RealTxSubmitReceipt {
  const result = validateRealTxSubmitReceipt(value);
  if (!result.ok) {
    throw new Error(`Invalid real tx submit receipt artifact:\n${result.errors.map(e => `- ${e}`).join("\n")}`);
  }
}
