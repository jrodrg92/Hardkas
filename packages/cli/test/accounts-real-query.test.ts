import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAccountsRealBalance } from "../src/runners/accounts-real-balance-runner.js";
import { runAccountsRealUtxos } from "../src/runners/accounts-real-utxos-runner.js";
import * as localnet from "@hardkas/localnet";
import { MockKaspaRpcClient, JsonWrpcKaspaClient } from "@hardkas/kaspa-rpc";

// Mock localnet functions
vi.mock("@hardkas/localnet", async () => {
  const actual = await vi.importActual("@hardkas/localnet");
  return {
    ...actual,
    loadRealAccountStore: vi.fn()
  };
});

// Mock Kaspa RPC Client
vi.mock("@hardkas/kaspa-rpc", async () => {
  const actual = await vi.importActual("@hardkas/kaspa-rpc");
  return {
    ...actual,
    JsonWrpcKaspaClient: vi.fn()
  };
});

describe("Real Account Queries (Balance & UTXOs)", () => {
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
    
    // Setup Mock RPC behaviors
    mockRpc.setUtxos("kaspasim:alice123", [
      {
        outpoint: { transactionId: "tx1", index: 0 },
        address: "kaspasim:alice123",
        amountSompi: 100000000n, // 1 KAS
        blockDaaScore: 100n
      },
      {
        outpoint: { transactionId: "tx2", index: 1 },
        address: "kaspasim:alice123",
        amountSompi: 50000000n, // 0.5 KAS
        blockDaaScore: 101n
      }
    ]);

    vi.mocked(JsonWrpcKaspaClient).mockImplementation(() => mockRpc as any);
  });

  describe("runAccountsRealBalance", () => {
    it("should resolve alias and fetch balance", async () => {
      const result = await runAccountsRealBalance({ nameOrAddress: "alice" });
      expect(result.name).toBe("alice");
      expect(result.address).toBe("kaspasim:alice123");
      expect(result.utxoCount).toBe(2);
      expect(result.balanceSompi).toBe("150000000");
      expect(result.formatted).toContain("1.50000000 KAS");
    });

    it("should accept direct address", async () => {
      const result = await runAccountsRealBalance({ nameOrAddress: "kaspasim:alice123" });
      expect(result.address).toBe("kaspasim:alice123");
      expect(result.balanceSompi).toBe("150000000");
    });

    it("should throw if alias not found and not an address", async () => {
      await expect(runAccountsRealBalance({ nameOrAddress: "bob" }))
        .rejects.toThrow(/'bob' is not a registered real account name/);
    });
  });

  describe("runAccountsRealUtxos", () => {
    it("should list detailed UTXOs", async () => {
      const result = await runAccountsRealUtxos({ nameOrAddress: "alice" });
      expect(result.utxos).toHaveLength(2);
      expect(result.formatted).toContain("tx1:0");
      expect(result.formatted).toContain("1.00000000 KAS");
      expect(result.formatted).toContain("tx2:1");
      expect(result.formatted).toContain("0.50000000 KAS");
      expect(result.formatted).toContain("DAA 100");
    });
  });
});
