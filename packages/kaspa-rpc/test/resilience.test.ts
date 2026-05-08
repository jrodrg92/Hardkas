import { describe, it, expect, vi, beforeEach } from "vitest";
import { KaspaJsonRpcClient, LoadBalancedRpcProvider, CircuitState } from "../src/index.js";
import { 
  RpcTimeoutError, 
  RpcCircuitOpenError, 
  RpcRateLimitError 
} from "../src/errors.js";

describe("RPC Resilience (P1.2)", () => {
  
  describe("Retries and Timeouts", () => {
    it("should retry on transient failures and eventually succeed", async () => {
      let attempts = 0;
      const mockFetcher = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) throw new Error("Transient error");
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { serverVersion: "1.0.0" } }));
      });

      const client = new KaspaJsonRpcClient({
        fetcher: mockFetcher,
        retry: { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 }
      });

      const info = await client.getServerInfo();
      expect(info.serverVersion).toBe("1.0.0");
      expect(attempts).toBe(3);
    });

    it("should throw RpcTimeoutError on timeout", async () => {
      const mockFetcher = vi.fn().mockImplementation(async (url, init) => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            resolve(new Response(JSON.stringify({ result: {} })));
          }, 50);

          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              clearTimeout(timeout);
              const err = new Error("Aborted");
              err.name = "AbortError";
              reject(err);
            });
          }
        });
      });

      const client = new KaspaJsonRpcClient({
        fetcher: mockFetcher,
        timeoutMs: 10,
        retry: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0 }
      });

      await expect(client.getServerInfo()).rejects.toThrow(RpcTimeoutError);
    });

    it("should retry on 429 Rate Limit", async () => {
      let attempts = 0;
      const mockFetcher = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          return new Response(null, { status: 429, headers: { "Retry-After": "0" } });
        }
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { isSynced: true } }));
      });

      const client = new KaspaJsonRpcClient({
        fetcher: mockFetcher,
        retry: { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 10 }
      });

      const info = await client.getServerInfo();
      expect(info.isSynced).toBe(true);
      expect(attempts).toBe(2);
    });
  });

  describe("Circuit Breaker", () => {
    it("should open circuit after repeated failures", async () => {
      const mockFetcher = vi.fn().mockImplementation(async () => {
        throw new Error("Fatal");
      });

      const client = new KaspaJsonRpcClient({
        fetcher: mockFetcher,
        retry: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0 },
        circuitBreaker: { failureThreshold: 3, resetTimeoutMs: 1000 }
      });

      // 3 failures to open circuit
      await expect(client.getServerInfo()).rejects.toThrow();
      await expect(client.getServerInfo()).rejects.toThrow();
      await expect(client.getServerInfo()).rejects.toThrow();

      // Next call should fail immediately with RpcCircuitOpenError
      await expect(client.getServerInfo()).rejects.toThrow(RpcCircuitOpenError);
      expect(mockFetcher).toHaveBeenCalledTimes(3); // Should NOT have called fetcher for the 4th time
    });

    it("should recover from Half-Open state", async () => {
      let fail = true;
      const mockFetcher = vi.fn().mockImplementation(async () => {
        if (fail) throw new Error("Fatal");
        return new Response(JSON.stringify({ result: {} }));
      });

      const client = new KaspaJsonRpcClient({
        fetcher: mockFetcher,
        retry: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0 },
        circuitBreaker: { failureThreshold: 1, resetTimeoutMs: 10 }
      });

      await expect(client.getServerInfo()).rejects.toThrow();
      await expect(client.getServerInfo()).rejects.toThrow(RpcCircuitOpenError);

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 20));
      
      fail = false;
      await client.getServerInfo(); // Should succeed in Half-Open and close circuit
      expect(mockFetcher).toHaveBeenCalledTimes(2);
    });
  });

  describe("Load Balancing & Failover", () => {
    it("should failover to secondary node if primary is down", async () => {
      const client1 = new KaspaJsonRpcClient({
        fetcher: vi.fn().mockRejectedValue(new Error("Down")),
        retry: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0 }
      });

      const client2 = new KaspaJsonRpcClient({
        fetcher: vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: { serverVersion: "primary-failover" } }))),
        retry: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0 }
      });

      const provider = new LoadBalancedRpcProvider([client1, client2]);
      const info = await provider.getServerInfo();
      
      expect(info.serverVersion).toBe("primary-failover");
    });

    it("should use Round-Robin strategy", async () => {
      const mockFetcher1 = vi.fn().mockImplementation(async () => 
        new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { serverVersion: "node-1" } }))
      );
      const mockFetcher2 = vi.fn().mockImplementation(async () => 
        new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { serverVersion: "node-2" } }))
      );

      const client1 = new KaspaJsonRpcClient({ fetcher: mockFetcher1 });
      const client2 = new KaspaJsonRpcClient({ fetcher: mockFetcher2 });

      const provider = new LoadBalancedRpcProvider([client1, client2], { strategy: "round-robin" });
      
      const info1 = await provider.getServerInfo();
      const info2 = await provider.getServerInfo();
      const info3 = await provider.getServerInfo();

      expect(info1.serverVersion).toBe("node-1");
      expect(info2.serverVersion).toBe("node-2");
      expect(info3.serverVersion).toBe("node-1");
    });
  });
});
