import { formatSompi } from "@hardkas/core";
import type { TxPlan } from "@hardkas/tx-builder";
import type { TxPlanArtifact } from "./types.js";

export interface CreateTxPlanArtifactInput {
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
  amountSompi: bigint;
  plan: TxPlan;
  metadata?: TxPlanArtifact["metadata"];
}

export function createTxPlanArtifact(input: CreateTxPlanArtifactInput): TxPlanArtifact {
  return {
    schema: "hardkas.txPlan",
    version: 1,
    status: "unsigned",
    createdAt: new Date().toISOString(),
    network: input.network,
    mode: input.mode,
    rpcUrl: input.rpcUrl,
    from: input.from,
    to: input.to,
    amountSompi: input.amountSompi.toString(),
    amount: formatSompi(input.amountSompi),
    selectedUtxos: input.plan.inputs.map(utxo => ({
      id: `${utxo.outpoint.transactionId}:${utxo.outpoint.index}`,
      address: utxo.address,
      amountSompi: utxo.amountSompi.toString(),
      amount: formatSompi(utxo.amountSompi),
      txId: utxo.outpoint.transactionId,
      outputIndex: utxo.outpoint.index,
      scriptPublicKey: utxo.scriptPublicKey
    })),
    outputs: [
      ...input.plan.outputs.map(output => ({
        kind: "payment",
        address: output.address,
        amountSompi: output.amountSompi.toString(),
        amount: formatSompi(output.amountSompi),
        script: output.scriptPublicKey
      })),
      ...(input.plan.change ? [{
        kind: "change",
        address: input.plan.change.address,
        amountSompi: input.plan.change.amountSompi.toString(),
        amount: formatSompi(input.plan.change.amountSompi),
        script: input.plan.change.scriptPublicKey
      }] : [])
    ],
    estimatedMass: input.plan.estimatedMass.toString(),
    estimatedFeeSompi: input.plan.estimatedFeeSompi.toString(),
    estimatedFee: formatSompi(input.plan.estimatedFeeSompi),
    changeSompi: input.plan.change ? input.plan.change.amountSompi.toString() : "0",
    change: input.plan.change ? formatSompi(input.plan.change.amountSompi) : "0.00000000 KAS",
    metadata: input.metadata
  };
}

export function txPlanArtifactToJson(artifact: TxPlanArtifact): string {
  return JSON.stringify(artifact, null, 2) + "\n";
}
