import { HardkasArtifactSchema } from "./constants.js";
import { NetworkId, ExecutionMode, ArtifactType } from "@hardkas/core";

export interface HardkasArtifactBase {
  schema: HardkasArtifactSchema;
  hardkasVersion: string;
  version: string;
  networkId: string;
  mode: string;
  createdAt: string;
}

export interface BaseArtifactV2<T extends ArtifactType> {
  schema: `hardkas.${T}.v2`;
  hardkasVersion: string;
  version: "2.0.0";
  networkId: NetworkId;
  mode: ExecutionMode;
  createdAt: string;
  contentHash?: string | undefined;
  lineage?: {
    artifactId: string;
    lineageId: string;
    parentArtifactId?: string | undefined;
    rootArtifactId: string;
    sequence?: number | undefined;
  } | undefined;
}

export interface DagContext {
  mode: "linear" | "dag-light";
  sink: string;
  selectedParent?: string;
  branchId?: string;
  acceptedTxIds?: string[];
  displacedTxIds?: string[];
  conflictSet?: Array<{
    outpoint: string;
    winnerTxId: string;
    loserTxIds: string[];
  }>;
  nonSelectedContext?: boolean;
}

export interface UtxoArtifact {
  readonly outpoint: {
    readonly transactionId: string;
    readonly index: number;
  };
  readonly address: string;
  readonly amountSompi: string;
  readonly scriptPublicKey: string;
  readonly blockDaaScore?: string | undefined;
  readonly isCoinbase?: boolean | undefined;
}

export interface TxOutputArtifact {
  readonly address: string;
  readonly amountSompi: string;
  readonly amount?: string | undefined;
  readonly script?: string | undefined;
}

export interface TxPlanArtifactV1 extends HardkasArtifactBase {
  readonly schema: "hardkas.txPlan.v1";
  readonly status: "built" | "unsigned";
  
  readonly planId: string;
  
  readonly from: {
    readonly input: string;
    readonly address: string;
    readonly accountName?: string | undefined;
  };
  
  readonly to: {
    readonly input: string;
    readonly address: string;
  };
  
  readonly amountSompi: string;
  readonly amount: string;
  
  readonly selectedUtxos: readonly UtxoArtifact[];
  readonly outputs: readonly TxOutputArtifact[];
  readonly change?: TxOutputArtifact | undefined;
  
  readonly estimatedMass: string;
  readonly estimatedFeeSompi: string;
  readonly estimatedFee: string;
  
  readonly rpcUrl?: string | null | undefined;
  readonly metadata?: Record<string, any> | undefined;
}

export interface SignedTxArtifactV1 extends HardkasArtifactBase {
  readonly schema: "hardkas.signedTx.v1";
  readonly status: "signed";
  
  readonly signedId: string;
  readonly sourcePlanId: string;
  readonly sourcePlanPath?: string | undefined;
  
  readonly from: {
    readonly input: string;
    readonly address: string;
    readonly accountName?: string | undefined;
  };
  
  readonly to: {
    readonly input: string;
    readonly address: string;
  };
  
  readonly amountSompi: string;
  readonly amount: string;
  
  readonly signedTransaction: {
    readonly format: "kaspa-sdk" | "hex" | "simulated" | "unknown";
    readonly payload: string;
  };
  
  readonly txId?: string | undefined; // Proposed TxID if deterministic
  readonly metadata?: Record<string, any> | undefined;
}

export interface TxReceiptArtifactV1 extends HardkasArtifactBase {
  readonly schema: "hardkas.txReceipt.v1";
  readonly status: "submitted" | "accepted" | "confirmed" | "finalized" | "failed";
  
  readonly txId: string;
  readonly sourceSignedId?: string | undefined;
  readonly sourceSignedPath?: string | undefined;
  
  readonly from: {
    readonly address: string;
    readonly accountName?: string | undefined;
  };
  
  readonly to: {
    readonly address: string;
  };
  
  readonly amountSompi: string;
  readonly amount: string;
  readonly feeSompi: string;
  
  readonly daaScore?: string | undefined;
  readonly blueScore?: string | undefined;
  
  readonly submittedAt: string;
  readonly confirmedAt?: string | undefined;
  readonly rpcUrl: string;
  
  readonly receiptPath?: string | undefined; // Link to detailed receipt if applicable
  readonly tracePath?: string | undefined;   // Link to trace artifact
  
  readonly metadata?: Record<string, any> | undefined;
}

export interface TxTraceArtifactV1 extends HardkasArtifactBase {
  readonly schema: "hardkas.txTrace.v1";
  readonly txId: string;
  readonly steps: Array<{
    phase: string;
    status: string;
    timestamp: string;
    details?: any;
  }>;
}

// --- V2 Artifact Interfaces ---

export interface TxPlanArtifactV2 extends BaseArtifactV2<"txPlan"> {
  planId: string;
  from: { address: string; accountName?: string | undefined };
  to: { address: string; accountName?: string | undefined };
  amountSompi: string;
  estimatedFeeSompi: string;
  estimatedMass: string;
  inputs: Array<{
    outpoint: { transactionId: string; index: number };
    amountSompi: string;
  }>;
  outputs: Array<{
    address: string;
    amountSompi: string;
  }>;
  change?: {
    address: string;
    amountSompi: string;
  } | undefined;
}

export interface SignedTxArtifactV2 extends BaseArtifactV2<"signedTx"> {
  status: "signed";
  signedId: string;
  sourcePlanId: string;
  from: { address: string };
  to: { address: string };
  amountSompi: string;
  signedTransaction: {
    format: string;
    payload: string;
  };
  txId?: string | undefined;
  metadata?: any | undefined;
}

export interface TxReceiptArtifactV2 extends BaseArtifactV2<"txReceipt"> {
  txId: string;
  status: "pending" | "submitted" | "accepted" | "confirmed" | "failed";
  from: { address: string };
  to: { address: string };
  amountSompi: string;
  feeSompi: string;
  mass?: string | undefined;
  daaScore?: string | undefined;
}

export interface SnapshotArtifactV2 extends BaseArtifactV2<"snapshot"> {
  name?: string | undefined;
  daaScore: string;
  accounts: Array<{ name: string; address: string }>;
  utxos: Array<{
    id: string;
    address: string;
    amountSompi: string;
    spent: boolean;
    createdAtDaaScore: string;
  }>;
}

// Igra L2 Artifacts (Imported from igra-artifacts.ts)
export * from "./igra-artifacts.js";
