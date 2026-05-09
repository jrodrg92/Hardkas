import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { HardkasStore } from "../src/db.js";
import { SqliteQueryBackend } from "../src/backend.js";

describe("SqliteQueryBackend", () => {
  let store: HardkasStore;
  let backend: SqliteQueryBackend;

  beforeEach(() => {
    store = new HardkasStore({ memory: true });
    store.connect();
    backend = new SqliteQueryBackend(store);

    // Seed some data
    const db = store.getDatabase();
    db.exec(`
      INSERT INTO artifacts (hash, schema, version, mode, network_id, created_at, path, raw_json)
      VALUES 
        ('h1', 'hardkas.txPlan', '1.0', 'simulated', 'simnet', '2025-01-01T00:00:00Z', 'p1.json', '{"txId":"tx1"}'),
        ('h2', 'hardkas.signedTx', '1.0', 'live', 'mainnet', '2025-01-01T01:00:00Z', 'p2.json', '{"txId":"tx2"}');
      
      INSERT INTO events (kind, tx_id, endpoint, created_at, raw_json)
      VALUES
        ('workflow.submitted', 'tx1', 'localhost', '2025-01-01T00:05:00Z', '{"foo":"bar"}'),
        ('rpc.health', null, 'localhost', '2025-01-01T00:06:00Z', '{"score":95}');
    `);
  });

  afterEach(() => {
    store.disconnect();
  });

  it("should find artifacts with filters", async () => {
    const all = await backend.findArtifacts();
    assert.strictEqual(all.length, 2);

    const sim = await backend.findArtifacts({ mode: "simulated" });
    assert.strictEqual(sim.length, 1);
    assert.strictEqual(sim[0].contentHash, "h1");

    const mainnet = await backend.findArtifacts({ networkId: "mainnet" });
    assert.strictEqual(mainnet.length, 1);
    assert.strictEqual(mainnet[0].contentHash, "h2");
  });

  it("should get a specific artifact by hash", async () => {
    const art = await backend.getArtifact("h1");
    assert.ok(art);
    assert.strictEqual(art?.schema, "hardkas.txPlan");
    assert.strictEqual(art?.payload.txId, "tx1");

    const none = await backend.getArtifact("non-existent");
    assert.strictEqual(none, null);
  });

  it("should get events with filters", async () => {
    const all = await backend.getEvents();
    assert.strictEqual(all.length, 2);

    const rpc = await backend.getEvents({ kind: "rpc.health" });
    assert.strictEqual(rpc.length, 1);
    assert.strictEqual(rpc[0].kind, "rpc.health");

    const tx1 = await backend.getEvents({ txId: "tx1" });
    assert.strictEqual(tx1.length, 1);
    assert.strictEqual(tx1[0].txId, "tx1");
  });
});
