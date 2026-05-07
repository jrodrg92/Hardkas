import { KaspaNetworkId } from "@hardkas/core";
import { 
  KaspaRpcClient, 
  KaspaNodeInfo, 
  KaspaRpcHealth, 
  KaspaAddressBalance, 
  KaspaRpcUtxo, 
  KaspaSubmitTransactionResult, 
  MempoolEntry, 
  BlockDagInfo, 
  ServerInfo,
  mapKaspaNodeInfo,
  mapKaspaAddressBalance,
  mapKaspaRpcUtxos
} from "./index.js";

export const RPC_METHODS = {
  GET_SERVER_INFO: "getServerInfo",
  GET_BLOCK_DAG_INFO: "getBlockDagInfo",
  GET_UTXOS_BY_ADDRESSES: "getUtxosByAddresses",
  GET_MEMPOOL_ENTRY: "getMempoolEntry",
  SUBMIT_TRANSACTION: "submitTransaction",
  GET_INFO: "getInfo"
} as const;

export type RpcFetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface KaspaJsonRpcClientOptions {
  readonly url?: string;
  readonly timeoutMs?: number;
  readonly fetcher?: RpcFetcher;
}

export class KaspaJsonRpcClient implements KaspaRpcClient {
  private readonly url: string;
  private readonly timeoutMs: number;
  private readonly fetcher: RpcFetcher;
  private requestId = 1;

  constructor(options?: KaspaJsonRpcClientOptions) {
    this.url = options?.url || "http://127.0.0.1:18210";
    this.timeoutMs = options?.timeoutMs || 10000;
    this.fetcher = options?.fetcher || (globalThis.fetch.bind(globalThis) as RpcFetcher);
  }

  async getInfo(): Promise<KaspaNodeInfo> {
    const result = await this.callRpc(RPC_METHODS.GET_INFO);
    return mapKaspaNodeInfo(result);
  }

  async healthCheck(): Promise<KaspaRpcHealth> {
    try {
      const info = await this.getInfo();
      return { reachable: true, rpcUrl: this.url, info };
    } catch (error) {
      return {
        reachable: false,
        rpcUrl: this.url,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getBalanceByAddress(address: string): Promise<KaspaAddressBalance> {
    // In JSON-RPC, we usually get UTXOs and sum them, or use a specific method if available.
    // kaspad often provides getBalanceByAddressRequest in gRPC, but in JSON-RPC it might vary.
    // We'll try to get UTXOs as a fallback if getBalance fails.
    try {
      const result = await this.callRpc("getBalanceByAddress", { address });
      return mapKaspaAddressBalance(result, address);
    } catch (e) {
      const utxos = await this.getUtxosByAddress(address);
      const balanceSompi = utxos.reduce((acc, u) => acc + u.amountSompi, 0n);
      return { address, balanceSompi };
    }
  }

  async getUtxosByAddress(address: string): Promise<KaspaRpcUtxo[]> {
    const result = await this.callRpc(RPC_METHODS.GET_UTXOS_BY_ADDRESSES, { addresses: [address] });
    return mapKaspaRpcUtxos(result, address);
  }

  async submitTransaction(_rawTransaction: string): Promise<KaspaSubmitTransactionResult> {
    throw new Error("Real submitTransaction is not exposed by HardKAS yet.");
  }

  async getMempoolEntry(txId: string): Promise<MempoolEntry | null> {
    try {
      const result = await this.callRpc(RPC_METHODS.GET_MEMPOOL_ENTRY, { txId, includeOrphanPool: true });
      if (!result) return null;
      return {
        txId: (result as any).transactionId || txId,
        acceptedAt: (result as any).timestamp
      };
    } catch (e) {
      return null;
    }
  }

  async getBlockDagInfo(): Promise<BlockDagInfo> {
    const result = await this.callRpc(RPC_METHODS.GET_BLOCK_DAG_INFO);
    const data = result as any;
    return {
      networkId: data.networkId as KaspaNetworkId,
      virtualDaaScore: data.virtualDaaScore !== undefined ? BigInt(data.virtualDaaScore) : undefined,
      tipHashes: data.tipHashes
    };
  }

  async getServerInfo(): Promise<ServerInfo> {
    const result = await this.callRpc(RPC_METHODS.GET_SERVER_INFO);
    const data = result as any;
    return {
      networkId: data.networkId as KaspaNetworkId,
      serverVersion: data.serverVersion,
      isSynced: data.isSynced
    };
  }

  async close(): Promise<void> {
    // HTTP client doesn't need to close persistent connections in this implementation
  }

  private async callRpc<T>(method: string, params: unknown = {}): Promise<T> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetcher(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: this.requestId++,
          method,
          params
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const body = await response.json();

      if (body.error) {
        const error = body.error;
        throw new Error(`JSON-RPC error ${error.code}: ${error.message}${error.data ? ` (${JSON.stringify(error.data)})` : ""}`);
      }

      return body.result as T;
    } finally {
      clearTimeout(id);
    }
  }
}
