import fs from "node:fs";
import { calculateContentHash } from "./canonical.js";
import { 
  SnapshotSchemaV2, 
  TxPlanSchemaV2, 
  TxReceiptSchemaV2, 
  TxTraceSchemaV2 
} from "./schemas.js";

export type ArtifactVerificationResult = {
  ok: boolean;
  artifactType?: string;
  version?: string;
  expectedHash?: string;
  actualHash?: string;
  errors: string[];
};

/**
 * Sorts UTXOs deterministically by outpoint (transactionId:index).
 */
export function sortUtxosByOutpoint(utxos: any[]): any[] {
  return [...utxos].sort((a, b) => {
    const aId = a.id || `${a.outpoint.transactionId}:${a.outpoint.index}`;
    const bId = b.id || `${b.outpoint.transactionId}:${b.outpoint.index}`;
    return aId.localeCompare(bId);
  });
}

/**
 * Verifies an artifact's integrity and schema.
 */
export async function verifyArtifact(filePath: string): Promise<ArtifactVerificationResult> {
  const result: ArtifactVerificationResult = {
    ok: false,
    errors: []
  };

  try {
    if (!fs.existsSync(filePath)) {
      result.errors.push(`File not found: ${filePath}`);
      return result;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const artifact = JSON.parse(content);

    result.artifactType = artifact.schema;
    result.version = artifact.version;
    result.expectedHash = artifact.contentHash;

    // 1. Basic Version Check
    if (!artifact.version || !artifact.schema) {
      result.errors.push("Missing version or schema (Artifact might be v1)");
      return result;
    }

    // 2. Schema Specific Pre-processing (e.g., sort UTXOs for snapshots)
    let processedArtifact = artifact;
    if (artifact.schema === "hardkas.snapshot.v2" && artifact.utxos) {
      processedArtifact = {
        ...artifact,
        utxos: sortUtxosByOutpoint(artifact.utxos)
      };
    }

    // 3. Hash Verification
    const actualHash = calculateContentHash(processedArtifact);
    result.actualHash = actualHash;

    if (!artifact.contentHash) {
      result.errors.push("Missing contentHash field");
    } else if (actualHash !== artifact.contentHash) {
      result.errors.push("Hash mismatch: Data has been modified");
    }

    // 4. Zod Schema Validation
    let schema;
    switch (artifact.schema) {
      case "hardkas.snapshot.v2": schema = SnapshotSchemaV2; break;
      case "hardkas.txPlan.v2": schema = TxPlanSchemaV2; break;
      case "hardkas.txReceipt.v2": schema = TxReceiptSchemaV2; break;
      case "hardkas.txTrace.v2": schema = TxTraceSchemaV2; break;
    }

    if (schema) {
      const validation = schema.safeParse(artifact);
      if (!validation.success) {
        result.errors.push(...validation.error.issues.map((e: any) => `${e.path.join(".")}: ${e.message}`));
      }
    } else {
      result.errors.push(`Unknown artifact schema: ${artifact.schema}`);
    }

    result.ok = result.errors.length === 0;
    return result;

  } catch (e: any) {
    result.errors.push(`Verification error: ${e.message}`);
    return result;
  }
}
