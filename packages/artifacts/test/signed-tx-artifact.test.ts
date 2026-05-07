import { describe, it, expect } from "vitest";
import { 
  createTxPlanArtifact, 
  createSimulatedSignedTxArtifact, 
  validateSignedTxArtifact,
  hashTxPlanArtifact
} from "../src";

describe("SignedTxArtifact", () => {
  const mockPlan = {
    schema: "hardkas.txPlan",
    version: 1,
    status: "unsigned",
    createdAt: new Date().toISOString(),
    network: "simnet",
    mode: "simulated",
    from: { input: "alice", address: "addr1" },
    to: { input: "bob", address: "addr2" },
    amountSompi: "500",
    amount: "0.00000500 KAS",
    selectedUtxos: [
      { id: "tx1:0", txId: "tx1", outputIndex: 0, address: "addr1", amountSompi: "1000", amount: "0.00001000 KAS" }
    ],
    outputs: [
      { kind: "payment", address: "addr2", amountSompi: "500", amount: "0.00000500 KAS" }
    ],
    estimatedMass: "350",
    estimatedFeeSompi: "10",
    estimatedFee: "0.00000010 KAS",
    changeSompi: "490",
    change: "0.00000490 KAS"
  };

  it("should generate a stable hash for the same artifact", () => {
    const hash1 = hashTxPlanArtifact(mockPlan as any);
    const hash2 = hashTxPlanArtifact(mockPlan as any);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("should generate different hashes for different artifacts", () => {
    const hash1 = hashTxPlanArtifact(mockPlan as any);
    const mockPlan2 = { ...mockPlan, amountSompi: "501" };
    const hash2 = hashTxPlanArtifact(mockPlan2 as any);
    expect(hash1).not.toBe(hash2);
  });

  it("should create a simulated signed artifact", () => {
    const signed = createSimulatedSignedTxArtifact({
      plan: mockPlan as any,
      account: "alice",
      signerAddress: "addr1"
    });

    expect(signed.schema).toBe("hardkas.signedTx");
    expect(signed.status).toBe("signed");
    expect(signed.signature.kind).toBe("simulated");
    expect(signed.signature.value).toContain("simulated:alice:");
    expect(signed.source.planHash).toBe(hashTxPlanArtifact(mockPlan as any));
  });

  it("should validate a correct signed artifact", () => {
    const signed = createSimulatedSignedTxArtifact({
      plan: mockPlan as any,
      account: "alice"
    });

    const result = validateSignedTxArtifact(signed);
    expect(result.ok).toBe(true);
  });

  it("should fail validation for invalid signed artifact", () => {
    const invalid = { schema: "hardkas.signedTx", status: "unsigned" };
    const result = validateSignedTxArtifact(invalid);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Invalid status: expected 'signed'");
  });
});
