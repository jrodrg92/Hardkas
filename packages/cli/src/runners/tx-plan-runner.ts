import { 
  parseKasToSompi 
} from "@hardkas/core";
import {
  resolveAccountAddress
} from "@hardkas/accounts";
import { 
  buildPaymentPlan, 
  createMockUtxo 
} from "@hardkas/tx-builder";
import { 
  createTxPlanArtifact, 
  TxPlanArtifact 
} from "@hardkas/artifacts";
import { 
  resolveNetworkTarget, 
  HardkasConfig 
} from "@hardkas/config";

export interface TxPlanRunnerInput {
  from: string;
  to: string;
  amount: string;
  network: string;
  feeRate: string;
  config: HardkasConfig;
  url?: string;
}

/**
 * Reusable logic for transaction planning.
 */
export async function runTxPlan(input: TxPlanRunnerInput): Promise<TxPlanArtifact> {
  const { from, to, amount, network, feeRate, config, url } = input;
  
  const fromAddress = resolveAccountAddress(from, config);
  const toAddress = resolveAccountAddress(to, config);
  const amountSompi = parseKasToSompi(amount);
  const feeRateSompiPerMass = BigInt(feeRate);

  let availableUtxos: any[] = [];
  let mode: "simulated" | "kaspa-node" | "kaspa-rpc" = "simulated";
  let rpcUrl: string | undefined;
  let resolvedNetwork = network;

  try {
    const { target, name } = resolveNetworkTarget({ config, network });
    resolvedNetwork = name;

    if (target.kind === "simulated") {
      const { createDeterministicAccounts } = await import("@hardkas/localnet");
      const detAccounts = createDeterministicAccounts();
      const det = detAccounts.find(a => a.address === fromAddress);
      if (det) {
        availableUtxos = [createMockUtxo({ address: det.address, amountSompi: det.balanceSompi, index: 0 })];
      }
      mode = "simulated";
    } else if (target.kind === "kaspa-node" || target.kind === "kaspa-rpc") {
      const { JsonWrpcKaspaClient } = await import("@hardkas/kaspa-rpc");
      const { resolveRuntimeConfig } = await import("@hardkas/node-orchestrator");
      
      rpcUrl = url || target.rpcUrl;
      if (!rpcUrl && target.kind === "kaspa-node") {
        rpcUrl = resolveRuntimeConfig({ network: target.network, dataDir: target.dataDir }).rpcUrl;
      }

      if (!rpcUrl) throw new Error("Could not resolve RPC URL");

      const client = new JsonWrpcKaspaClient({ rpcUrl });
      const rpcUtxos = await client.getUtxosByAddress(fromAddress);
      await client.close();
      
      availableUtxos = rpcUtxos.map(u => ({
        outpoint: u.outpoint,
        address: u.address,
        amountSompi: u.amountSompi,
        scriptPublicKey: u.scriptPublicKey || "unresolved"
      }));
      mode = target.kind;
    }
  } catch (e) {
    if (url || network !== "simnet") {
      const { JsonWrpcKaspaClient } = await import("@hardkas/kaspa-rpc");
      const { resolveRuntimeConfig } = await import("@hardkas/node-orchestrator");
      rpcUrl = url;
      if (!rpcUrl) {
        rpcUrl = resolveRuntimeConfig({ network: network as any }).rpcUrl;
      }
      const client = new JsonWrpcKaspaClient({ rpcUrl });
      const rpcUtxos = await client.getUtxosByAddress(fromAddress);
      await client.close();
      
      availableUtxos = rpcUtxos.map(u => ({
        outpoint: u.outpoint,
        address: u.address,
        amountSompi: u.amountSompi,
        scriptPublicKey: u.scriptPublicKey || "unresolved"
      }));
      mode = "kaspa-rpc";
    } else {
      throw e;
    }
  }

  if (availableUtxos.length === 0) {
    throw new Error(`No UTXOs found for ${fromAddress} on network '${resolvedNetwork}'.`);
  }

  const plan = buildPaymentPlan({
    fromAddress,
    outputs: [{ address: toAddress, amountSompi }],
    availableUtxos,
    feeRateSompiPerMass
  });

  const artifact = createTxPlanArtifact({
    network: resolvedNetwork,
    mode,
    rpcUrl,
    from: { input: from, address: fromAddress },
    to: { input: to, address: toAddress },
    amountSompi,
    plan
  });

  return artifact;
}
