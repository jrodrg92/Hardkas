import fs from "node:fs/promises";
import path from "node:path";
import { 
  loadRealAccountStore, 
  resolveRealAccountOrAddress 
} from "@hardkas/localnet";
import { JsonWrpcKaspaClient } from "@hardkas/kaspa-rpc";
import { parseKasToSompi, formatSompi } from "@hardkas/core";
import { buildPaymentPlan, Utxo } from "@hardkas/tx-builder";
import { 
  RealTxPlanArtifact, 
  utxoToArtifact, 
  txOutputToArtifact, 
  assertValidRealTxPlanArtifact,
  writeArtifact,
  HARDKAS_VERSION,
  ARTIFACT_SCHEMAS
} from "@hardkas/artifacts";

export interface TxRealBuildOptions {
  from: string;
  to: string;
  amount: string;
  feeRate?: string;
  url?: string;
  outDir?: string;
}

export interface TxRealBuildResult {
  planId: string;
  artifactPath: string;
  artifact: RealTxPlanArtifact;
  formatted: string;
}

export async function runTxRealBuild(options: TxRealBuildOptions): Promise<TxRealBuildResult> {
  // 1. Resolve 'from' account/address
  const store = await loadRealAccountStore();
  const { address: fromAddress, name: accountName } = resolveRealAccountOrAddress(store, options.from);

  // 2. Setup RPC client
  const rpcUrl = options.url || "http://127.0.0.1:18210";
  const client = new JsonWrpcKaspaClient({ rpcUrl });

  try {
    // 3. Fetch data from node
    const info = await client.getInfo();
    const networkId = info.networkId || "simnet";
    const rpcUtxos = await client.getUtxosByAddress(fromAddress);

    // Convert RPC UTXOs to domain UTXOs
    const domainUtxos: Utxo[] = rpcUtxos.map(u => ({
      outpoint: u.outpoint,
      address: u.address,
      amountSompi: u.amountSompi,
      scriptPublicKey: u.scriptPublicKey || "",
      blockDaaScore: u.blockDaaScore ? BigInt(u.blockDaaScore) : undefined,
      isCoinbase: u.isCoinbase
    }));

    // 4. Build plan
    const amountSompi = parseKasToSompi(options.amount);
    const feeRate = BigInt(options.feeRate || "1");

    const txPlan = buildPaymentPlan({
      fromAddress,
      outputs: [{ address: options.to, amountSompi }],
      availableUtxos: domainUtxos,
      feeRateSompiPerMass: feeRate
    });

    // 5. Create Artifact
    const planId = `realplan_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    const artifact: RealTxPlanArtifact = {
      schema: ARTIFACT_SCHEMAS.REAL_TX_PLAN,
      hardkasVersion: HARDKAS_VERSION,
      status: "built",
      createdAt: new Date().toISOString(),
      planId,
      networkId,
      mode: "rpc",
      from: {
        address: fromAddress,
        accountName: accountName || undefined
      },
      to: {
        address: options.to
      },
      amountSompi: amountSompi.toString(),
      feeRateSompiPerMass: feeRate.toString(),
      selectedUtxos: txPlan.inputs.map(utxoToArtifact),
      outputs: txPlan.outputs.map(txOutputToArtifact),
      change: txPlan.change ? txOutputToArtifact(txPlan.change) : undefined,
      estimatedMass: txPlan.estimatedMass.toString(),
      estimatedFeeSompi: txPlan.estimatedFeeSompi.toString()
    };

    // 6. Validate and Save
    assertValidRealTxPlanArtifact(artifact);

    const outDir = options.outDir || "plans";
    // Basic path traversal protection
    const sanitizedDir = path.normalize(outDir).replace(/^(\.\.[\/\\])+/, "");
    await fs.mkdir(sanitizedDir, { recursive: true });

    const artifactPath = path.join(sanitizedDir, `${planId}.real.plan.json`);
    await writeArtifact(artifactPath, artifact);

    // 7. Format Output
    const lines = [
      "Real transaction plan built",
      "",
      `Plan ID:   ${planId}`,
      `Network:   ${networkId}`,
      `Mode:      rpc`,
      `From:      ${accountName ? `${accountName} ` : ""}${fromAddress}`,
      `To:        ${options.to}`,
      `Amount:    ${formatSompi(amountSompi)}`,
      `Fee rate:  ${feeRate} sompi/mass`,
      "",
      `Selected UTXOs: ${txPlan.inputs.length}`,
      `Estimated mass: ${txPlan.estimatedMass}`,
      `Estimated fee:  ${formatSompi(txPlan.estimatedFeeSompi)}`,
      `Change:         ${txPlan.change ? formatSompi(txPlan.change.amountSompi) : "none"}`,
      "",
      "Artifact:",
      `  ${artifactPath}`,
      "",
      "Next:",
      `  Sign this plan with an account:`,
      `    hardkas tx real sign ${artifactPath} --account ${options.from}`
    ];

    return {
      planId,
      artifactPath,
      artifact,
      formatted: lines.join("\n")
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ECONNREFUSED") || msg.includes("timed out")) {
      throw new Error(`RPC error: ${msg}\nSuggestion: hardkas rpc health --wait --timeout 60`);
    }
    throw e;
  } finally {
    await client.close();
  }
}
