import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { QueryEngine } from "../src/engine.js";
import { correlate } from "../src/correlate.js";

describe("CorrelationEngine", () => {
  let tmpDir: string;
  let engine: QueryEngine;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hardkas-correlate-"));
    const hardkasDir = path.join(tmpDir, ".hardkas");
    const receiptsDir = path.join(hardkasDir, "receipts");
    await fs.mkdir(receiptsDir, { recursive: true });

    // Events log for RPC
    const events = [
      { ts: "2026-01-01T10:00:00Z", kind: "rpc.health", endpoint: "http://node", state: "healthy", score: 100 },
      { ts: "2026-01-01T10:00:10Z", kind: "workflow.submitted", txId: "tx-123", endpoint: "http://node" }
    ];
    await fs.writeFile(path.join(hardkasDir, "events.jsonl"), events.map(e => JSON.stringify(e)).join("\n") + "\n");

    // DAG State
    const dagState = {
      dag: {
        blocks: { "blk_1": { id: "blk_1", acceptedTxIds: ["tx-123"] } },
        sink: "blk_1",
        selectedPathToSink: ["blk_1"],
        acceptedTxIds: ["tx-123"],
        displacedTxIds: [],
        conflictSet: []
      }
    };
    await fs.writeFile(path.join(hardkasDir, "state.json"), JSON.stringify(dagState));

    // Receipt (for replay)
    await fs.writeFile(path.join(receiptsDir, "tx-123.json"), JSON.stringify({
      schema: "hardkas.txReceipt",
      txId: "tx-123",
      status: "confirmed",
      amountSompi: "1000",
      feeSompi: "100",
      spentUtxoIds: ["u1"],
      createdUtxoIds: ["u2"],
      preStateHash: "pre",
      postStateHash: "post"
    }));

    // (Intentionally skipping artifact lineage setup to keep it simple, testing partial correlation)

    engine = new QueryEngine({ artifactDir: tmpDir });
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should correlate across multiple domains and build timeline", async () => {
    const result = await correlate("tx-123", engine, {
      include: ["dag", "rpc", "replay"],
      cwd: tmpDir,
      explain: "brief"
    });

    expect(result.total).toBe(1);
    const bundle = result.items[0]!;

    expect(bundle.txId).toBe("tx-123");
    
    // Check RPC correlation
    expect(bundle.rpc).toBeDefined();
    expect(bundle.rpc!.scoreAtSubmission).toBe(100);

    // Check DAG correlation
    expect(bundle.dag).toBeDefined();
    expect(bundle.dag!.accepted).toBe(true);

    // Check Replay correlation
    expect(bundle.replay).toBeDefined();
    expect(bundle.replay!.found).toBe(true);

    // Check Timeline
    expect(bundle.timeline.length).toBeGreaterThan(0);
    const timelineDomains = bundle.timeline.map(t => t.domain);
    expect(timelineDomains).toContain("rpc");
    expect(timelineDomains).toContain("dag");
    expect(timelineDomains).toContain("replay");

    // Check Explain
    expect(result.explain).toBeDefined();
    expect(result.explain![0]!.model).toBe("cross-domain-correlation");
  });
});
