import type { TxPlanArtifact, SignedTxArtifact } from "./types.js";

export function formatTxPlanArtifact(artifact: TxPlanArtifact): string {
  const lines: string[] = [];

  lines.push("HardKAS tx plan artifact");
  lines.push("");
  lines.push(`Schema:       ${artifact.schema}`);
  lines.push(`Tool version: ${artifact.hardkasVersion || "legacy"}`);
  lines.push(`Status:       ${artifact.status}`);
  lines.push(`Created:      ${artifact.createdAt}`);
  lines.push("");
  lines.push(`Network:      ${artifact.networkId || (artifact as any).network}`);
  lines.push(`Mode:         ${artifact.mode}`);
  lines.push(`RPC:          ${artifact.rpcUrl || "none"}`);
  lines.push("");
  lines.push(`From:   ${artifact.from.address} (${artifact.from.input})`);
  lines.push(`To:     ${artifact.to.address} (${artifact.to.input})`);
  lines.push(`Amount: ${artifact.amount}`);
  lines.push("");
  lines.push(`Selected UTXOs: ${artifact.selectedUtxos.length}`);
  for (const utxo of artifact.selectedUtxos) {
    lines.push(`  - ${utxo.txId}:${utxo.outputIndex}  ${utxo.amount}`);
  }
  lines.push("");
  lines.push("Outputs:");
  for (const output of artifact.outputs) {
    lines.push(`  - ${(output.address || "unknown").padEnd(24)} ${output.amount}${output.kind === "change" ? " change" : ""}`);
  }
  lines.push("");
  lines.push(`Estimated mass: ${artifact.estimatedMass}`);
  lines.push(`Estimated fee:  ${artifact.estimatedFee}`);
  lines.push(`Change:         ${artifact.change}`);
  lines.push("");
  lines.push("Next:");
  lines.push("  future hardkas tx sign <artifact>");
  lines.push("  future hardkas tx send <artifact>");

  return lines.join("\n");
}

export function formatSignedTxArtifact(artifact: SignedTxArtifact): string {
  const lines: string[] = [];

  lines.push("HardKAS signed tx artifact");
  lines.push("");
  lines.push(`Schema:       ${artifact.schema}`);
  lines.push(`Tool version: ${artifact.hardkasVersion || "legacy"}`);
  lines.push(`Status:       ${artifact.status}`);
  lines.push(`Created:      ${artifact.createdAt}`);
  lines.push("");
  lines.push(`Source plan hash: ${artifact.source.planHash || "none"}`);
  lines.push("");
  lines.push(`Network:      ${artifact.networkId || (artifact as any).network}`);
  lines.push(`Mode:         ${artifact.mode}`);
  lines.push("");
  lines.push(`From:   ${artifact.from.address} (${artifact.from.input})`);
  lines.push(`To:     ${artifact.to.address} (${artifact.to.input})`);
  lines.push(`Amount: ${artifact.amount}`);
  lines.push("");
  lines.push(`Selected UTXOs: ${artifact.selectedUtxos.length}`);
  for (const utxo of artifact.selectedUtxos) {
    lines.push(`  - ${utxo.txId}:${utxo.outputIndex}  ${utxo.amount}`);
  }
  lines.push("");
  lines.push("Outputs:");
  for (const output of artifact.outputs) {
    lines.push(`  - ${(output.address || "unknown").padEnd(24)} ${output.amount}${output.kind === "change" ? " change" : ""}`);
  }
  lines.push("");
  lines.push(`Estimated mass: ${artifact.estimatedMass}`);
  lines.push(`Estimated fee:  ${artifact.estimatedFee}`);
  lines.push(`Change:         ${artifact.change}`);
  lines.push("");
  lines.push("Signature:");
  lines.push(`  kind:    ${artifact.signature.kind}`);
  lines.push(`  account: ${artifact.signature.account}`);
  if (artifact.signature.signerAddress) {
    lines.push(`  signer:  ${artifact.signature.signerAddress}`);
  }
  lines.push("");
  if (artifact.signedTransaction) {
    lines.push("Signed transaction:");
    lines.push(`  encoding: ${artifact.signedTransaction.encoding}`);
    lines.push(`  value:    ${artifact.signedTransaction.value}`);
    lines.push("");
  }
  lines.push("Next:");
  lines.push("  future hardkas tx send <artifact>");

  return lines.join("\n");
}
