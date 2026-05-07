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
  const target = resolveNetworkTarget({ name: networkName, config });

  // Security Guards
  if (target.kind === "simulated") {
    throw new Error(`Network '${networkName}' is simulated and cannot broadcast real Kaspa transactions.`);
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
