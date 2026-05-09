import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { calculateContentHash } from "@hardkas/artifacts";

export interface IndexerOptions {
  cwd?: string;
}

export class HardkasIndexer {
  private db: DatabaseSync;
  private hardkasDir: string;

  constructor(db: DatabaseSync, options: IndexerOptions = {}) {
    this.db = db;
    this.hardkasDir = path.join(options.cwd || process.cwd(), ".hardkas");
  }

  public sync() {
    if (!fs.existsSync(this.hardkasDir)) return;

    this.db.exec("BEGIN TRANSACTION;");
    try {
      this.syncArtifacts();
      this.syncEvents();
      this.db.exec("COMMIT;");
    } catch (e) {
      this.db.exec("ROLLBACK;");
      throw e;
    }
  }

  private syncArtifacts() {
    const walk = (dir: string): string[] => {
      let results: string[] = [];
      if (!fs.existsSync(dir)) return results;
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          results = results.concat(walk(filePath));
        } else if (file.endsWith(".json") && !file.endsWith("events.jsonl") && file !== "state.json") {
          results.push(filePath);
        }
      }
      return results;
    };

    const files = walk(this.hardkasDir);

    const insertArtifact = this.db.prepare(`
      INSERT OR REPLACE INTO artifacts 
      (hash, schema, version, mode, network_id, created_at, path, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertEdge = this.db.prepare(`
      INSERT OR IGNORE INTO lineage_edges (parent_hash, child_hash, rule, sequence)
      VALUES (?, ?, ?, ?)
    `);

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      try {
        const parsed = JSON.parse(content);
        if (!parsed.schema || !parsed.version) continue;

        const hash = parsed.contentHash || calculateContentHash(parsed);
        const relativePath = path.relative(this.hardkasDir, file);

        insertArtifact.run(
          hash,
          parsed.schema,
          parsed.version,
          parsed.mode || "unknown",
          parsed.networkId || "unknown",
          parsed.createdAt || new Date().toISOString(),
          relativePath,
          content
        );

        if (parsed.lineage && parsed.lineage.parentArtifactId) {
          insertEdge.run(
            parsed.lineage.parentArtifactId,
            hash,
            "derived",
            parsed.lineage.sequence || 0
          );
        }

      } catch (e) {
        // Skip invalid JSON
      }
    }
  }

  private syncEvents() {
    const eventsPath = path.join(this.hardkasDir, "events.jsonl");
    if (!fs.existsSync(eventsPath)) return;

    const content = fs.readFileSync(eventsPath, "utf-8");
    const lines = content.split("\n").filter(l => l.trim() !== "");

    // Simple approach: get count of events, only insert new ones
    // A production version would track byte offsets
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM events");
    const result = stmt.get() as { count: number };
    const existingCount = result.count;

    if (lines.length <= existingCount) return;

    const newLines = lines.slice(existingCount);

    const insertEvent = this.db.prepare(`
      INSERT INTO events (kind, tx_id, endpoint, created_at, raw_json)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const line of newLines) {
      try {
        const parsed = JSON.parse(line);
        insertEvent.run(
          parsed.kind || "unknown",
          parsed.txId || null,
          parsed.endpoint || null,
          parsed.timestamp || new Date().toISOString(),
          line
        );
      } catch (e) {
        // Skip invalid line
      }
    }
  }
}
