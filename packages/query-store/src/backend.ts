import type { QueryBackend, ArtifactDocument, EventDocument, LineageEdgeDocument } from "@hardkas/query";
import { HardkasStore } from "./db.js";

export class SqliteQueryBackend implements QueryBackend {
  private store: HardkasStore;

  constructor(store: HardkasStore) {
    this.store = store;
  }

  isReady(): boolean {
    return this.store.getDatabase() !== null;
  }

  async findArtifacts(filters?: { schema?: string; mode?: string; networkId?: string }): Promise<ArtifactDocument[]> {
    const db = this.store.getDatabase();
    
    let query = "SELECT * FROM artifacts WHERE 1=1";
    const params: any[] = [];
    
    if (filters?.schema) {
      query += " AND schema = ?";
      params.push(filters.schema);
    }
    if (filters?.mode) {
      query += " AND mode = ?";
      params.push(filters.mode);
    }
    if (filters?.networkId) {
      query += " AND network_id = ?";
      params.push(filters.networkId);
    }
    
    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(r => ({
      contentHash: r.hash,
      schema: r.schema,
      version: r.version,
      mode: r.mode,
      networkId: r.network_id,
      createdAt: r.created_at,
      path: r.path,
      payload: JSON.parse(r.raw_json)
    }));
  }

  async getArtifact(idOrHash: string): Promise<ArtifactDocument | null> {
    const db = this.store.getDatabase();
    
    // SQLite query looking for matching hash, or looking inside raw_json for artifactId
    // For performance, just searching by hash
    const row = db.prepare("SELECT * FROM artifacts WHERE hash = ?").get(idOrHash) as any;
    
    if (!row) return null;
    
    return {
      contentHash: row.hash,
      schema: row.schema,
      version: row.version,
      mode: row.mode,
      networkId: row.network_id,
      createdAt: row.created_at,
      path: row.path,
      payload: JSON.parse(row.raw_json)
    };
  }

  async getEvents(filters?: { kind?: string; txId?: string }): Promise<EventDocument[]> {
    const db = this.store.getDatabase();
    
    let query = "SELECT * FROM events WHERE 1=1";
    const params: any[] = [];
    
    if (filters?.kind) {
      query += " AND kind = ?";
      params.push(filters.kind);
    }
    if (filters?.txId) {
      query += " AND tx_id = ?";
      params.push(filters.txId);
    }
    
    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(r => ({
      id: r.id,
      kind: r.kind,
      txId: r.tx_id,
      endpoint: r.endpoint,
      createdAt: r.created_at,
      payload: JSON.parse(r.raw_json)
    }));
  }

  async getLineageEdges(filters?: { parentHash?: string; childHash?: string }): Promise<LineageEdgeDocument[]> {
    const db = this.store.getDatabase();
    
    let query = "SELECT * FROM lineage_edges WHERE 1=1";
    const params: any[] = [];
    
    if (filters?.parentHash) {
      query += " AND parent_hash = ?";
      params.push(filters.parentHash);
    }
    if (filters?.childHash) {
      query += " AND child_hash = ?";
      params.push(filters.childHash);
    }
    
    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(r => ({
      parentHash: r.parent_hash,
      childHash: r.child_hash,
      rule: r.rule,
      sequence: r.sequence
    }));
  }
}
