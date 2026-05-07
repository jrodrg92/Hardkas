import { describe, it, expect, vi, beforeEach } from "vitest";
import { runTxRealBuild } from "../src/runners/tx-real-build-runner.js";
import * as localnet from "@hardkas/localnet";
import { MockKaspaRpcClient, JsonWrpcKaspaClient } from "@hardkas/kaspa-rpc";
import * as artifacts from "@hardkas/artifacts";
import fs from "node:fs/promises";

// Mock localnet
vi.mock("@hardkas/localnet", async () => {
  const actual = await vi.importActual("@hardkas/localnet");
  return {
    ...actual,
    loadRealAccountStore: vi.fn()
  };
});

// Mock Kaspa RPC
vi.mock("@hardkas/kaspa-rpc", async () => {
  const actual = await vi.importActual("@hardkas/kaspa-rpc");
  return {
    ...actual,
    JsonWrpcKaspaClient: vi.fn()
  };
});

// Mock artifacts
vi.mock("@hardkas/artifacts", async () => {
  const actual = await vi.importActual("@hardkas/artifacts");
  return {
    ...actual,
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

describe("Real Transaction Build Runner", () => {
  const mockStore: localnet.RealAccountStore = {
    version: 1,
    kind: "hardkas.realAccountStore",
    networkId: "simnet",
    warning: "test",
    accounts: [
      {
        name: "alice",
        address: "kaspasim:alice123",
        createdAt: new Date().toISOString()
      }
    ]
  };

  const mockRpc = new MockKaspaRpcClient("simnet");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localnet.loadRealAccountStore).mockResolvedValue(mockStore);
    vi.mocked(JsonWrpcKaspaClient).mockImplementation(() => mockRpc as any);
  });

  it("should build a real tx plan successfully", async () => {
    mockRpc.setUtxos("kaspasim:alice123", [
      {
        outpoint: { transactionId: "tx1", index: 0 },
        address: "kaspasim:alice123",
        amountSompi: 200000000n, // 2 KAS
        blockDaaScore: 100n
      }
    ]);

    const result = await runTxRealBuild({
      from: "alice",
      to: "kaspasim:bob456",
      amount: "1",
      outDir: "test-plans"
    });

    expect(result.artifact.from.address).toBe("kaspasim:alice123");
    expect(result.artifact.amountSompi).toBe("100000000");
    expect(result.artifact.selectedUtxos).toHaveLength(1);
    expect(result.artifact.status).toBe("built");
    expect(vi.mocked(artifacts.writeArtifact)).toHaveBeenCalled();
    expect(result.formatted).toContain("Real transaction plan built");
    expect(result.formatted).toContain("alice kaspasim:alice123");
  });

  it("should throw error if insufficient funds", async () => {
    mockRpc.setUtxos("kaspasim:alice123", [
      {
        outpoint: { transactionId: "tx1", index: 0 },
        address: "kaspasim:alice123",
        amountSompi: 50000000n, // 0.5 KAS
      }
    ]);

    await expect(runTxRealBuild({
      from: "alice",
      to: "kaspasim:bob456",
      amount: "1"
    })).rejects.toThrow(/Insufficient funds/);
  });

  it("should provide actionable error on RPC failure", async () => {
    vi.mocked(JsonWrpcKaspaClient).mockImplementation(() => ({
      getInfo: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      close: vi.fn()
    } as any));

    await expect(runTxRealBuild({
      from: "alice",
      to: "kaspasim:bob456",
      amount: "1"
    })).rejects.toThrow(/Suggestion: hardkas rpc health/);
  });
});
