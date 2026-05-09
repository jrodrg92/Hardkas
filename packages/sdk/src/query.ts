import { Hardkas } from "./index.js";
import { 
  readEvents, 
  correlate, 
  QueryEngine, 
  createQueryRequest,
  type EventReadOptions,
  type ObsEvent,
  type CorrelationBundle
} from "@hardkas/query";

/**
 * HardKAS Operational Query Module
 */
export class HardkasQuery {
  private _engine: QueryEngine | null = null;

  constructor(private sdk: Hardkas) {}

  /**
   * Reads raw observability events.
   */
  async events(options?: EventReadOptions): Promise<ObsEvent[]> {
    return readEvents({
      cwd: this.sdk.config.cwd,
      ...options
    });
  }

  /**
   * Reconstructs full operational context for a transaction.
   */
  async correlate(txId: string): Promise<CorrelationBundle> {
    const engine = await this.getEngine();
    const result = await correlate(txId, engine, {
      include: ["lineage", "dag", "rpc", "replay"],
      cwd: this.sdk.config.cwd,
      explain: "brief"
    });
    const bundle = result.items[0];
    if (!bundle) throw new Error(`Could not correlate transaction ${txId}`);
    return bundle;
  }

  /**
   * Internal lazy-loaded query engine.
   */
  private async getEngine(): Promise<QueryEngine> {
    if (this._engine) return this._engine;
    
    const { QueryEngine } = await import("@hardkas/query");
    this._engine = new QueryEngine({
      artifactDir: this.sdk.config.cwd
    });
    return this._engine;
  }
}
