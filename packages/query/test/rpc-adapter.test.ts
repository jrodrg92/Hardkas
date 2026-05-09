import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { QueryEngine, createQueryRequest } from "../src/engine.js";

describe("RpcQueryAdapter", () => {
  let tmpDir: string;
  let engine: QueryEngine;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hardkas-rpc-"));
    const hardkasDir = path.join(tmpDir, ".hardkas");
    await fs.mkdir(hardkasDir, { recursive: true });

    // Events log
    const events = [
      { ts: "2026-01-01T10:00:00Z", kind: "rpc.health", endpoint: "http://node", state: "healthy", score: 100, latencyMs: 120 },
      { ts: "2026-01-01T10:01:00Z", kind: "rpc.health", endpoint: "http://node", state: "degraded", score: 60, latencyMs: 550 },
      { ts: "2026-01-01T10:02:00Z", kind: "rpc.health", endpoint: "http://node", state: "healthy", score: 95, latencyMs: 130 },
      { ts: "2026-01-01T10:01:15Z", kind: "workflow.submitted", txId: "tx-123", endpoint: "http://node" },
      { ts: "2026-01-01T10:01:10Z", kind: "rpc.error", endpoint: "http://node", error: "timeout", retriable: true }
    ];

    await fs.writeFile(
      path.join(hardkasDir, "events.jsonl"),
      events.map(e => JSON.stringify(e)).join("\n") + "\n"
    );

    engine = new QueryEngine({ artifactDir: tmpDir });
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("health-timeline — should return health events", async () => {
    const result = await engine.execute(createQueryRequest({ domain: "rpc", op: "health-timeline" }));
    expect(result.total).toBe(3);
    expect(result.items[0]).toHaveProperty("score");
  });

  it("degradations — should detect degradation window", async () => {
    const result = await engine.execute(createQueryRequest({ domain: "rpc", op: "degradations" }));
    expect(result.total).toBe(1);
    const deg: any = result.items[0];
    expect(deg.lowestScore).toBe(60);
    expect(deg.worstState).toBe("degraded");
  });

  it("correlate — should assess tx submission context", async () => {
    const result = await engine.execute(createQueryRequest({ domain: "rpc", op: "correlate", params: { txId: "tx-123" } }));
    expect(result.total).toBe(1);
    const corr: any = result.items[0];
    expect(corr.endpoint).toBe("http://node");
    expect(corr.scoreAtSubmission).toBe(60); // uses event right before submission
    expect(corr.nearbyErrors.length).toBe(1);
    expect(corr.assessment).toBe("degraded");
  });

  it("correlate — should generate explain chain", async () => {
    const result = await engine.execute(createQueryRequest({ domain: "rpc", op: "correlate", params: { txId: "tx-123" }, explain: "brief" }));
    expect(result.explain).toBeDefined();
    expect(result.explain![0]!.model).toBe("rpc-correlation");
    expect(result.explain![0]!.conclusion).toContain("Assessment: degraded");
  });
});
