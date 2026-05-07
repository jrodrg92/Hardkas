import { describe, it, expect, vi, beforeEach } from "vitest";
import { runTxRealSend } from "../src/runners/tx-real-send-runner.js";
import * as artifacts from "@hardkas/artifacts";
import { MockKaspaRpcClient, KaspaJsonRpcClient } from "@hardkas/kaspa-rpc";
import fs from "node:fs/promises";

// Mock artifacts
vi.mock("@hardkas/artifacts", async () => {
  const actual = await vi.importActual("@hardkas/artifacts");
  return {
    ...actual,
    readArtifact: vi.fn(),
    writeArtifact: vi.fn()
  };
});

// Mock Kaspa RPC
vi.mock("@hardkas/kaspa-rpc", async () => {
  const actual = await vi.importActual("@hardkas/kaspa-rpc");
  return {
    ...actual,
    KaspaJsonRpcClient: vi.fn()
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

describe("Real Transaction Send Runner", () => {
  const mockSignedArtifact: artifacts.RealSignedTxArtifact = {
    kind: "hardkas.realSignedTx",
    schema: "hardkas.realSignedTx",
    version: 1,
    status: "signed",
    createdAt: new Date().toISOString(),
    signedId: "signed123",
    sourcePlanId: "plan123",
    networkId: "simnet",
    mode: "rpc",
    from: { address: "kaspasim:alice123" },
    to: { address: "kaspasim:bob456" },
    amountSompi: "100000000",
    feeSompi: "500",
    selectedUtxos: [],
    signedTransaction: { format: "kaspa-sdk", payload: "signedhex123" }
  };

  const mockRpc = new MockKaspaRpcClient("simnet");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(artifacts.readArtifact).mockResolvedValue(mockSignedArtifact);
    vi.mocked(KaspaJsonRpcClient).mockImplementation(() => mockRpc as any);
  });

  it("should submit a real signed tx successfully with --yes", async () => {
    const result = await runTxRealSend({
      signedPath: "signed/signed123.json",
      url: "mock://local",
      yes: true
    });

    expect(result.txId).toBe("mock-txid");
    expect(result.receipt.status).toBe("submitted");
    expect(vi.mocked(artifacts.writeArtifact)).toHaveBeenCalled();
    expect(result.formatted).toContain("Real transaction submitted");
  });

  it("should fail if --yes is missing", async () => {
    await expect(runTxRealSend({
      signedPath: "signed/signed123.json",
      url: "mock://local",
      yes: false
    })).rejects.toThrow(/without --yes/);
  });

  it("should fail on mainnet signed artifact", async () => {
    const signedMainnet = { ...mockSignedArtifact, networkId: "mainnet" };
    vi.mocked(artifacts.readArtifact).mockResolvedValue(signedMainnet);

    await expect(runTxRealSend({
      signedPath: "signed/signed123.json",
      url: "mock://local",
      yes: true
    })).rejects.toThrow(/Mainnet real transaction submission is disabled/);
  });

  it("should fail if artifact status is not signed", async () => {
    const signedWrongStatus = { ...mockSignedArtifact, status: "built" };
    vi.mocked(artifacts.readArtifact).mockResolvedValue(signedWrongStatus as any);

    await expect(runTxRealSend({
      signedPath: "signed/signed123.json",
      url: "mock://local",
      yes: true
    })).rejects.toThrow(/status: expected 'signed'/);
  });

  it("should provide suggestion on connection failure", async () => {
    vi.mocked(KaspaJsonRpcClient).mockImplementation(() => ({
      submitTransaction: vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
    } as any));

    await expect(runTxRealSend({
      signedPath: "signed/signed123.json",
      url: "mock://local",
      yes: true
    })).rejects.toThrow(/Cannot connect to Kaspa RPC/);
  });
});
