export type HardkasArtifactSchema =
  | "hardkas.txPlan"
  | "hardkas.signedTx";

export interface HardkasArtifactBase {
  schema: HardkasArtifactSchema;
  version: number;
  createdAt: string;
}

export interface TxPlanArtifact extends HardkasArtifactBase {
  schema: "hardkas.txPlan";
  version: 1;
  status: "unsigned";

  network: string;
  mode: "simulated" | "kaspa-node" | "kaspa-rpc";

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
  schema: "hardkas.signedTx";
  version: 1;
  status: "signed";

  source: {
    schema: "hardkas.txPlan";
    version: 1;
    artifactPath?: string | undefined;
    planHash?: string | undefined;
  };

  network: string;
  mode: "simulated" | "kaspa-node" | "kaspa-rpc";

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
