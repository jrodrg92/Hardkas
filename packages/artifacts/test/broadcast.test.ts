import { describe, it, expect } from "vitest";
import { getBroadcastableSignedTransaction } from "../src/signed-tx.js";
import type { SignedTxArtifact } from "../src/types.js";

describe("getBroadcastableSignedTransaction", () => {
  const baseArtifact: SignedTxArtifact = {
    schema: "hardkas.signedTx",
    version: 1,
    status: "signed",
    createdAt: new Date().toISOString(),
    source: { schema: "hardkas.txPlan", version: 1, planHash: "abc" },
    network: "devnet",
    mode: "kaspa-rpc",
    from: { address: "kaspa:from", input: "alice" },
    to: { address: "kaspa:to", input: "bob" },
    amountSompi: "1000",
    amount: "0.00001",
    selectedUtxos: [],
    outputs: [],
    estimatedMass: "100",
    estimatedFeeSompi: "10",
    estimatedFee: "0.0000001",
    changeSompi: "0",
    change: "0",
    signature: { kind: "kaspa", value: "sig", account: "alice" },
    signedTransaction: { encoding: "kaspa-raw", value: "raw-tx-hex" }
  };

  it("should validate a correct real signed artifact", () => {
    const result = getBroadcastableSignedTransaction(baseArtifact);
    expect(result.network).toBe("devnet");
    expect(result.rawTransaction).toBe("raw-tx-hex");
  });

  it("should fail for simulated artifacts", () => {
    const simulated = { ...baseArtifact, mode: "simulated" as any };
    expect(() => getBroadcastableSignedTransaction(simulated)).toThrow(/Simulated signed artifacts cannot be broadcast/);
  });

  it("should fail if signature kind is not kaspa", () => {
    const invalid = { ...baseArtifact, signature: { ...baseArtifact.signature, kind: "simulated" } as any };
    expect(() => getBroadcastableSignedTransaction(invalid)).toThrow(/signature kind is 'simulated'/);
  });

  it("should fail if encoding is not kaspa-raw", () => {
    const invalid = { ...baseArtifact, signedTransaction: { ...baseArtifact.signedTransaction, encoding: "simulated" } as any };
    expect(() => getBroadcastableSignedTransaction(invalid)).toThrow(/expected signedTransaction.encoding = 'kaspa-raw'/);
  });

  it("should fail if status is not signed", () => {
    const invalid = { ...baseArtifact, status: "unsigned" as any };
    expect(() => getBroadcastableSignedTransaction(invalid)).toThrow(/invalid state: unsigned/);
  });
});
