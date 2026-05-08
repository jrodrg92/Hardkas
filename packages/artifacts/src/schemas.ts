import { z } from "zod";

export const ARTIFACT_V2_VERSION = "2.0.0";

export const BaseArtifactSchema = z.object({
  schema: z.string(),
  hardkasVersion: z.string(),
  version: z.literal(ARTIFACT_V2_VERSION),
  contentHash: z.string().optional(),
  createdAt: z.string().datetime()
});

export const TxPlanSchemaV2 = BaseArtifactSchema.extend({
  schema: z.literal("hardkas.txPlan.v2"),
  networkId: z.string(),
  mode: z.enum(["real", "simulated"]),
  planId: z.string(),
  from: z.object({
    address: z.string(),
    accountName: z.string().optional()
  }),
  to: z.object({
    address: z.string()
  }),
  amountSompi: z.string(),
  estimatedFeeSompi: z.string(),
  estimatedMass: z.string(),
  inputs: z.array(z.object({
    outpoint: z.object({
      transactionId: z.string(),
      index: z.number()
    }),
    amountSompi: z.string()
  })),
  outputs: z.array(z.object({
    address: z.string(),
    amountSompi: z.string()
  }))
});

export const LocalnetUtxoSchemaV2 = z.object({
  id: z.string(),
  address: z.string(),
  amountSompi: z.string(),
  spent: z.boolean(),
  createdAtDaaScore: z.string()
});

export const SnapshotSchemaV2 = BaseArtifactSchema.extend({
  schema: z.literal("hardkas.snapshot.v2"),
  name: z.string().optional(),
  daaScore: z.string(),
  accountsHash: z.string().optional(),
  utxoSetHash: z.string().optional(),
  stateHash: z.string().optional(),
  accounts: z.array(z.object({
    name: z.string(),
    address: z.string()
  })),
  utxos: z.array(LocalnetUtxoSchemaV2)
});

export const TxReceiptSchemaV2 = BaseArtifactSchema.extend({
  schema: z.literal("hardkas.txReceipt.v2"),
  txId: z.string(),
  status: z.enum(["pending", "accepted", "confirmed", "failed"]),
  mode: z.enum(["real", "simulated"]),
  networkId: z.string(),
  from: z.object({ address: z.string() }),
  to: z.object({ address: z.string() }),
  amountSompi: z.string(),
  feeSompi: z.string(),
  mass: z.string().optional(),
  changeSompi: z.string().optional(),
  spentUtxoIds: z.array(z.string()).optional(),
  createdUtxoIds: z.array(z.string()).optional(),
  daaScore: z.string().optional(),
  preStateHash: z.string().optional(),
  postStateHash: z.string().optional()
});

export const SignedTxSchemaV2 = BaseArtifactSchema.extend({
  schema: z.literal("hardkas.signedTx.v2"),
  status: z.literal("signed"),
  signedId: z.string(),
  sourcePlanId: z.string(),
  networkId: z.string(),
  mode: z.enum(["real", "simulated"]),
  from: z.object({ address: z.string() }),
  to: z.object({ address: z.string() }),
  amountSompi: z.string(),
  signedTransaction: z.object({
    format: z.string(),
    payload: z.string()
  }),
  txId: z.string().optional()
});

export const TxTraceSchemaV2 = BaseArtifactSchema.extend({
  schema: z.literal("hardkas.txTrace.v2"),
  txId: z.string(),
  steps: z.array(z.object({
    phase: z.string(),
    status: z.string(),
    timestamp: z.string().datetime(),
    details: z.any().optional()
  }))
});

export type TxPlanV2 = z.infer<typeof TxPlanSchemaV2>;
export type SnapshotV2 = z.infer<typeof SnapshotSchemaV2>;
export type TxReceiptV2 = z.infer<typeof TxReceiptSchemaV2>;
export type SignedTxV2 = z.infer<typeof SignedTxSchemaV2>;
export type TxTraceV2 = z.infer<typeof TxTraceSchemaV2>;
