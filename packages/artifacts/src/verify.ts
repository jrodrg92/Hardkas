import fs from "node:fs";
import { calculateContentHash } from "./canonical.js";
import { 
  SnapshotSchemaV2, 
  TxPlanSchemaV2, 
  TxReceiptSchemaV2, 
  TxTraceSchemaV2,
  SignedTxSchemaV2
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
    const aId = a.id || (a.outpoint ? `${a.outpoint.transactionId}:${a.outpoint.index}` : "");
    const bId = b.id || (b.outpoint ? `${b.outpoint.transactionId}:${b.outpoint.index}` : "");
    return aId.localeCompare(bId);
  });
}

/**
 * Verifies an artifact object's integrity.
 */
export function verifyArtifactIntegrity(artifact: any): ArtifactVerificationResult {
  const result: ArtifactVerificationResult = {
    ok: false,
    errors: []
  };

  try {
    result.artifactType = artifact.schema;
    result.version = artifact.version;
    result.expectedHash = artifact.contentHash;

    if (!artifact.version || !artifact.schema) {
      result.errors.push("Missing version or schema (Artifact might be v1)");
      return result;
    }

    // Schema Specific Pre-processing
    let processedArtifact = artifact;
    if (artifact.schema === "hardkas.snapshot.v2" && artifact.utxos) {
      processedArtifact = {
        ...artifact,
        utxos: sortUtxosByOutpoint(artifact.utxos)
      };
    }

    const actualHash = calculateContentHash(processedArtifact);
    result.actualHash = actualHash;

    if (!artifact.contentHash) {
      result.errors.push("Missing contentHash field");
    } else if (actualHash !== artifact.contentHash) {
      result.errors.push(`Hash mismatch: expected ${artifact.contentHash}, got ${actualHash}`);
    }

    // Schema Validation
    let schema;
    switch (artifact.schema) {
      case "hardkas.snapshot.v2": schema = SnapshotSchemaV2; break;
      case "hardkas.txPlan.v2": schema = TxPlanSchemaV2; break;
      case "hardkas.txReceipt.v2": schema = TxReceiptSchemaV2; break;
      case "hardkas.txTrace.v2": schema = TxTraceSchemaV2; break;
      case "hardkas.signedTx.v2": schema = SignedTxSchemaV2; break;
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
    result.errors.push(`Integrity verification failed: ${e.message}`);
    return result;
  }
}

/**
 * Verifies an artifact file's integrity and schema.
 */
export async function verifyArtifactFile(filePath: string): Promise<ArtifactVerificationResult> {
  try {
    if (!fs.existsSync(filePath)) {
      return { ok: false, errors: [`File not found: ${filePath}`] };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const artifact = JSON.parse(content);
    return verifyArtifactIntegrity(artifact);
  } catch (e: any) {
    return { ok: false, errors: [`Failed to read or parse artifact file: ${e.message}`] };
  }
}

/**
 * @deprecated Use verifyArtifactFile instead.
 */
export const verifyArtifact = verifyArtifactFile;
