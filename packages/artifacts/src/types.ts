import { HardkasArtifactSchema, HardkasArtifactMode } from "./constants.js";

export interface HardkasArtifactBase {
  schema: HardkasArtifactSchema;
  hardkasVersion: string;
  networkId: string;
  mode: HardkasArtifactMode;
  createdAt: string;
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

export interface TxPlanArtifact extends HardkasArtifactBase {
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

export interface SignedTxArtifact extends HardkasArtifactBase {
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

export interface TxReceiptArtifact extends HardkasArtifactBase {
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

export interface TxTraceArtifact extends HardkasArtifactBase {
  readonly schema: "hardkas.txTrace.v1";
  readonly txId: string;
  readonly steps: Array<{
    phase: string;
    status: string;
    timestamp: string;
    details?: any;
  }>;
}

// Igra L2 Artifacts (Imported from igra-artifacts.ts)
export * from "./igra-artifacts.js";
