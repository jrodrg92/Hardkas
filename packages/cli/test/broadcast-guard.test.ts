import { describe, it, expect } from "vitest";
import { assertBroadcastNetworkAllowed } from "../src/broadcast-guard.js";

describe("assertBroadcastNetworkAllowed", () => {
  it("should allow same non-mainnet network", () => {
    expect(() => assertBroadcastNetworkAllowed({
      artifactNetwork: "simnet",
      selectedNetwork: "simnet"
    })).not.toThrow();
  });

  it("should block mainnet (always rejected in v0.1-dev)", () => {
    expect(() => assertBroadcastNetworkAllowed({
      artifactNetwork: "mainnet",
      selectedNetwork: "mainnet"
    })).toThrow(/Mainnet broadcast is disabled in HardKAS v0.1-dev/);
  });

  it("should block mainnet even if only artifact is mainnet", () => {
    expect(() => assertBroadcastNetworkAllowed({
      artifactNetwork: "kaspa",
      selectedNetwork: "devnet"
    })).toThrow(/Mainnet broadcast is disabled in HardKAS v0.1-dev/);
  });

  it("should block mainnet-like aliases", () => {
    expect(() => assertBroadcastNetworkAllowed({
      artifactNetwork: "kaspa-mainnet",
      selectedNetwork: "kaspa-mainnet"
    })).toThrow(/Mainnet broadcast is disabled in HardKAS v0.1-dev/);
  });

  it("should fail on network mismatch", () => {
    expect(() => assertBroadcastNetworkAllowed({
      artifactNetwork: "simnet",
      selectedNetwork: "testnet-10"
    })).toThrow(/Network mismatch/);
  });
});
