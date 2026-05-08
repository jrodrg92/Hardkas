import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hardkas } from "../src/index.js";
import { JsonWrpcKaspaClient } from "@hardkas/kaspa-rpc";

vi.mock("@hardkas/kaspa-rpc", async () => {
  const actual = await vi.importActual("@hardkas/kaspa-rpc");
  return {
    ...actual as any,
    JsonWrpcKaspaClient: vi.fn().mockImplementation(() => ({
      getInfo: vi.fn().mockResolvedValue({ networkId: "simnet", virtualDaaScore: 100n }),
      healthCheck: vi.fn().mockResolvedValue({ status: "healthy", info: { networkId: "simnet" } })
    }))
  };
});

describe("Hardkas SDK", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default config", async () => {
    expect(Hardkas).toBeDefined();
  });

  it("should have modular sub-facades", async () => {
    const sdk = await Hardkas.create();
    expect(sdk.accounts).toBeDefined();
    expect(sdk.tx).toBeDefined();
    expect(sdk.l2).toBeDefined();
    expect(sdk.rpc).toBeDefined();
  });

  it("should perform health check", async () => {
    const sdk = await Hardkas.create();
    const health = await sdk.checkHealth();
    expect(health.status).toBe("ok");
    expect(health.environment).toBeDefined();
    expect(health.network).toBe("simnet");
  });
});
