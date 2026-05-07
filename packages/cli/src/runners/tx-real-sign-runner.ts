import fs from "node:fs/promises";
import path from "node:path";
import { 
  readArtifact, 
  assertValidRealTxPlanArtifact,
  RealSignedTxArtifact,
  assertValidRealSignedTxArtifact,
  writeArtifact 
} from "@hardkas/artifacts";
import { 
  loadRealAccountStore, 
  getRealDevAccount 
} from "@hardkas/localnet";
import { 
  RealTxSigner, 
  UnsupportedRealTxSigner,
  KaspaSdkRealTxSigner
} from "@hardkas/accounts";
import { formatSompi } from "@hardkas/core";

export interface TxRealSignOptions {
  planPath: string;
  accountName: string;
  outDir?: string;
  signer?: RealTxSigner;
}

export interface TxRealSignResult {
  signedId: string;
  artifactPath: string;
  artifact: RealSignedTxArtifact;
  formatted: string;
}

export async function runTxRealSign(options: TxRealSignOptions): Promise<TxRealSignResult> {
  // 1. Load and validate plan
  const planData = await readArtifact(options.planPath);
  assertValidRealTxPlanArtifact(planData);

  // 2. Load account
  const store = await loadRealAccountStore();
  const account = getRealDevAccount(store, options.accountName);

  if (!account) {
    throw new Error(`Real account '${options.accountName}' not found in store.`);
  }

  if (!account.privateKey) {
    throw new Error(`Real account '${options.accountName}' has no private key available for signing.`);
  }

  // 3. Guardrails
  if (planData.from.address !== account.address) {
    throw new Error(`Address mismatch: Plan requires ${planData.from.address}, but account ${account.name} has ${account.address}.`);
  }

  if (planData.networkId === "mainnet") {
    throw new Error("Signing for mainnet is currently blocked in this phase for safety.");
  }

  // 4. Sign
  const signer = options.signer || new KaspaSdkRealTxSigner();
  
  let signingResult;
  try {
    signingResult = await signer.sign({
      plan: planData,
      account
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("dependency is not installed")) {
      const error = new Error("Real transaction signing is not available");
      (error as any).reason = msg;
      (error as any).suggestion = "Install the official 'kaspa' package: pnpm add kaspa";
      throw error;
    }
    throw e;
  }

  // 5. Create Artifact
  const signedId = `signed_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  const artifact: RealSignedTxArtifact = {
    kind: "hardkas.realSignedTx",
    schema: "hardkas.realSignedTx",
    version: 1,
    status: "signed",
    mode: planData.mode,
    networkId: planData.networkId,
    createdAt: new Date().toISOString(),
    signedId,
    sourcePlanId: planData.planId,
    sourcePlanPath: options.planPath,
    from: {
      accountName: account.name,
      address: account.address
    },
    to: {
      address: planData.to.address
    },
    amountSompi: planData.amountSompi,
    feeSompi: planData.estimatedFeeSompi,
    changeSompi: planData.change?.amountSompi,
    selectedUtxos: planData.selectedUtxos,
    signedTransaction: signingResult.signedTransaction,
    txId: signingResult.txId
  };

  assertValidRealSignedTxArtifact(artifact);

  // 6. Save
  const outDir = options.outDir || "signed";
  const sanitizedDir = path.normalize(outDir).replace(/^(\.\.[\/\\])+/, "");
  await fs.mkdir(sanitizedDir, { recursive: true });

  const artifactPath = path.join(sanitizedDir, `${signedId}.real.signed.json`);
  await writeArtifact(artifactPath, artifact);

  // 7. Format Output
  const lines = [
    "Real transaction signed",
    "",
    `Signed ID: ${signedId}`,
    `Source:    ${options.planPath}`,
    `Network:   ${artifact.networkId}`,
    `From:      ${account.name} ${account.address}`,
    `To:        ${artifact.to.address}`,
    `Amount:    ${formatSompi(BigInt(artifact.amountSompi))}`,
    `Fee:       ${formatSompi(BigInt(artifact.feeSompi))}`,
    "",
    "Artifact:",
    `  ${artifactPath}`,
    "",
    "Next:",
    "  Real transaction submission is not implemented yet."
  ];

  return {
    signedId,
    artifactPath,
    artifact,
    formatted: lines.join("\n")
  };
}
