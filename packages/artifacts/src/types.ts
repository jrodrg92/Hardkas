import { HardkasArtifactSchema, HardkasArtifactMode } from "./constants.js";

export interface HardkasArtifactBase {
  schema: HardkasArtifactSchema;
  hardkasVersion: string;
  networkId: string;
  mode: HardkasArtifactMode;
  createdAt: string;
}

export interface UtxoArtifact {
  readonly outpoint: {
    readonly transactionId: string;
    readonly index: number;
  };
  readonly address: string;
  readonly amountSompi: string;
  readonly scriptPublicKey: string;
  readonly blockDaaScore?: string;
  readonly isCoinbase?: boolean;
}

export interface TxOutputArtifact {
  readonly address: string;
  readonly amountSompi: string;
  readonly amount?: string;
  readonly script?: string;
}

export interface TxPlanArtifact extends HardkasArtifactBase {
  readonly schema: "hardkas.txPlan.v1";
  readonly status: "built" | "unsigned";
  
  readonly planId: string;
  
  readonly from: {
    readonly input: string;
    readonly address: string;
    readonly accountName?: string;
  };
  
  readonly to: {
    readonly input: string;
    readonly address: string;
  };
  
  readonly amountSompi: string;
  readonly amount: string;
  
  readonly selectedUtxos: readonly UtxoArtifact[];
  readonly outputs: readonly TxOutputArtifact[];
  readonly change?: TxOutputArtifact;
  
  readonly estimatedMass: string;
  readonly estimatedFeeSompi: string;
  readonly estimatedFee: string;
  
  readonly rpcUrl?: string | null;
  readonly metadata?: Record<string, any>;
}

export interface SignedTxArtifact extends HardkasArtifactBase {
  readonly schema: "hardkas.signedTx.v1";
  readonly status: "signed";
  
  readonly signedId: string;
  readonly sourcePlanId: string;
  readonly sourcePlanPath?: string;
  
  readonly from: {
    readonly input: string;
    readonly address: string;
    readonly accountName?: string;
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
  
  readonly txId?: string; // Proposed TxID if deterministic
  readonly metadata?: Record<string, any>;
}

export interface TxReceiptArtifact extends HardkasArtifactBase {
  readonly schema: "hardkas.txReceipt.v1";
  readonly status: "submitted" | "confirmed" | "failed";
  
  readonly txId: string;
  readonly sourceSignedId?: string;
  readonly sourceSignedPath?: string;
  
  readonly amountSompi: string;
  readonly feeSompi: string;
  readonly daaScore?: string;
  
  readonly submittedAt: string;
  readonly confirmedAt?: string;
  readonly rpcUrl: string;
  
  readonly receiptPath?: string; // Link to detailed receipt if applicable
  readonly tracePath?: string;   // Link to trace artifact
  
  readonly metadata?: Record<string, any>;
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
