import { formatSompi } from "@hardkas/core";

/**
 * Generates an operational, human-readable summary of a HardKAS artifact.
 */
export function explainArtifact(artifact: any): string {
  const lines: string[] = [];

  const add = (label: string, value: any) => {
    lines.push(`${label.padEnd(14)}: ${value}`);
  };

  const schema = artifact.schema || "unknown";
  const type = schema.split(".")[1] || "unknown";

  add("TYPE", type.toUpperCase());
  add("NETWORK", artifact.networkId || "N/A");
  
  // Status check (simple for explain, verify does the heavy lifting)
  const isValid = !!artifact.contentHash && !!artifact.version;
  add("STATUS", isValid ? "Valid (Internal Integrity)" : "Invalid or Legacy");

  if (type === "txPlan") {
    add("PLAN ID", artifact.planId);
    add("MODE", artifact.mode);
    add("FROM", artifact.from?.address);
    add("TO", artifact.to?.address);
    add("AMOUNT", formatSompi(artifact.amountSompi));
    add("FEE", formatSompi(artifact.estimatedFeeSompi));
    add("MASS", artifact.estimatedMass);
    add("INPUTS", artifact.inputs?.length || 0);
    add("OUTPUTS", artifact.outputs?.length || 0);
    add("HAS CHANGE", artifact.change ? "Yes" : "No");
  } else if (type === "signedTx") {
    add("SIGNED ID", artifact.signedId);
    add("SOURCE PLAN", artifact.sourcePlanId);
    add("NETWORK", artifact.networkId);
    add("MODE", artifact.mode);
    add("AMOUNT", formatSompi(artifact.amountSompi));
    add("INPUTS", artifact.inputs?.length || 0);
    add("OUTPUTS", artifact.outputs?.length || 0);
    add("SIMULATION", artifact.mode === "simulated" ? "True" : "False");
  } else if (type === "txReceipt") {
    add("TX ID", artifact.txId || "N/A");
    add("STATUS", artifact.status.toUpperCase());
    add("NETWORK", artifact.networkId);
    add("MODE", artifact.mode);
    add("AMOUNT", formatSompi(artifact.amountSompi));
    add("FEE", formatSompi(artifact.feeSompi || "0"));
  }

  return lines.join("\n");
}
