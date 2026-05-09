/**
 * HardKAS Core Event Bus.
 *
 * Lightweight, typed event emitter that lives in @hardkas/core so ALL packages
 * can emit events without depending on the higher-level @hardkas/query layer.
 *
 * The query/observability layer SUBSCRIBES to these events — it never
 * owns the emission contract.
 *
 * Design:
 *   @hardkas/core        → defines types + emitter
 *   localnet / rpc / cli → emit CoreEvent via coreEvents.emit(...)
 *   @hardkas/query       → subscribes + persists to events.jsonl
 */

// ---------------------------------------------------------------------------
// Event Taxonomy
// ---------------------------------------------------------------------------

export type CoreEventKind =
  // Workflow events
  | "workflow.plan.created"
  | "workflow.signed"
  | "workflow.submitted"
  | "workflow.receipt"
  // Integrity events
  | "integrity.hash_mismatch"
  | "integrity.schema_violation"
  | "integrity.lineage_break"
  // DAG events
  | "dag.conflict"
  | "dag.displacement"
  | "dag.sink_moved"
  // RPC events
  | "rpc.health"
  | "rpc.error"
  | "rpc.stale"
  // Replay events
  | "replay.divergence"
  | "replay.verified";

export interface CoreEvent {
  readonly ts: string;             // ISO 8601
  readonly kind: CoreEventKind;
  readonly [key: string]: unknown; // domain-specific fields
}

// Typed event constructors for common events
export interface WorkflowPlanEvent extends CoreEvent {
  readonly kind: "workflow.plan.created";
  readonly planId: string;
  readonly planHash: string;
  readonly network: string;
  readonly mode: string;
}

export interface WorkflowReceiptEvent extends CoreEvent {
  readonly kind: "workflow.receipt";
  readonly txId: string;
  readonly status: string;
  readonly daaScore: string;
}

export interface RpcHealthEvent extends CoreEvent {
  readonly kind: "rpc.health";
  readonly endpoint: string;
  readonly state: string;
  readonly score: number;
  readonly latencyMs: number;
}

export interface RpcErrorEvent extends CoreEvent {
  readonly kind: "rpc.error";
  readonly endpoint: string;
  readonly error: string;
  readonly retriable: boolean;
}

export interface DagConflictEvent extends CoreEvent {
  readonly kind: "dag.conflict";
  readonly outpoint: string;
  readonly winner: string;
  readonly losers: string[];
}

export interface ReplayDivergenceEvent extends CoreEvent {
  readonly kind: "replay.divergence";
  readonly txId: string;
  readonly field: string;
  readonly expected: string;
  readonly actual: string;
}

// ---------------------------------------------------------------------------
// Event Bus
// ---------------------------------------------------------------------------

export type CoreEventListener = (event: CoreEvent) => void;

class CoreEventBus {
  private listeners: CoreEventListener[] = [];

  /**
   * Subscribe to all core events.
   * Returns an unsubscribe function.
   */
  on(listener: CoreEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Emit a core event. Timestamps are attached automatically.
   * Emission is fire-and-forget — listener errors are swallowed.
   */
  emit(event: Omit<CoreEvent, "ts">): void {
    const stamped: CoreEvent = { 
      ts: new Date().toISOString(), 
      ...event 
    } as CoreEvent;
    
    for (const listener of this.listeners) {
      try {
        listener(stamped);
      } catch {
        // Fire-and-forget. Observability must never break workflows.
      }
    }
  }

  /**
   * Remove all listeners. Useful for tests.
   */
  removeAll(): void {
    this.listeners = [];
  }
}

/**
 * Singleton event bus shared across all HardKAS packages.
 */
export const coreEvents = new CoreEventBus();
