import { describe, it, expect } from "vitest";
import { assertBroadcastNetworkAllowed } from "../src/broadcast-guard.js";

describe("assertBroadcastNetworkAllowed", () => {
  it("should allow same devnet/testnet", () => {
    expect(() => assertBroadcastNetworkAllowed({
      artifactNetwork: "devnet",
      selectedNetwork: "devnet"
    })).not.toThrow();
  });

  it("should block mainnet by default", () => {
    expect(() => assertBroadcastNetworkAllowed({
      artifactNetwork: "mainnet",
      selectedNetwork: "mainnet"
    })).toThrow(/Mainnet broadcast is disabled by default/);
  });

  it("should block mainnet even if only artifact is mainnet", () => {
    expect(() => assertBroadcastNetworkAllowed({
      artifactNetwork: "kaspa",
      selectedNetwork: "devnet"
    })).toThrow(/Mainnet broadcast is disabled by default/);
  });

  it("should allow mainnet with override flag", () => {
    expect(() => assertBroadcastNetworkAllowed({
      artifactNetwork: "mainnet",
      selectedNetwork: "mainnet",
      allowMainnet: true
    })).not.toThrow();
  });

  it("should block network mismatch", () => {
    expect(() => assertBroadcastNetworkAllowed({
      artifactNetwork: "devnet",
      selectedNetwork: "testnet-10"
    })).toThrow(/Network mismatch/);
  });

  it("should allow mainnet-like aliases", () => {
    expect(() => assertBroadcastNetworkAllowed({
      artifactNetwork: "kaspa",
      selectedNetwork: "mainnet",
      allowMainnet: true
    })).not.toThrow();
  });
});
