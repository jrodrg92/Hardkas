import { describe, it, expect, vi, beforeEach } from "vitest";
import { KaspaJsonRpcClient, RPC_METHODS } from "../src/json-rpc-client";

describe("KaspaJsonRpcClient", () => {
  const mockUrl = "http://localhost:18210";
  let mockFetcher: any;

  beforeEach(() => {
    mockFetcher = vi.fn();
  });

  it("should call getServerInfo correctly", async () => {
    const client = new KaspaJsonRpcClient({ url: mockUrl, fetcher: mockFetcher });
    
    mockFetcher.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          networkId: "simnet",
          serverVersion: "1.0.0",
          isSynced: true
        }
      })
    });

    const info = await client.getServerInfo();
    
    expect(mockFetcher).toHaveBeenCalledWith(mockUrl, expect.objectContaining({
      method: "POST",
      body: expect.stringContaining(RPC_METHODS.GET_SERVER_INFO)
    }));
    expect(info.networkId).toBe("simnet");
    expect(info.serverVersion).toBe("1.0.0");
    expect(info.isSynced).toBe(true);
  });

  it("should call getBlockDagInfo correctly and map virtualDaaScore to BigInt", async () => {
    const client = new KaspaJsonRpcClient({ url: mockUrl, fetcher: mockFetcher });
    
    mockFetcher.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          networkId: "simnet",
          virtualDaaScore: "123456",
          tipHashes: ["abc", "def"]
        }
      })
    });

    const dag = await client.getBlockDagInfo();
    
    expect(dag.virtualDaaScore).toBe(123456n);
    expect(dag.tipHashes).toEqual(["abc", "def"]);
  });

  it("should throw error if JSON-RPC returns error", async () => {
    const client = new KaspaJsonRpcClient({ url: mockUrl, fetcher: mockFetcher });
    
    mockFetcher.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        error: {
          code: -32601,
          message: "Method not found"
        }
      })
    });

    await expect(client.getServerInfo()).rejects.toThrow("JSON-RPC error -32601: Method not found");
  });

  it("should call submitTransaction correctly", async () => {
    const client = new KaspaJsonRpcClient({ url: mockUrl, fetcher: mockFetcher });
    
    mockFetcher.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          transactionId: "new-txid-123"
        }
      })
    });

    const result = await client.submitTransaction("abcd");
    
    expect(mockFetcher).toHaveBeenCalledWith(mockUrl, expect.objectContaining({
      body: expect.stringContaining(RPC_METHODS.SUBMIT_TRANSACTION)
    }));
    expect(result.transactionId).toBe("new-txid-123");
  });
});
