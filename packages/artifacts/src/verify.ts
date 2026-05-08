import fs from "node:fs";
import { calculateContentHash } from "./canonical.js";
import { 
  SnapshotSchemaV2, 
  TxPlanSchemaV2, 
  TxReceiptSchemaV2, 
  TxTraceSchemaV2,
  SignedTxSchemaV2,
  ARTIFACT_V2_VERSION
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
 * Verifies an artifact's integrity.
 * Can take a raw object or a file path.
 */
export async function verifyArtifactIntegrity(artifactOrPath: any): Promise<ArtifactVerificationResult> {
  const result: ArtifactVerificationResult = {
    ok: false,
    errors: []
  };

  let artifact: any;

  try {
    // 1. Resolve Artifact Source
    if (typeof artifactOrPath === "string") {
      if (!fs.existsSync(artifactOrPath)) {
        result.errors.push(`File not found: ${artifactOrPath}`);
        return result;
      }
      const content = fs.readFileSync(artifactOrPath, "utf-8");
      artifact = JSON.parse(content);
    } else {
      artifact = artifactOrPath;
    }

    // console.log("Verifying artifact:", artifact.schema, artifact.version);

    result.artifactType = artifact.schema;
    result.version = artifact.version;
    result.expectedHash = artifact.contentHash;

    // 2. Basic Version & Schema Check
    if (!artifact.version || !artifact.schema) {
      result.errors.push("Missing version or schema (Artifact might be v1 or legacy)");
      return result;
    }

    // Version Compatibility (reject if major version is different)
    const [currentMajor] = ARTIFACT_V2_VERSION.split(".");
    const [artifactMajor] = artifact.version.split(".");
    if (currentMajor !== artifactMajor) {
      result.errors.push(`Incompatible version: current system is v${currentMajor}, artifact is v${artifactMajor}`);
      return result;
    }

    // 3. Hash Verification
    // We hash the PARSED object, so CRLF/LF in the original file doesn't matter.
    // We must ensure the object doesn't contain path-dependent metadata in fields included in hash.
    const actualHash = calculateContentHash(artifact);
    result.actualHash = actualHash;

    if (!artifact.contentHash) {
      result.errors.push("Missing contentHash field");
    } else if (actualHash !== artifact.contentHash) {
      result.errors.push(`Hash mismatch: expected ${artifact.contentHash}, got ${actualHash}`);
    }

    // 4. Zod Schema Validation
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
      result.errors.push(`Unsupported or unknown artifact schema: ${artifact.schema}`);
    }

    result.ok = result.errors.length === 0;
    return result;

  } catch (e: any) {
    result.errors.push(`Integrity verification error: ${e.message}`);
    return result;
  }
}

/**
 * @deprecated Use verifyArtifactIntegrity instead.
 */
export const verifyArtifact = verifyArtifactIntegrity;
export const verifyArtifactFile = verifyArtifactIntegrity;
