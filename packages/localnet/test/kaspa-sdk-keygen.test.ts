import { describe, it, expect, vi } from "vitest";
import { KaspaSdkKeyGenerator } from "../src/kaspa-sdk-keygen";

describe("KaspaSdkKeyGenerator", () => {
  it("should generate account when SDK is available", async () => {
    const mockSdk = {
      PrivateKey: class {
        toString() { return "xprv_test"; }
        toPublicKey() {
          return {
            toString() { return "xpub_test"; },
            toAddress(network: string) {
              return { toString() { return `kaspa:${network}_test`; } };
            }
          };
        }
      }
    };

    const generator = new KaspaSdkKeyGenerator({
      sdkLoader: async () => mockSdk
    });

    const account = await generator.generateAccount({ networkId: "simnet" });

    expect(account.address).toBe("kaspa:simnet_test");
    expect(account.privateKey).toBe("xprv_test");
    expect(account.publicKey).toBe("xpub_test");
  });

  it("should throw clear error when SDK is missing", async () => {
    const generator = new KaspaSdkKeyGenerator({
      sdkLoader: async () => { throw new Error("Module not found"); }
    });

    await expect(generator.generateAccount())
      .rejects.toThrow("Kaspa SDK key generation dependency is not installed");
  });

  it("should throw error if SDK structure is unexpected", async () => {
    const generator = new KaspaSdkKeyGenerator({
      sdkLoader: async () => ({}) // Empty object, no PrivateKey
    });

    await expect(generator.generateAccount())
      .rejects.toThrow("Loaded Kaspa SDK does not expose expected PrivateKey constructor");
  });
});
