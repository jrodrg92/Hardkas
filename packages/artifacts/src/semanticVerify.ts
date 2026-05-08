import { ArtifactVerificationResult, VerificationIssue, VerificationSeverity } from "./verify.js";
import { TxPlanV2, SignedTxV2, TxReceiptV2 } from "./schemas.js";
import { estimateTransactionMassV2 } from "@hardkas/tx-builder";

export interface SemanticVerifyOptions {
  plan?: TxPlanV2;
  strict?: boolean;
}

/**
 * Performs deep semantic verification of a HardKAS artifact.
 * Validates economic invariants, lineage, and operational consistency.
 */
export function verifyArtifactSemantics(
  artifact: any,
  options: SemanticVerifyOptions = {}
): ArtifactVerificationResult {
  const result: ArtifactVerificationResult = {
    ok: true,
    artifactType: artifact.schema,
    version: artifact.version,
    errors: [],
    issues: []
  };

  const addIssue = (code: string, severity: VerificationSeverity, message: string, path?: string) => {
    result.issues.push({ code, severity, message, path });
    if (severity === "error" || severity === "critical") {
      result.errors.push(message);
      result.ok = false;
    }
  };

  // 1. Lineage & Consistency Checks
  if (artifact.schema === "hardkas.txPlan.v2") {
    verifyTxPlanSemantics(artifact as TxPlanV2, addIssue);
  } else if (artifact.schema === "hardkas.signedTx.v2") {
    verifySignedTxSemantics(artifact as SignedTxV2, addIssue, options.plan);
  } else if (artifact.schema === "hardkas.txReceipt.v2") {
    verifyTxReceiptSemantics(artifact as TxReceiptV2, addIssue);
  }

  return result;
}

function verifyTxPlanSemantics(plan: TxPlanV2, addIssue: Function) {
  // A. Simulation vs Real separation
  if (plan.mode === "simulated" && plan.networkId !== "simnet") {
    addIssue("ENV_CONSISTENCY_FAILURE", "error", `Environment mismatch: simulated plan must target 'simnet', but targets '${plan.networkId}'`);
  }
  if (plan.mode !== "simulated" && plan.networkId === "simnet") {
    addIssue("ENV_CONSISTENCY_FAILURE", "warning", `Environment suspicion: non-simulated plan targets 'simnet'. Use simulated mode for simnet development.`);
  }

  // B. Address Integrity
  if (!plan.from.address.includes(":")) {
    addIssue("INVALID_ADDRESS_FORMAT", "error", `From address '${plan.from.address}' is missing prefix (e.g. kaspa:)`, "from.address");
  }
  if (!plan.to.address.includes(":")) {
    addIssue("INVALID_ADDRESS_FORMAT", "error", `To address '${plan.to.address}' is missing prefix (e.g. kaspa:)`, "to.address");
  }

  // C. Mass Recomputation
  const massResult = estimateTransactionMassV2({
    inputCount: plan.inputs.length,
    outputs: plan.outputs as any,
    hasChange: !!plan.change
  });

  const expectedMass = BigInt(plan.estimatedMass);
  if (massResult.mass !== expectedMass) {
    addIssue("MASS_MISMATCH", "critical", `Mass recomputation mismatch: artifact says ${expectedMass}, recomputed ${massResult.mass}`);
  }

  // C. Economic Invariants (Input sum >= Output sum + Fee)
  const totalIn = plan.inputs.reduce((sum, i) => sum + BigInt(i.amountSompi), 0n);
  const totalOut = plan.outputs.reduce((sum, o) => sum + BigInt(o.amountSompi), 0n);
  const change = plan.change ? BigInt(plan.change.amountSompi) : 0n;
  const fee = BigInt(plan.estimatedFeeSompi);

  if (totalIn < totalOut + change + fee) {
    addIssue("INSUFFICIENT_FUNDS", "critical", `Economic invariant failure: total inputs (${totalIn}) < total outputs (${totalOut + change + fee})`);
  }
}

function verifySignedTxSemantics(signed: SignedTxV2, addIssue: Function, plan?: TxPlanV2) {
  // A. Lineage Check
  if (plan) {
    if (signed.sourcePlanId !== plan.planId) {
      addIssue("LINEAGE_MISMATCH", "critical", `Lineage mismatch: signed artifact references plan ${signed.sourcePlanId}, but ${plan.planId} was provided`);
    }

    // B. Immutable Field Protection
    if (signed.amountSompi !== plan.amountSompi) {
      addIssue("IMMUTABLE_FIELD_MUTATION", "critical", `Security violation: amountSompi changed from ${plan.amountSompi} to ${signed.amountSompi} after signing`);
    }
    if (signed.networkId !== plan.networkId) {
      addIssue("NETWORK_MISMATCH", "critical", `Security violation: networkId changed from ${plan.networkId} to ${signed.networkId} after signing`);
    }
  }

  // C. Payload Check
  if (!signed.signedTransaction.payload) {
    addIssue("MISSING_PAYLOAD", "error", "Signed transaction is missing its raw payload");
  }
}

function verifyTxReceiptSemantics(receipt: TxReceiptV2, addIssue: Function) {
  if (receipt.status === "failed" && !receipt.txId) {
    // This is fine
  } else if (!receipt.txId) {
    addIssue("MISSING_TXID", "error", "Success receipt is missing transaction ID");
  }

  if (receipt.mode === "simulated" && !receipt.tracePath) {
    addIssue("MISSING_TRACE", "warning", "Simulated receipt is missing trace path");
  }
}
