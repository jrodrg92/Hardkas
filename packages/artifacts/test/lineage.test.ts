import { describe, it, expect } from "vitest";
import { verifyLineage } from "../src/index.js";

describe("Artifact Lineage (Fase 2 Hardening)", () => {
  const rootArtifact = {
    schema: "hardkas.snapshot.v2",
    contentHash: "root-hash",
    networkId: "simnet",
    mode: "simulated",
    lineage: {
      artifactId: "root-hash",
      lineageId: "flow-123",
      rootArtifactId: "root-hash",
      sequence: 0
    }
  };

  const planArtifact = {
    schema: "hardkas.txPlan.v2",
    contentHash: "plan-hash",
    networkId: "simnet",
    mode: "simulated",
    lineage: {
      artifactId: "plan-hash",
      lineageId: "flow-123",
      parentArtifactId: "root-hash",
      rootArtifactId: "root-hash",
      sequence: 1
    }
  };

  it("should pass valid lineage chain", () => {
    const result = verifyLineage(planArtifact, rootArtifact);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("should fail on lineageId mismatch", () => {
    const corrupted = {
      ...planArtifact,
      lineage: { ...planArtifact.lineage, lineageId: "wrong-flow" }
    };
    const result = verifyLineage(corrupted, rootArtifact);
    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.code === "LINEAGE_ID_MISMATCH")).toBe(true);
  });

  it("should fail on rootId mismatch", () => {
    const corrupted = {
      ...planArtifact,
      lineage: { ...planArtifact.lineage, rootArtifactId: "wrong-root" }
    };
    const result = verifyLineage(corrupted, rootArtifact);
    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.code === "ROOT_ID_MISMATCH")).toBe(true);
  });

  it("should fail on parent hash mismatch", () => {
    const corrupted = {
      ...planArtifact,
      lineage: { ...planArtifact.lineage, parentArtifactId: "wrong-parent-hash" }
    };
    const result = verifyLineage(corrupted, rootArtifact);
    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.code === "PARENT_ID_MISMATCH")).toBe(true);
  });

  it("should fail on invalid sequence", () => {
    const corrupted = {
      ...planArtifact,
      lineage: { ...planArtifact.lineage, sequence: 0 } // same as parent
    };
    const result = verifyLineage(corrupted, rootArtifact);
    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.code === "INVALID_SEQUENCE")).toBe(true);
  });

  it("should fail on network contamination", () => {
    const crossNetwork = {
      ...planArtifact,
      networkId: "mainnet"
    };
    const result = verifyLineage(crossNetwork, rootArtifact);
    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.code === "NETWORK_CONTAMINATION")).toBe(true);
  });

  it("should fail on invalid transition (e.g. receipt -> plan)", () => {
    const receipt = {
      schema: "hardkas.txReceipt.v2",
      lineage: { artifactId: "receipt-hash", lineageId: "flow", rootArtifactId: "root" }
    };
    const plan = {
      schema: "hardkas.txPlan.v2",
      lineage: { artifactId: "plan-hash", lineageId: "flow", rootArtifactId: "root" }
    };
    // receipt cannot be parent of plan
    const result = verifyLineage(plan, receipt);
    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.code === "INVALID_TRANSITION")).toBe(true);
  });

  it("should warn on missing lineage (orphan) but not fail in normal mode", () => {
    const orphan = { schema: "hardkas.snapshot.v2" };
    const result = verifyLineage(orphan);
    expect(result.ok).toBe(true);
    expect(result.issues.some(i => i.code === "MISSING_LINEAGE" && i.severity === "warning")).toBe(true);
  });
});
