import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkKaspaRpcHealth, waitForKaspaRpcReady } from "../src/health";
import { KaspaJsonRpcClient } from "../src/json-rpc-client";

vi.mock("../src/json-rpc-client");

describe("RPC Health API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return ready=true when client calls succeed", async () => {
    const mockClient = {
      getServerInfo: vi.fn().mockResolvedValue({ 
        networkId: "simnet", 
        serverVersion: "1.0.0", 
        isSynced: true 
      }),
      getBlockDagInfo: vi.fn().mockResolvedValue({ 
        networkId: "simnet", 
        virtualDaaScore: 123n 
      })
    };
    
    vi.mocked(KaspaJsonRpcClient).mockReturnValue(mockClient as any);

    const result = await checkKaspaRpcHealth();
    
    expect(result.ready).toBe(true);
    expect(result.networkId).toBe("simnet");
    expect(result.virtualDaaScore).toBe("123");
    expect(result.latencyMs).toBeDefined();
  });

  it("should return ready=false when a call fails", async () => {
    const mockClient = {
      getServerInfo: vi.fn().mockRejectedValue(new Error("Connection refused")),
      getBlockDagInfo: vi.fn().mockResolvedValue({})
    };
    
    vi.mocked(KaspaJsonRpcClient).mockReturnValue(mockClient as any);

    const result = await checkKaspaRpcHealth();
    
    expect(result.ready).toBe(false);
    expect(result.error).toBe("Connection refused");
  });

  it("should wait for ready=true", async () => {
    const mockClientFail = {
      getServerInfo: vi.fn().mockRejectedValue(new Error("Refused")),
      getBlockDagInfo: vi.fn().mockResolvedValue({})
    };
    
    const mockClientSuccess = {
      getServerInfo: vi.fn().mockResolvedValue({ networkId: "simnet" }),
      getBlockDagInfo: vi.fn().mockResolvedValue({ virtualDaaScore: 1n })
    };

    // First call fails, second succeeds
    vi.mocked(KaspaJsonRpcClient)
      .mockReturnValueOnce(mockClientFail as any)
      .mockReturnValueOnce(mockClientSuccess as any);

    const result = await waitForKaspaRpcReady({ intervalMs: 1, maxWaitMs: 100 });
    
    expect(result.ready).toBe(true);
    expect(KaspaJsonRpcClient).toHaveBeenCalledTimes(2);
  });

  it("should timeout if never ready", async () => {
    const mockClient = {
      getServerInfo: vi.fn().mockRejectedValue(new Error("Refused")),
      getBlockDagInfo: vi.fn().mockResolvedValue({})
    };
    
    vi.mocked(KaspaJsonRpcClient).mockReturnValue(mockClient as any);

    const result = await waitForKaspaRpcReady({ intervalMs: 1, maxWaitMs: 10 });
    
    expect(result.ready).toBe(false);
  });
});
