import { describe, it, expect } from "vitest";
import { createTxPlanArtifact } from "../src/tx-plan.js";
import { verifyArtifactSemantics } from "../src/semanticVerify.js";
import { createSimulatedSignedTxArtifact } from "../src/signed-tx.js";

describe("Semantic Verification", () => {
  const basePlan = {
    inputs: [{
      outpoint: { transactionId: "tx1", index: 0 },
      amountSompi: 1000n,
      address: "addr1",
      scriptPublicKey: "spk"
    }],
    outputs: [{ address: "addr2", amountSompi: 500n }],
    change: { address: "addr1", amountSompi: 490n },
    estimatedFeeSompi: 10n,
    estimatedMass: 250n // Standard P2PK/Schnorr mass for 1 in, 2 out is 100 + 150 + (50*2) = 350? 
    // Wait, let's check constants: BASE=100, IN=150, OUT=50. 
    // 1 in, 2 out = 100 + 150 + 100 = 350.
  };

  it("should fail on mass mismatch", () => {
    const artifact = createTxPlanArtifact({
      networkId: "simnet",
      mode: "simulated",
      from: { input: "alice", address: "addr1" },
      to: { input: "addr2", address: "addr2" },
      amountSompi: 500n,
      plan: { ...basePlan, estimatedMass: 250n } as any
    });

    const result = verifyArtifactSemantics(artifact);
    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.code === "MASS_MISMATCH")).toBe(true);
  });

  it("should pass on valid plan", () => {
    const artifact = createTxPlanArtifact({
      networkId: "simnet",
      mode: "simulated",
      from: { input: "alice", address: "addr1" },
      to: { input: "addr2", address: "addr2" },
      amountSompi: 500n,
      plan: { ...basePlan, estimatedMass: 350n } as any
    });

    const result = verifyArtifactSemantics(artifact);
    expect(result.ok).toBe(true);
  });

  it("should fail on economic invariant failure", () => {
     const artifact = createTxPlanArtifact({
      networkId: "simnet",
      mode: "simulated",
      from: { input: "alice", address: "addr1" },
      to: { input: "addr2", address: "addr2" },
      amountSompi: 500n,
      plan: { ...basePlan, estimatedMass: 350n, estimatedFeeSompi: 10000n } as any
    });

    const result = verifyArtifactSemantics(artifact);
    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.code === "INSUFFICIENT_FUNDS")).toBe(true);
  });

  it("should fail on signed tx lineage mismatch", () => {
    const plan = createTxPlanArtifact({
      networkId: "simnet",
      mode: "simulated",
      from: { input: "alice", address: "addr1" },
      to: { input: "addr2", address: "addr2" },
      amountSompi: 500n,
      plan: { ...basePlan, estimatedMass: 350n } as any
    });

    const signed = createSimulatedSignedTxArtifact(plan, "abc");

    // Verify with WRONG plan
    const wrongPlan = { ...plan, planId: "wrong-id" };
    const result = verifyArtifactSemantics(signed, { plan: wrongPlan });
    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.code === "LINEAGE_MISMATCH")).toBe(true);
  });
});
