import { TxId, KaspaAddress, ArtifactId, LineageId } from "./branded.js";

/**
 * HardKAS Core Event Bus.
 * 
 * Moving from embryonic "string | unknown" to a strict discriminated union.
 */

export type CoreEvent = 
  | WorkflowEvent
  | IntegrityEvent
  | DagEvent
  | RpcEvent
  | ReplayEvent;

// --- Workflow Domain ---
export type WorkflowEvent = 
  | { kind: "workflow.plan.created"; planId: ArtifactId; network: string; amountSompi: bigint }
  | { kind: "workflow.signed"; signedId: ArtifactId; planId: ArtifactId; txId?: TxId }
  | { kind: "workflow.submitted"; txId: TxId; rpcUrl: string }
  | { kind: "workflow.receipt"; txId: TxId; status: "accepted" | "finalized" | "failed"; daaScore?: bigint };

// --- Integrity Domain ---
export type IntegrityEvent =
  | { kind: "integrity.hash_mismatch"; artifactId: ArtifactId; expected: string; actual: string }
  | { kind: "integrity.schema_violation"; artifactId: ArtifactId; details: string }
  | { kind: "integrity.lineage_break"; lineageId: LineageId; artifactId: ArtifactId };

// --- DAG Domain ---
export type DagEvent =
  | { kind: "dag.conflict"; outpoint: string; winner: TxId; losers: TxId[] }
  | { kind: "dag.displacement"; txId: TxId; displacedBy: TxId }
  | { kind: "dag.sink_moved"; oldSink: string; newSink: string; daaScore: bigint };

// --- RPC Domain ---
export type RpcEvent =
  | { kind: "rpc.health"; endpoint: string; state: "healthy" | "degraded" | "unreachable"; latencyMs: number }
  | { kind: "rpc.error"; endpoint: string; error: string; retriable: boolean }
  | { kind: "rpc.stale"; endpoint: string; lastDaaScore: bigint; currentDaaScore: bigint };

// --- Replay Domain ---
export type ReplayEvent =
  | { kind: "replay.divergence"; txId: TxId; field: string; expected: string; actual: string }
  | { kind: "replay.verified"; txId: TxId; lineageId: LineageId };

/**
 * Enveloped Event for the Bus
 */
export type StampedEvent = CoreEvent & { ts: string };

export type CoreEventListener = (event: StampedEvent) => void;

class CoreEventBus {
  private listeners: CoreEventListener[] = [];

  on(listener: CoreEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  emit(event: CoreEvent): void {
    const stamped: StampedEvent = { 
      ts: new Date().toISOString(), 
      ...event 
    } as StampedEvent;
    
    for (const listener of this.listeners) {
      try {
        listener(stamped);
      } catch {
        // Fire-and-forget.
      }
    }
  }

  removeAll(): void {
    this.listeners = [];
  }
}

export const coreEvents = new CoreEventBus();
