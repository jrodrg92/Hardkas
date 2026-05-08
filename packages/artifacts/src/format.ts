import type { TxPlanArtifact, SignedTxArtifact } from "./types.js";

export function formatTxPlanArtifact(artifact: TxPlanArtifact): string {
  const lines: string[] = [];

  lines.push("HardKAS Transaction Plan Artifact");
  lines.push("================================");
  lines.push(`Plan ID:      ${artifact.planId}`);
  lines.push(`Schema:       ${artifact.schema}`);
  lines.push(`Status:       ${artifact.status}`);
  lines.push(`Created:      ${artifact.createdAt}`);
  lines.push("");
  lines.push(`Network:      ${artifact.networkId}`);
  lines.push(`Mode:         ${artifact.mode}`);
  lines.push(`RPC:          ${artifact.rpcUrl || "none"}`);
  lines.push("");
  lines.push(`From:         ${artifact.from.address} (${artifact.from.input})`);
  lines.push(`To:           ${artifact.to.address} (${artifact.to.input})`);
  lines.push(`Amount:       ${artifact.amount}`);
  lines.push("");
  lines.push(`Selected UTXOs: ${artifact.selectedUtxos.length}`);
  for (const utxo of artifact.selectedUtxos) {
    lines.push(`  - ${utxo.outpoint.transactionId}:${utxo.outpoint.index}  ${utxo.amountSompi} sompi`);
  }
  lines.push("");
  lines.push("Outputs:");
  for (const output of artifact.outputs) {
    lines.push(`  - ${(output.address || "unknown").padEnd(24)} ${output.amountSompi} sompi`);
  }
  if (artifact.change) {
    lines.push(`  - ${artifact.change.address.padEnd(24)} ${artifact.change.amountSompi} sompi (change)`);
  }
  lines.push("");
  lines.push(`Estimated mass: ${artifact.estimatedMass}`);
  lines.push(`Estimated fee:  ${artifact.estimatedFee}`);
  lines.push("");
  lines.push("Next:");
  lines.push("  hardkas tx sign <artifact>");

  return lines.join("\n");
}

export function formatSignedTxArtifact(artifact: SignedTxArtifact): string {
  const lines: string[] = [];

  lines.push("HardKAS Signed Transaction Artifact");
  lines.push("===================================");
  lines.push(`Signed ID:    ${artifact.signedId}`);
  lines.push(`Source Plan:  ${artifact.sourcePlanId}`);
  lines.push(`Schema:       ${artifact.schema}`);
  lines.push(`Status:       ${artifact.status}`);
  lines.push(`Created:      ${artifact.createdAt}`);
  lines.push("");
  lines.push(`Network:      ${artifact.networkId}`);
  lines.push(`Mode:         ${artifact.mode}`);
  lines.push("");
  lines.push(`From:         ${artifact.from.address} (${artifact.from.input})`);
  lines.push(`To:           ${artifact.to.address} (${artifact.to.input})`);
  lines.push(`Amount:       ${artifact.amount}`);
  lines.push("");
  
  if (artifact.signedTransaction) {
    lines.push("Signed Transaction Details:");
    lines.push(`  Format:     ${artifact.signedTransaction.format}`);
    lines.push(`  Payload:    ${artifact.signedTransaction.payload.substring(0, 64)}...`);
  }
  
  lines.push("");
  lines.push("Next:");
  lines.push("  hardkas tx send <artifact>");

  return lines.join("\n");
}
