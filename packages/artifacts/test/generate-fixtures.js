import fs from "node:fs";
import path from "node:path";
import { calculateContentHash } from "./packages/artifacts/src/canonical.js";

const fixturesDir = "packages/artifacts/test/fixtures";

function writeFixture(dir, name, artifact) {
  const fullDir = path.join(fixturesDir, dir);
  if (!fs.existsSync(fullDir)) fs.mkdirSync(fullDir, { recursive: true });
  
  // Calculate hash
  const hash = calculateContentHash(artifact);
  artifact.contentHash = hash;
  
  // Ensure lineage matches hash
  if (artifact.lineage) {
    artifact.lineage.artifactId = hash;
  }
  
  fs.writeFileSync(path.join(fullDir, name), JSON.stringify(artifact, null, 2));
  return hash;
}

const rootHash = writeFixture("valid", "snapshot.valid.json", {
  schema: "hardkas.snapshot.v2",
  hardkasVersion: "0.2.0-alpha",
  version: "2.0.0",
  createdAt: new Date().toISOString(),
  daaScore: "1000",
  accounts: [],
  utxos: [],
  lineage: {
    artifactId: "pending",
    lineageId: "flow-1",
    rootArtifactId: "pending"
  }
});

// Update rootArtifactId after hash calculation
const snapshot = JSON.parse(fs.readFileSync(path.join(fixturesDir, "valid", "snapshot.valid.json"), "utf8"));
snapshot.lineage.rootArtifactId = rootHash;
snapshot.lineage.artifactId = rootHash;
fs.writeFileSync(path.join(fixturesDir, "valid", "snapshot.valid.json"), JSON.stringify(snapshot, null, 2));

const planHash = writeFixture("valid", "tx-plan.valid.json", {
  schema: "hardkas.txPlan.v2",
  hardkasVersion: "0.2.0-alpha",
  version: "2.0.0",
  createdAt: new Date().toISOString(),
  networkId: "simnet",
  mode: "simulated",
  planId: "p1",
  from: { address: "kaspa:123" },
  to: { address: "kaspa:456" },
  amountSompi: "1000000",
  estimatedFeeSompi: "1000",
  estimatedMass: "1000",
  inputs: [],
  outputs: [
    { address: "kaspa:456", amountSompi: "1000000" }
  ],
  lineage: {
    artifactId: "pending",
    lineageId: "flow-1",
    parentArtifactId: rootHash,
    rootArtifactId: rootHash,
    sequence: 1
  }
});

writeFixture("valid", "signed-tx.valid.json", {
  schema: "hardkas.signedTx.v2",
  hardkasVersion: "0.2.0-alpha",
  version: "2.0.0",
  createdAt: new Date().toISOString(),
  status: "signed",
  signedId: "s1",
  sourcePlanId: "p1",
  networkId: "simnet",
  mode: "simulated",
  from: { address: "kaspa:123" },
  to: { address: "kaspa:456" },
  amountSompi: "1000000",
  signedTransaction: { format: "hex", payload: "00" },
  lineage: {
    artifactId: "pending",
    lineageId: "flow-1",
    parentArtifactId: planHash,
    rootArtifactId: rootHash,
    sequence: 2
  }
});

console.log("Valid fixtures generated.");
