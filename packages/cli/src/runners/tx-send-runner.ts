import { 
  getBroadcastableSignedTransaction, 
  SignedTxArtifact 
} from "@hardkas/artifacts";
import { 
  resolveNetworkTarget, 
  HardkasConfig 
} from "@hardkas/config";
import { 
  JsonWrpcKaspaClient, 
  KaspaSubmitTransactionResult 
} from "@hardkas/kaspa-rpc";
import { 
  loadOrCreateLocalnetState, 
  saveLocalnetState, 
  applySimulatedPayment,
  saveSimulatedReceipt,
  saveSimulatedTrace,
  StoredTraceEvent
} from "@hardkas/localnet";
import { parseKasToSompi } from "@hardkas/core";
import { assertBroadcastNetworkAllowed } from "../broadcast-guard.js";

export interface TxSendRunnerInput {
  signedArtifact: SignedTxArtifact;
  network?: string;
  config: HardkasConfig;
  url?: string;
  allowMainnetBroadcast?: boolean;
}

export interface TxSendRunnerResult {
  accepted: boolean;
  transactionId?: string;
  rpcUrl: string;
  networkName: string;
  rawResponse?: any;
}

/**
 * Reusable logic for transaction broadcasting.
 */
export async function runTxSend(input: TxSendRunnerInput): Promise<TxSendRunnerResult> {
  const { signedArtifact, network, config, url, allowMainnetBroadcast } = input;
  
  const broadcastable = getBroadcastableSignedTransaction(signedArtifact);
  const networkName = network || broadcastable.network;
  const { name: resolvedName, target } = resolveNetworkTarget({ network: networkName, config });

  // Security Guards
  if (target.kind === "simulated") {
    // Phase 12: Simulated state mutation
    const state = await loadOrCreateLocalnetState();
    
    // Phase 13: Tracing initialization
    const startTime = Date.now();
    const events: StoredTraceEvent[] = [
      { type: "phase.started", phase: "resolve-account", timestamp: startTime },
      { type: "phase.completed", phase: "resolve-account", timestamp: Date.now() },
      { type: "phase.started", phase: "resolve-utxos", timestamp: Date.now() },
      { type: "phase.completed", phase: "resolve-utxos", timestamp: Date.now() },
      { type: "phase.started", phase: "select-utxos", timestamp: Date.now() },
      { type: "phase.completed", phase: "select-utxos", timestamp: Date.now() },
      { type: "phase.started", phase: "estimate-mass", timestamp: Date.now() },
      { type: "phase.completed", phase: "estimate-mass", timestamp: Date.now() },
      { type: "phase.started", phase: "estimate-fee", timestamp: Date.now() },
      { type: "phase.completed", phase: "estimate-fee", timestamp: Date.now() },
      { type: "phase.started", phase: "build", timestamp: Date.now() },
      { type: "phase.completed", phase: "build", timestamp: Date.now() },
      { type: "phase.started", phase: "send", timestamp: Date.now() },
    ];

    // We use the information from the artifact to apply the payment
    const result = applySimulatedPayment(state, {
      from: signedArtifact.from.input || signedArtifact.from.address,
      to: signedArtifact.to.input || signedArtifact.to.address,
      amountSompi: BigInt(signedArtifact.amountSompi),
    });

    events.push({ type: "phase.completed", phase: "send", timestamp: Date.now() });
    events.push({ type: "phase.started", phase: "apply-state", timestamp: Date.now() });
    
    await saveLocalnetState(result.state);
    
    events.push({ type: "phase.completed", phase: "apply-state", timestamp: Date.now() });
    events.push({ type: "phase.started", phase: "save-receipt", timestamp: Date.now() });

    const receiptPath = await saveSimulatedReceipt(result.receipt);
    
    events.push({ type: "phase.completed", phase: "save-receipt", timestamp: Date.now() });
    events.push({ type: "phase.started", phase: "save-trace", timestamp: Date.now() });

    const tracePath = await saveSimulatedTrace({
      txId: result.receipt.txId,
      mode: "simulated",
      networkId: "simnet",
      createdAt: result.receipt.createdAt,
      events,
      receiptPath
    });

    events.push({ type: "phase.completed", phase: "save-trace", timestamp: Date.now() });

    return {
      accepted: true,
      transactionId: result.receipt.txId,
      rpcUrl: "simulated://local",
      networkName: resolvedName,
      rawResponse: {
        ...result.receipt,
        receiptPath,
        tracePath
      }
    };
  }

  if (target.kind === "igra") {
    throw new Error(`Network '${networkName}' targets Igra L2. Use future Igra commands, not Kaspa L1 tx send.`);
  }

  assertBroadcastNetworkAllowed({
    artifactNetwork: broadcastable.network,
    selectedNetwork: networkName,
    allowMainnet: allowMainnetBroadcast
  });

  const rpcUrl = url || target.rpcUrl;
  if (!rpcUrl) {
    throw new Error(`No RPC URL found for network '${networkName}'.`);
  }

  const client = new JsonWrpcKaspaClient({ rpcUrl });
  try {
    const result = await client.submitTransaction(broadcastable.rawTransaction);
    return {
      accepted: !!result.accepted,
      transactionId: result.transactionId,
      rpcUrl,
      networkName,
      rawResponse: result.raw
    };
  } finally {
    await client.close();
  }
}
