export type HardkasArtifactSchema = "hardkas.txPlan";

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

  rpcUrl?: string | null;

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
    txId?: string;
    outputIndex?: number;
    scriptPublicKey?: string;
  }>;

  outputs: Array<{
    kind: string;
    address?: string;
    amountSompi: string;
    amount: string;
    script?: string;
  }>;

  estimatedMass: string;
  estimatedFeeSompi: string;
  estimatedFee: string;
  changeSompi: string;
  change: string;

  metadata?: {
    hardkasVersion?: string;
    note?: string;
  };
}
