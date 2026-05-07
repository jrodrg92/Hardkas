import { describe, it, expect } from "vitest";
import { createTxPlanArtifact, validateTxPlanArtifact } from "../src";

describe("TxPlanArtifact", () => {
  const mockPlan = {
    inputs: [
      {
        outpoint: { transactionId: "tx1", index: 0 },
        address: "addr1",
        amountSompi: 1000n,
        scriptPublicKey: "script1"
      }
    ],
    outputs: [
      { address: "addr2", amountSompi: 500n }
    ],
    change: { address: "addr1", amountSompi: 490n },
    estimatedMass: 350n,
    estimatedFeeSompi: 10n
  };

  it("should create a valid artifact from a plan", () => {
    const artifact = createTxPlanArtifact({
      network: "simnet",
      mode: "simulated",
      from: { input: "alice", address: "addr1" },
      to: { input: "bob", address: "addr2" },
      amountSompi: 500n,
      plan: mockPlan as any
    });

    expect(artifact.schema).toBe("hardkas.txPlan");
    expect(artifact.amountSompi).toBe("500");
    expect(artifact.selectedUtxos[0].amountSompi).toBe("1000");
    expect(artifact.estimatedFeeSompi).toBe("10");
    expect(artifact.status).toBe("unsigned");
  });

  it("should validate a correct artifact", () => {
    const artifact = createTxPlanArtifact({
      network: "simnet",
      mode: "simulated",
      from: { input: "alice", address: "addr1" },
      to: { input: "bob", address: "addr2" },
      amountSompi: 500n,
      plan: mockPlan as any
    });

    const result = validateTxPlanArtifact(artifact);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail validation for invalid schema", () => {
    const artifact = { schema: "wrong" };
    const result = validateTxPlanArtifact(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Invalid schema: expected 'hardkas.txPlan'");
  });
});
