import { HardkasArtifactSchema, HardkasArtifactMode } from "./constants.js";

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
}

export interface RealTxPlanArtifact extends HardkasArtifactBase {
  readonly schema: "hardkas.realTxPlan.v1";
  readonly status: "built";
  
  readonly mode: "node" | "rpc";
  readonly networkId: string;
  readonly planId: string;
  
  readonly from: {
    readonly accountName?: string;
    readonly address: string;
  };
  
  readonly to: {
    readonly address: string;
  };
  
  readonly amountSompi: string;
  readonly feeRateSompiPerMass: string;
  
  readonly selectedUtxos: readonly UtxoArtifact[];
  readonly outputs: readonly TxOutputArtifact[];
  readonly change?: TxOutputArtifact;
  
  readonly estimatedMass: string;
  readonly estimatedFeeSompi: string;
}

export interface RealSignedTxArtifact extends HardkasArtifactBase {
  readonly schema: "hardkas.realSignedTx.v1";
  readonly status: "signed";
  
  readonly mode: "rpc" | "node";
  readonly networkId: string;
  readonly createdAt: string;
  readonly signedId: string;
  readonly sourcePlanId: string;
  readonly sourcePlanPath?: string;
  
  readonly from: {
    readonly accountName?: string;
    readonly address: string;
  };
  
  readonly to: {
    readonly address: string;
  };
  
  readonly amountSompi: string;
  readonly feeSompi: string;
  readonly changeSompi?: string;
  
  readonly selectedUtxos: readonly UtxoArtifact[];
  
  readonly signedTransaction: {
    readonly format: "kaspa-sdk" | "hex" | "json" | "unknown";
    readonly payload: string;
  };
  
  readonly txId?: string;
}

export interface RealTxSubmitReceipt extends HardkasArtifactBase {
  readonly schema: "hardkas.realTxSubmitReceipt.v1";
  readonly status: "submitted";
  
  readonly networkId: string;
  readonly mode: "rpc" | "node";
  readonly txId: string;
  readonly sourceSignedId: string;
  readonly sourceSignedPath?: string;
  readonly submittedAt: string;
  readonly rpcUrl: string;
  readonly signedTransactionFormat: string;
}

export interface HardkasArtifactBase {
  schema: HardkasArtifactSchema;
  hardkasVersion: string;
  createdAt: string;
  
  // Legacy support
  kind?: string;
  version?: number;
}

export interface TxPlanArtifact extends HardkasArtifactBase {
  schema: "hardkas.txPlan.v1";
  status: "unsigned";

  networkId: string;
  mode: HardkasArtifactMode;

  rpcUrl?: string | null | undefined;

  from: {
    input: string;
    address: string;
  };

  to: {
    input: string;
    address: string;
  };

  amountSompi: string;
  amount: string;

  selectedUtxos: Array<{
    id: string;
    address: string;
    amountSompi: string;
    amount: string;
    txId?: string | undefined;
    outputIndex?: number | undefined;
    scriptPublicKey?: string | undefined;
  }>;

  outputs: Array<{
    kind: string;
    address?: string | undefined;
    amountSompi: string;
    amount: string;
    script?: string | undefined;
  }>;

  estimatedMass: string;
  estimatedFeeSompi: string;
  estimatedFee: string;
  changeSompi: string;
  change: string;

  metadata?: {
    hardkasVersion?: string | undefined;
    note?: string | undefined;
  } | undefined;
}

export interface SignedTxArtifact extends HardkasArtifactBase {
  schema: "hardkas.signedTx.v1";
  status: "signed";

  source: {
    schema: "hardkas.txPlan.v1";
    version?: number;
    artifactPath?: string | undefined;
    planHash?: string | undefined;
  };

  networkId: string;
  mode: HardkasArtifactMode;

  from: {
    input: string;
    address: string;
  };

  to: {
    input: string;
    address: string;
  };

  amountSompi: string;
  amount: string;

  selectedUtxos: TxPlanArtifact["selectedUtxos"];
  outputs: TxPlanArtifact["outputs"];

  estimatedMass: string;
  estimatedFeeSompi: string;
  estimatedFee: string;
  changeSompi: string;
  change: string;

  signature: {
    kind: "simulated" | "kaspa" | "kaspa-placeholder" | "external-wallet";
    account: string;
    signerAddress?: string | undefined;
    value: string;
  };

  signedTransaction?: {
    encoding: "simulated" | "kaspa-raw" | "unknown";
    value: string;
  } | undefined;

  metadata?: {
    hardkasVersion?: string | undefined;
    signingBackend?: string | undefined;
    warning?: string | undefined;
    note?: string | undefined;
  } | undefined;
}
