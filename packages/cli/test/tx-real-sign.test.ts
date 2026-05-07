import { describe, it, expect, vi, beforeEach } from "vitest";
import { runTxRealSign } from "../src/runners/tx-real-sign-runner.js";
import * as localnet from "@hardkas/localnet";
import * as artifacts from "@hardkas/artifacts";
import { RealTxSigner } from "@hardkas/accounts";
import fs from "node:fs/promises";

// Mock localnet
vi.mock("@hardkas/localnet", async () => {
  const actual = await vi.importActual("@hardkas/localnet");
  return {
    ...actual,
    loadRealAccountStore: vi.fn()
  };
});

// Mock artifacts
vi.mock("@hardkas/artifacts", async () => {
  const actual = await vi.importActual("@hardkas/artifacts");
  return {
    ...actual,
    readArtifact: vi.fn(),
    writeArtifact: vi.fn()
  };
});

// Mock fs
vi.mock("node:fs/promises", async () => {
  return {
    default: {
      mkdir: vi.fn().mockResolvedValue(undefined)
    }
  };
});

describe("Real Transaction Sign Runner", () => {
  const mockAccount = {
    name: "alice",
    address: "kaspasim:alice123",
    privateKey: "privkey123",
    createdAt: new Date().toISOString()
  };

  const mockStore: localnet.RealAccountStore = {
    version: 1,
    kind: "hardkas.realAccountStore",
    networkId: "simnet",
    warning: "test",
    accounts: [mockAccount]
  };

  const mockPlan: artifacts.RealTxPlanArtifact = {
    kind: "hardkas.realTxPlan",
    schema: "hardkas.realTxPlan",
    version: 1,
    status: "built",
    createdAt: new Date().toISOString(),
    planId: "plan123",
    networkId: "simnet",
    mode: "rpc",
    from: { address: "kaspasim:alice123" },
    to: { address: "kaspasim:bob456" },
    amountSompi: "100000000",
    feeRateSompiPerMass: "1",
    selectedUtxos: [],
    outputs: [],
    estimatedMass: "500",
    estimatedFeeSompi: "500"
  };

  const mockSigner: RealTxSigner = {
    sign: vi.fn().mockResolvedValue({
      signedTransaction: { format: "hex", payload: "signedhex123" },
      txId: "txid123"
    })
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localnet.loadRealAccountStore).mockResolvedValue(mockStore);
    vi.mocked(artifacts.readArtifact).mockResolvedValue(mockPlan);
  });

  it("should sign a real tx plan successfully with mock signer", async () => {
    const result = await runTxRealSign({
      planPath: "plans/plan123.json",
      accountName: "alice",
      signer: mockSigner
    });

    expect(result.artifact.status).toBe("signed");
    expect(result.artifact.signedTransaction.payload).toBe("signedhex123");
    expect(vi.mocked(artifacts.writeArtifact)).toHaveBeenCalled();
    expect(result.formatted).toContain("Real transaction signed");
  });

  it("should fail if account not found", async () => {
    await expect(runTxRealSign({
      planPath: "plans/plan123.json",
      accountName: "bob",
      signer: mockSigner
    })).rejects.toThrow(/not found/);
  });

  it("should fail if account missing private key", async () => {
    const accountNoKey = { ...mockAccount, privateKey: undefined };
    vi.mocked(localnet.loadRealAccountStore).mockResolvedValue({
      ...mockStore,
      accounts: [accountNoKey as any]
    });

    await expect(runTxRealSign({
      planPath: "plans/plan123.json",
      accountName: "alice",
      signer: mockSigner
    })).rejects.toThrow(/no private key/);
  });

  it("should fail if address mismatch", async () => {
    const planWrongAddress = { ...mockPlan, from: { address: "kaspasim:other" } };
    vi.mocked(artifacts.readArtifact).mockResolvedValue(planWrongAddress);

    await expect(runTxRealSign({
      planPath: "plans/plan123.json",
      accountName: "alice",
      signer: mockSigner
    })).rejects.toThrow(/Address mismatch/);
  });

  it("should fail on mainnet plan for safety", async () => {
    const planMainnet = { ...mockPlan, networkId: "mainnet" };
    vi.mocked(artifacts.readArtifact).mockResolvedValue(planMainnet);

    await expect(runTxRealSign({
      planPath: "plans/plan123.json",
      accountName: "alice",
      signer: mockSigner
    })).rejects.toThrow(/blocked/);
  });

  it("should throw clear error with UnsupportedRealTxSigner", async () => {
    await expect(runTxRealSign({
      planPath: "plans/plan123.json",
      accountName: "alice"
    })).rejects.toThrow(/not available/);
  });

  it("should throw clear error with missing SDK", async () => {
    const mockSignerMissingSdk: RealTxSigner = {
      sign: vi.fn().mockRejectedValue(new Error("dependency is not installed"))
    };

    await expect(runTxRealSign({
      planPath: "plans/plan123.json",
      accountName: "alice",
      signer: mockSignerMissingSdk
    })).rejects.toThrow("Real transaction signing is not available");
  });
});
