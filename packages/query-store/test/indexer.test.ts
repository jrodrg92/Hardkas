import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { HardkasStore, HardkasIndexer } from "../src/index.js";
import { calculateContentHash } from "@hardkas/artifacts";

describe("HardkasIndexer", () => {
  let tmpDir: string;
  let hardkasDir: string;
  let store: HardkasStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hardkas-indexer-test-"));
    hardkasDir = path.join(tmpDir, ".hardkas");
    await fs.mkdir(hardkasDir, { recursive: true });

    // In-memory SQLite store
    store = new HardkasStore({ memory: true });
    store.connect();
  });

  afterEach(async () => {
    store.disconnect();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should index empty .hardkas directory gracefully", () => {
    const indexer = new HardkasIndexer(store.getDatabase(), { cwd: tmpDir });
    assert.doesNotThrow(() => indexer.sync());

    const db = store.getDatabase();
    const count = (db.prepare("SELECT COUNT(*) as count FROM artifacts").get() as any).count;
    assert.strictEqual(count, 0);
  });

  it("should index valid artifacts", async () => {
    const artifact = {
      schema: "hardkas.test",
      version: "1.0.0-alpha",
      mode: "simulated",
      networkId: "simnet",
      createdAt: new Date().toISOString(),
      payload: "hello world"
    };
    (artifact as any).contentHash = calculateContentHash(artifact);

    await fs.writeFile(
      path.join(hardkasDir, "test-artifact.json"),
      JSON.stringify(artifact)
    );

    const indexer = new HardkasIndexer(store.getDatabase(), { cwd: tmpDir });
    indexer.sync();

    const db = store.getDatabase();
    const count = (db.prepare("SELECT COUNT(*) as count FROM artifacts").get() as any).count;
    assert.strictEqual(count, 1);

    const row = db.prepare("SELECT hash, schema FROM artifacts").get() as any;
    assert.strictEqual(row.hash, (artifact as any).contentHash);
    assert.strictEqual(row.schema, "hardkas.test");
  });

  it("should index events.jsonl", async () => {
    const event1 = { kind: "workflow.test", txId: "tx1", timestamp: new Date().toISOString() };
    const event2 = { kind: "rpc.health", endpoint: "localhost", timestamp: new Date().toISOString() };

    await fs.writeFile(
      path.join(hardkasDir, "events.jsonl"),
      JSON.stringify(event1) + "\n" + JSON.stringify(event2) + "\n"
    );

    const indexer = new HardkasIndexer(store.getDatabase(), { cwd: tmpDir });
    indexer.sync();

    const db = store.getDatabase();
    const rows = db.prepare("SELECT kind, tx_id FROM events ORDER BY id ASC").all() as any[];
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].kind, "workflow.test");
    assert.strictEqual(rows[0].tx_id, "tx1");
    assert.strictEqual(rows[1].kind, "rpc.health");
  });

  it("should index lineage edges", async () => {
    const parentArtifact = {
      schema: "hardkas.test",
      version: "1.0.0-alpha",
      mode: "simulated",
      networkId: "simnet",
      createdAt: new Date().toISOString()
    };
    const parentHash = calculateContentHash(parentArtifact);
    (parentArtifact as any).contentHash = parentHash;

    const artifact = {
      schema: "hardkas.test",
      version: "1.0.0-alpha",
      mode: "simulated",
      networkId: "simnet",
      createdAt: new Date().toISOString(),
      lineage: {
        parentArtifactId: parentHash,
        sequence: 1
      }
    };
    (artifact as any).contentHash = calculateContentHash(artifact);

    await fs.writeFile(
      path.join(hardkasDir, "parent-artifact.json"),
      JSON.stringify(parentArtifact)
    );

    const indexer1 = new HardkasIndexer(store.getDatabase(), { cwd: tmpDir });
    indexer1.sync();

    await fs.writeFile(
      path.join(hardkasDir, "child-artifact.json"),
      JSON.stringify(artifact)
    );

    const indexer = new HardkasIndexer(store.getDatabase(), { cwd: tmpDir });
    indexer.sync();

    const db = store.getDatabase();
    const edges = db.prepare("SELECT parent_hash, child_hash FROM lineage_edges").all() as any[];
    assert.strictEqual(edges.length, 1);
    assert.strictEqual(edges[0].parent_hash, parentHash);
    assert.strictEqual(edges[0].child_hash, (artifact as any).contentHash);
  });

  it("should perform idempotent re-indexing", async () => {
    const artifact = {
      schema: "hardkas.test",
      version: "1.0.0-alpha",
      mode: "simulated",
      networkId: "simnet",
      createdAt: new Date().toISOString()
    };
    (artifact as any).contentHash = calculateContentHash(artifact);

    await fs.writeFile(
      path.join(hardkasDir, "artifact.json"),
      JSON.stringify(artifact)
    );

    const indexer = new HardkasIndexer(store.getDatabase(), { cwd: tmpDir });
    indexer.sync();
    indexer.sync(); // Second sync
    indexer.sync(); // Third sync

    const db = store.getDatabase();
    const count = (db.prepare("SELECT COUNT(*) as count FROM artifacts").get() as any).count;
    assert.strictEqual(count, 1); // Should still be 1
  });

  it("should skip corrupt artifacts gracefully", async () => {
    await fs.writeFile(
      path.join(hardkasDir, "corrupt.json"),
      "{ invalid json format "
    );

    const validArtifact = {
      schema: "hardkas.test",
      version: "1.0.0-alpha",
      mode: "simulated",
      networkId: "simnet",
      createdAt: new Date().toISOString()
    };
    (validArtifact as any).contentHash = calculateContentHash(validArtifact);
    await fs.writeFile(
      path.join(hardkasDir, "valid.json"),
      JSON.stringify(validArtifact)
    );

    const indexer = new HardkasIndexer(store.getDatabase(), { cwd: tmpDir });
    assert.doesNotThrow(() => indexer.sync());

    const db = store.getDatabase();
    const count = (db.prepare("SELECT COUNT(*) as count FROM artifacts").get() as any).count;
    assert.strictEqual(count, 1); // Only the valid one should be indexed
  });

  it("should support raw SQL query smoke test", () => {
    const db = store.getDatabase();
    db.exec(`
      INSERT INTO artifacts (hash, schema, version, mode, network_id, created_at, path, raw_json)
      VALUES ('hash1', 'hardkas.sql', '1.0', 'sim', 'net', '2025', 'path/a.json', '{}');
    `);

    const result = db.prepare("SELECT schema FROM artifacts WHERE hash = ?").get('hash1') as any;
    assert.strictEqual(result.schema, 'hardkas.sql');
  });

  it("should handle large number of artifacts without crashing", async () => {
    const count = 50;
    for (let i = 0; i < count; i++) {
      const artifact = {
        schema: `hardkas.bulk.${i}`,
        version: "1.0.0",
        mode: "test",
        networkId: "simnet",
        createdAt: new Date().toISOString()
      };
      (artifact as any).contentHash = `bulk-hash-${i}`;
      await fs.writeFile(
        path.join(hardkasDir, `bulk-${i}.json`),
        JSON.stringify(artifact)
      );
    }

    const indexer = new HardkasIndexer(store.getDatabase(), { cwd: tmpDir });
    indexer.sync();

    const db = store.getDatabase();
    const dbCount = (db.prepare("SELECT COUNT(*) as count FROM artifacts").get() as any).count;
    assert.strictEqual(dbCount, count);
  });

  it("should handle mixed valid and malformed events.jsonl", async () => {
    const validEvent = { kind: "workflow.valid", txId: "tx-ok" };
    const malformedLine = "{ this is not json }";
    const partialEvent = { kind: "rpc.partial" }; // missing txId but should still index

    await fs.writeFile(
      path.join(hardkasDir, "events.jsonl"),
      JSON.stringify(validEvent) + "\n" + malformedLine + "\n" + JSON.stringify(partialEvent) + "\n"
    );

    const indexer = new HardkasIndexer(store.getDatabase(), { cwd: tmpDir });
    indexer.sync();

    const db = store.getDatabase();
    const rows = db.prepare("SELECT kind FROM events").all() as any[];
    assert.strictEqual(rows.length, 2);
    const kinds = rows.map(r => r.kind);
    assert.ok(kinds.includes("workflow.valid"));
    assert.ok(kinds.includes("rpc.partial"));
  });
});
