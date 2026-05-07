import { describe, it, expect } from "vitest";
import { UnsupportedKaspaKeyGenerator } from "../src/real-keygen";

describe("Real Keygen Adapter", () => {
  it("should throw error when generating account (placeholder phase)", async () => {
    const generator = new UnsupportedKaspaKeyGenerator();
    await expect(generator.generateAccount())
      .rejects.toThrow("Real Kaspa key generation is not configured");
  });
});
