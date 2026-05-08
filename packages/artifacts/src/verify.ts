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

export type VerificationSeverity = "info" | "warning" | "error" | "critical";

export type VerificationIssue = {
  code: string;
  severity: VerificationSeverity;
  message: string;
  path?: string | undefined;
  artifactId?: string | undefined;
};

export type ArtifactVerificationResult = {
  ok: boolean;
  artifactType?: string;
  version?: string;
  expectedHash?: string;
  actualHash?: string;
  errors: string[]; // Legacy support
  issues: VerificationIssue[];
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
    errors: [],
    issues: []
  };

  const addError = (code: string, message: string, path?: string) => {
    result.errors.push(message);
    result.issues.push({ code, severity: "error", message, path });
  };

  let artifact: any;

  try {
    // 1. Resolve Artifact Source
    if (typeof artifactOrPath === "string") {
      if (!fs.existsSync(artifactOrPath)) {
        addError("FILE_NOT_FOUND", `File not found: ${artifactOrPath}`);
        return result;
      }
      const content = fs.readFileSync(artifactOrPath, "utf-8");
      artifact = JSON.parse(content);
    } else {
      artifact = artifactOrPath;
    }

    result.artifactType = artifact.schema;
    result.version = artifact.version;
    result.expectedHash = artifact.contentHash;

    // 2. Basic Version & Schema Check
    if (!artifact.version || !artifact.schema) {
      addError("MISSING_METADATA", "Missing version or schema (Artifact might be v1 or legacy)");
      return result;
    }

    // Version Compatibility (reject if major version is different)
    const [currentMajor] = ARTIFACT_V2_VERSION.split(".");
    const [artifactMajor] = artifact.version.split(".");
    if (currentMajor !== artifactMajor) {
      addError("INCOMPATIBLE_VERSION", `Incompatible version: current system is v${currentMajor}, artifact is v${artifactMajor}`);
      return result;
    }

    // 3. Hash Verification
    const actualHash = calculateContentHash(artifact);
    result.actualHash = actualHash;

    if (!artifact.contentHash) {
      addError("MISSING_HASH", "Missing contentHash field");
    } else if (actualHash !== artifact.contentHash) {
      addError("HASH_MISMATCH", `Hash mismatch: expected ${artifact.contentHash}, got ${actualHash}`);
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
        validation.error.issues.forEach((e: any) => {
          const pathStr = e.path.join(".");
          addError("SCHEMA_VALIDATION_ERROR", `${pathStr}: ${e.message}`, pathStr);
        });
      }
    } else {
      addError("UNSUPPORTED_SCHEMA", `Unsupported or unknown artifact schema: ${artifact.schema}`);
    }

    result.ok = result.issues.every(i => i.severity !== "error" && i.severity !== "critical");
    return result;

  } catch (e: any) {
    addError("UNEXPECTED_ERROR", `Integrity verification error: ${e.message}`);
    return result;
  }
}

/**
 * @deprecated Use verifyArtifactIntegrity instead.
 */
export const verifyArtifact = verifyArtifactIntegrity;
export const verifyArtifactFile = verifyArtifactIntegrity;
