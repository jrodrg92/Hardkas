import { z } from "zod";
import { kaspaNetworkIdSchema, executionModeSchema, artifactTypeSchema } from "@hardkas/core";

export const ARTIFACT_V2_VERSION = "2.0.0";

export const ArtifactLineageSchema = z.object({
  artifactId: z.string(),
  lineageId: z.string(),
  parentArtifactId: z.string().optional(),
  rootArtifactId: z.string(),
  sequence: z.number().optional()
});

export const BaseArtifactSchema = z.object({
  schema: z.string(),
  hardkasVersion: z.string(),
  version: z.literal(ARTIFACT_V2_VERSION),
  networkId: kaspaNetworkIdSchema,
  mode: executionModeSchema,
  contentHash: z.string().optional(),
  createdAt: z.string().datetime(),
  lineage: ArtifactLineageSchema.optional()
});

export const AccountRefSchema = z.object({
  address: z.string(),
  accountName: z.string().optional(),
  input: z.string().optional()
});

export const TxPlanSchemaV2 = BaseArtifactSchema.extend({
  schema: z.literal("hardkas.txPlan.v2"),
  networkId: kaspaNetworkIdSchema,
  mode: executionModeSchema,
  planId: z.string(),
  from: AccountRefSchema,
  to: AccountRefSchema,
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
  })),
  change: z.object({
    address: z.string(),
    amountSompi: z.string()
  }).optional(),
  rpcUrl: z.string().optional()
});

export const DagContextSchema = z.object({
  mode: z.enum(["linear", "dag-light"]),
  sink: z.string(),
  selectedParent: z.string().optional(),
  branchId: z.string().optional(),
  acceptedTxIds: z.array(z.string()).optional(),
  displacedTxIds: z.array(z.string()).optional(),
  conflictSet: z.array(z.object({
    outpoint: z.string(),
    winnerTxId: z.string(),
    loserTxIds: z.array(z.string())
  })).optional(),
  nonSelectedContext: z.boolean().optional()
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
  status: z.enum(["pending", "submitted", "accepted", "confirmed", "failed"]),
  mode: executionModeSchema,
  networkId: kaspaNetworkIdSchema,
  from: AccountRefSchema,
  to: AccountRefSchema,
  amountSompi: z.string(),
  feeSompi: z.string(),
  mass: z.string().optional(),
  changeSompi: z.string().optional(),
  spentUtxoIds: z.array(z.string()).optional(),
  createdUtxoIds: z.array(z.string()).optional(),
  daaScore: z.string().optional(),
  preStateHash: z.string().optional(),
  postStateHash: z.string().optional(),
  submittedAt: z.string().optional(),
  confirmedAt: z.string().optional(),
  dagContext: DagContextSchema.optional(),
  tracePath: z.string().optional(),
  rpcUrl: z.string().optional(),
  sourceSignedId: z.string().optional(),
  metadata: z.any().optional()
});

export const SignedTxSchemaV2 = BaseArtifactSchema.extend({
  schema: z.literal("hardkas.signedTx.v2"),
  status: z.literal("signed"),
  signedId: z.string(),
  sourcePlanId: z.string(),
  networkId: kaspaNetworkIdSchema,
  mode: executionModeSchema,
  from: AccountRefSchema,
  to: AccountRefSchema,
  amountSompi: z.string(),
  signedTransaction: z.object({
    format: z.string(),
    payload: z.string()
  }),
  txId: z.string().optional(),
  metadata: z.any().optional()
});

export const TxTraceSchemaV2 = BaseArtifactSchema.extend({
  schema: z.literal("hardkas.txTrace.v2"),
  txId: z.string(),
  networkId: kaspaNetworkIdSchema,
  mode: executionModeSchema,
  steps: z.array(z.object({
    phase: z.string(),
    status: z.string(),
    timestamp: z.string().datetime(),
    details: z.any().optional()
  })),
  dagContext: DagContextSchema.optional()
});

export type TxPlanV2 = z.infer<typeof TxPlanSchemaV2>;
export type SnapshotV2 = z.infer<typeof SnapshotSchemaV2>;
export type TxReceiptV2 = z.infer<typeof TxReceiptSchemaV2>;
export type SignedTxV2 = z.infer<typeof SignedTxSchemaV2>;
export type TxTraceV2 = z.infer<typeof TxTraceSchemaV2>;
export type DagContext = z.infer<typeof DagContextSchema>;
