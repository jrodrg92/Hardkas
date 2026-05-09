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
 * Verifies an artifact's semantic and economic validity.
 */
export function verifyArtifactSemantics(artifact: any, options: { strict?: boolean } = {}): ArtifactVerificationResult {
  const result: ArtifactVerificationResult = {
    ok: true,
    errors: [],
    issues: []
  };

  const addIssue = (issue: VerificationIssue) => {
    if (issue.severity === "error" || issue.severity === "critical") result.ok = false;
    result.issues.push(issue);
    if (issue.severity === "error" || issue.severity === "critical") result.errors.push(issue.message);
  };

  // 1. Fee & Economic Audit
  const feeAudit = verifyFeeSemantics(artifact);
  if (!feeAudit.ok) {
    feeAudit.issues.forEach(msg => {
      addIssue({
        code: "ECONOMIC_VIOLATION",
        severity: options.strict ? "error" : "warning",
        message: msg
      });
    });
  }

  // 2. Staleness Check
  if (artifact.createdAt) {
    const created = new Date(artifact.createdAt).getTime();
    const now = Date.now();
    const ageHours = (now - created) / (1000 * 60 * 60);

    if (ageHours > 24 * 30) {
      addIssue({
        code: "STALE_ARTIFACT",
        severity: "error",
        message: `Artifact is too old (${Math.round(ageHours / 24)} days). High risk of DAA divergence.`
      });
    } else if (ageHours > 24) {
      addIssue({
        code: "STALE_ARTIFACT",
        severity: "warning",
        message: `Artifact is over 24h old. May be stale.`
      });
    }
  }

  // 2. Lineage Audit
  const lineageAudit = verifyLineage(artifact, (options as any).parent);
  if (!lineageAudit.ok || (options.strict && !artifact.lineage)) {
    if (!artifact.lineage && options.strict) {
      addIssue({
        code: "MISSING_LINEAGE",
        severity: "error",
        message: "Strict mode requires formal lineage metadata."
      });
    }
    
    lineageAudit.issues.forEach(issue => {
      addIssue({
        ...issue,
        severity: options.strict ? "error" : "warning"
      });
    });
  }

  // 3. Mode Integrity
  if (artifact.schema === "hardkas.signedTx.v2" && artifact.mode === "simulated") {
    // A simulated artifact should not have real signatures (placeholder check)
    if (artifact.signedTransaction?.format === "hex") {
       // This is just a conceptual rail for now
    }
  }

  // 4. Advanced Lineage/Network Internal Checks
  if (artifact.lineage) {
    const { artifactId, parentArtifactId, rootArtifactId } = artifact.lineage;
    
    if (artifactId === parentArtifactId) {
      addIssue({
        code: "LINEAGE_INCONSISTENCY",
        severity: "error",
        message: "Artifact cannot be its own parent."
      });
    }

    if (!parentArtifactId && artifactId !== rootArtifactId) {
       addIssue({
         code: "LINEAGE_INCONSISTENCY",
         severity: "error",
         message: "Root artifactId must match artifactId when no parent exists."
       });
    }
  }

  // 5. Network vs Address prefix check
  if (artifact.networkId && (artifact.from?.address || artifact.to?.address)) {
    const addr = artifact.from?.address || artifact.to?.address;
    const expectedPrefix = artifact.networkId === "mainnet" ? "kaspa:" : 
                           artifact.networkId === "testnet" ? "kaspatest:" : "kaspasim:";
    
    if (!addr.startsWith(expectedPrefix)) {
       addIssue({
         code: "LINEAGE_INCONSISTENCY",
         severity: "error",
         message: `Network/Address mismatch: network is ${artifact.networkId} but address is ${addr}`
       });
    }
  }

  return result;
}

import { verifyFeeSemantics } from "./feeVerify.js";
import { verifyLineage } from "./lineage.js";

/**
 * @deprecated Use verifyArtifactIntegrity instead.
 */
export const verifyArtifact = verifyArtifactIntegrity;
export const verifyArtifactFile = verifyArtifactIntegrity;
