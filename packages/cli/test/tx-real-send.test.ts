import { describe, it, expect, vi, beforeEach } from "vitest";
import { runTxRealSend } from "../src/runners/tx-real-send-runner.js";
import * as artifacts from "@hardkas/artifacts";
import { MockKaspaRpcClient } from "@hardkas/kaspa-rpc";
import fs from "node:fs/promises";
import path from "node:path";

// Mock @hardkas/artifacts
vi.mock("@hardkas/artifacts", async () => {
  const actual = await vi.importActual("@hardkas/artifacts");
  return {
    ...actual,
    readArtifact: vi.fn(),
    writeArtifact: vi.fn(),
    assertValidRealSignedTxArtifact: vi.fn(),
    assertValidRealTxSubmitReceipt: vi.fn(),
  };
});

// Mock @hardkas/kaspa-rpc
vi.mock("@hardkas/kaspa-rpc", async () => {
  const actual = await vi.importActual("@hardkas/kaspa-rpc");
  return {
    ...actual,
    KaspaJsonRpcClient: vi.fn()
  };
});

// Mock node:fs/promises
vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  }
}));

describe("runTxRealSend", () => {
  const mockUrl = "http://127.0.0.1:18210";
  const mockSignedPath = "signed/test.json";
  
  const mockArtifact = {
    schema: "hardkas.realSignedTx.v1",
    hardkasVersion: "0.1.0-dev",
    status: "signed",
    networkId: "simnet",
    mode: "node",
    signedTransaction: {
      encoding: "kaspa-raw",
      value: "mock-raw-tx-payload"
    },
    from: { input: "alice", address: "kaspa:alice" },
    to: { input: "bob", address: "kaspa:bob" },
    amount: "1 KAS",
    amountSompi: "100000000",
    signedId: "mock-signed-id"
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fail if --yes is missing", async () => {
    await expect(runTxRealSend({
      signedPath: mockSignedPath,
      url: mockUrl,
      yes: false
    })).rejects.toThrow("Refusing to submit real transaction without --yes.");
  });

  it("should fail if network mismatch", async () => {
    const { readArtifact } = await import("@hardkas/artifacts");
    const { KaspaJsonRpcClient } = await import("@hardkas/kaspa-rpc");

    (readArtifact as any).mockResolvedValue(mockArtifact);
    
    (KaspaJsonRpcClient as any).mockImplementation(() => ({
      getServerInfo: vi.fn().mockResolvedValue({ networkId: "mainnet" }),
      submitTransaction: vi.fn()
    }));

    await expect(runTxRealSend({
      signedPath: mockSignedPath,
      url: mockUrl,
      yes: true
    })).rejects.toThrow(/Refusing to submit transaction: artifact networkId does not match RPC node networkId/);
  });

  it("should fail if mainnet is attempted (always rejected in v0.1-dev)", async () => {
    const { readArtifact } = await import("@hardkas/artifacts");
    (readArtifact as any).mockResolvedValue({
      ...mockArtifact,
      networkId: "mainnet"
    });

    await expect(runTxRealSend({
      signedPath: mockSignedPath,
      url: mockUrl,
      yes: true
    })).rejects.toThrow("Mainnet broadcast is disabled in HardKAS v0.1-dev.");
  });

  it("should succeed and create receipt in happy path", async () => {
    const { readArtifact, writeArtifact } = await import("@hardkas/artifacts");
    const { KaspaJsonRpcClient } = await import("@hardkas/kaspa-rpc");

    (readArtifact as any).mockResolvedValue(mockArtifact);
    
    const mockSubmitResult = { transactionId: "real-tx-123", accepted: true };
    (KaspaJsonRpcClient as any).mockImplementation(() => ({
      getServerInfo: vi.fn().mockResolvedValue({ networkId: "simnet" }),
      submitTransaction: vi.fn().mockResolvedValue(mockSubmitResult)
    }));

    const result = await runTxRealSend({
      signedPath: mockSignedPath,
      url: mockUrl,
      yes: true
    });

    expect(result.txId).toBe("real-tx-123");
    expect(result.receipt.status).toBe("submitted");
    expect(writeArtifact).toHaveBeenCalled();
    expect(result.formatted).toContain("Real transaction submitted");
    expect(result.formatted).toContain("real-tx-123");
  });

  it("should fail if node connection fails", async () => {
    const { readArtifact } = await import("@hardkas/artifacts");
    const { KaspaJsonRpcClient } = await import("@hardkas/kaspa-rpc");

    (readArtifact as any).mockResolvedValue(mockArtifact);
    
    (KaspaJsonRpcClient as any).mockImplementation(() => ({
      getServerInfo: vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
    }));

    await expect(runTxRealSend({
      signedPath: mockSignedPath,
      url: mockUrl,
      yes: true
    })).rejects.toThrow("Cannot connect to Kaspa RPC");
  });
});
