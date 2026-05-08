import { describe, it, expect } from "vitest";
import { verifyArtifactIntegrity, verifyArtifactSemantics } from "../src/index.js";
import fs from "node:fs";
import path from "node:path";

const corruptedDir = path.resolve(__dirname, "fixtures/corrupted");

describe("Corruption Corpus (Fase 4 Hardening)", () => {
  
  it("should reject fee-mismatch.json in strict mode", () => {
    const content = fs.readFileSync(path.join(corruptedDir, "fee-mismatch.json"), "utf8");
    const artifact = JSON.parse(content);
    const result = verifyArtifactSemantics(artifact, { strict: true });
    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.code === "ECONOMIC_VIOLATION")).toBe(true);
  });

  it("should reject broken-content-hash.json", () => {
    const content = fs.readFileSync(path.join(corruptedDir, "broken-content-hash.json"), "utf8");
    const artifact = JSON.parse(content);
    const result = verifyArtifactIntegrity(artifact);
    // verifyArtifactIntegrity might pass if we don't recompute hash inside it, 
    // but verifyArtifactSemantics checks lineage.artifactId vs contentHash
    const semanticResult = verifyArtifactSemantics(artifact, { strict: true });
    expect(semanticResult.ok).toBe(false);
    expect(semanticResult.issues.some(i => i.code === "LINEAGE_IDENTITY_MISMATCH")).toBe(true);
  });

  it("should reject dust-output.json", () => {
    const content = fs.readFileSync(path.join(corruptedDir, "dust-output.json"), "utf8");
    const artifact = JSON.parse(content);
    const result = verifyArtifactSemantics(artifact, { strict: true });
    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.message.includes("Dust"))).toBe(true);
  });

  it("should reject missing lineage in strict mode", () => {
    const artifact = { schema: "hardkas.txPlan.v2", mode: "real", networkId: "mainnet" };
    const result = verifyArtifactSemantics(artifact, { strict: true });
    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.code === "MISSING_LINEAGE")).toBe(true);
  });
});
