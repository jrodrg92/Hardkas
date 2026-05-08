import { buildPaymentPlan, createMockUtxo } from "@hardkas/tx-builder";
import { createTxPlanArtifact, writeArtifact } from "@hardkas/artifacts";
import path from "node:path";
import fs from "node:fs";

async function main() {
  const alice = "kaspa:qalice";
  const p2shAddr = "kaspa:ppvkp8f..."; // Starts with p
  
  const utxos = [
    createMockUtxo({ address: alice, amountSompi: 10000n })
  ];

  const plan = buildPaymentPlan({
    fromAddress: alice,
    availableUtxos: utxos,
    outputs: [{ address: p2shAddr, amountSompi: 1000n }],
    feeRateSompiPerMass: 1n
  });

  const artifact = createTxPlanArtifact({
    networkId: "simnet",
    mode: "simulated",
    from: { address: alice, input: "alice" },
    to: { address: p2shAddr, input: "p2sh" },
    amountSompi: 1000n,
    plan
  });

  const outPath = path.join(process.cwd(), "p2sh-plan.json");
  await writeArtifact(outPath, artifact);
  console.log(`Saved P2SH plan to ${outPath}`);
}

main();
