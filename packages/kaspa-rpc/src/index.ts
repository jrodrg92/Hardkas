import type { KaspaNetworkId } from "@hardkas/core";
import { WebSocket } from "ws";

export interface KaspaNodeInfo {
  serverVersion?: string;
  isSynced?: boolean;
  isUtxoIndexed?: boolean;
  p2pId?: string;
  mempoolSize?: number;
  virtualDaaScore?: number | string;
  networkId?: string;
  raw?: unknown;
}

export interface KaspaRpcHealth {
  reachable: boolean;
  rpcUrl: string;
  info?: KaspaNodeInfo;
  error?: string;
}

export interface KaspaAddressBalance {
  address: string;
  balanceSompi: bigint;
  raw?: unknown;
}

export interface KaspaRpcOutpoint {
  transactionId: string;
  index: number;
}

export interface KaspaRpcUtxo {
  outpoint: KaspaRpcOutpoint;
  address: string;
  amountSompi: bigint;
  scriptPublicKey?: string;
  blockDaaScore?: bigint | string;
  isCoinbase?: boolean;
  raw?: unknown;
}

export interface JsonWrpcKaspaClientOptions {
  rpcUrl: string;
  timeoutMs?: number;
}

export interface BlockDagInfo {
  readonly networkId: KaspaNetworkId;
  readonly virtualDaaScore?: bigint | undefined;
  readonly tipHashes?: readonly string[] | undefined;
}

export interface ServerInfo {
  readonly networkId: KaspaNetworkId;
  readonly serverVersion?: string | undefined;
  readonly isSynced?: boolean | undefined;
}

export interface MempoolEntry {
  readonly txId: string;
  readonly acceptedAt?: string | undefined;
}

export interface KaspaSubmitTransactionResult {
  transactionId?: string;
  accepted?: boolean;
  raw?: unknown;
}

export interface KaspaRpcClient {
  getInfo(): Promise<KaspaNodeInfo>;
  healthCheck(): Promise<KaspaRpcHealth>;
  getBalanceByAddress(address: string): Promise<KaspaAddressBalance>;
  getUtxosByAddress(address: string): Promise<KaspaRpcUtxo[]>;
  submitTransaction(rawTransaction: string): Promise<KaspaSubmitTransactionResult>;
  getMempoolEntry(txId: string): Promise<MempoolEntry | null>;
  getBlockDagInfo(): Promise<BlockDagInfo>;
  getServerInfo(): Promise<ServerInfo>;
  close(): void | Promise<void>;
}

export class JsonWrpcKaspaClient implements KaspaRpcClient {
  private socket: WebSocket | null = null;
  private readonly rpcUrl: string;
  private readonly timeoutMs: number;
  private requestId = 1;

  constructor(options: JsonWrpcKaspaClientOptions) {
    this.rpcUrl = options.rpcUrl;
    this.timeoutMs = options.timeoutMs ?? 3000;
  }

  async getInfo(): Promise<KaspaNodeInfo> {
    const response = await this.safeRequest(["getInfoRequest", "getInfo"]);
    return mapKaspaNodeInfo(response);
  }

  async healthCheck(): Promise<KaspaRpcHealth> {
    try {
      const info = await this.getInfo();
      return { reachable: true, rpcUrl: this.rpcUrl, info };
    } catch (error) {
      return {
        reachable: false,
        rpcUrl: this.rpcUrl,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getBalanceByAddress(address: string): Promise<KaspaAddressBalance> {
    const response = await this.safeRequest(
      ["getBalanceByAddressRequest", "getBalanceByAddress"],
      { address }
    );
    return mapKaspaAddressBalance(response, address);
  }

  async getUtxosByAddress(address: string): Promise<KaspaRpcUtxo[]> {
    const response = await this.safeRequest(
      ["getUtxosByAddressesRequest", "getUtxosByAddresses", "getUtxosByAddressRequest", "getUtxosByAddress"],
      { addresses: [address], address }
    );
    return mapKaspaRpcUtxos(response, address);
  }

  async submitTransaction(rawTransaction: string): Promise<KaspaSubmitTransactionResult> {
    // We try multiple payload formats for compatibility
    const response = await this.safeRequest(
      ["submitTransactionRequest", "submitTransaction"],
      { transaction: rawTransaction, transactionHex: rawTransaction, rawTransaction }
    );
    return mapKaspaSubmitTransactionResult(response);
  }

  async getMempoolEntry(_txId: string): Promise<MempoolEntry | null> {
    throw new Error("getMempoolEntry not implemented in Phase 6.");
  }

  async getBlockDagInfo(): Promise<BlockDagInfo> {
    const info = await this.getInfo();
    return {
      networkId: (info.networkId as KaspaNetworkId) || "unknown",
      virtualDaaScore: info.virtualDaaScore ? BigInt(info.virtualDaaScore) : undefined,
      tipHashes: []
    };
  }

  async getServerInfo(): Promise<ServerInfo> {
    const info = await this.getInfo();
    return {
      networkId: (info.networkId as KaspaNetworkId) || "unknown",
      serverVersion: info.serverVersion,
      isSynced: info.isSynced
    };
  }

  async close(): Promise<void> {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private async safeRequest(methods: string[], params: unknown = {}): Promise<unknown> {
    let lastError: any = null;
    for (const method of methods) {
      try {
        return await this.request(method, params);
      } catch (error) {
        lastError = error;
        if ((error as any).code === -32601) {
          // Method not found, try next
          continue;
        }
        throw error;
      }
    }
    throw lastError ?? new Error(`Methods failed: ${methods.join(", ")}`);
  }

  private async request(method: string, params: unknown = {}): Promise<unknown> {
    const ws = await this.connect();
    const id = this.requestId++;
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`RPC request timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      const onMessage = (data: any) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === id) {
            cleanup();
            if (response.error) {
              reject(response.error);
            } else {
              resolve(response.result);
            }
          }
        } catch (e) {}
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        ws.removeListener("message", onMessage);
        ws.removeListener("error", onError);
      };

      ws.on("message", onMessage);
      ws.on("error", onError);
      ws.send(payload);
    });
  }

  private async connect(): Promise<WebSocket> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return this.socket;
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.rpcUrl);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Cannot connect to Kaspa RPC at ${this.rpcUrl}. Connection timed out.`));
      }, this.timeoutMs);

      ws.on("open", () => {
        clearTimeout(timeout);
        this.socket = ws;
        resolve(ws);
      });

      ws.on("error", (err: any) => {
        clearTimeout(timeout);
        let message = `Cannot connect to Kaspa RPC at ${this.rpcUrl}. Is kaspad running with --rpclisten-json?`;
        if (err.code === "ECONNREFUSED") {
           message = `Connection refused at ${this.rpcUrl}. Ensure kaspad is running and --rpclisten-json is enabled.`;
        }
        reject(new Error(message));
      });
    });
  }
}

export function mapKaspaNodeInfo(result: any): KaspaNodeInfo {
  if (!result) return { raw: result };

  return {
    serverVersion: result.serverVersion || result.server_version,
    isSynced: result.isSynced !== undefined ? result.isSynced : result.is_synced,
    isUtxoIndexed: result.isUtxoIndexed !== undefined ? result.isUtxoIndexed : result.is_utxo_indexed,
    p2pId: result.p2pId || result.p2p_id,
    mempoolSize: result.mempoolSize !== undefined ? result.mempoolSize : result.mempool_size,
    virtualDaaScore: result.virtualDaaScore !== undefined ? result.virtualDaaScore : result.virtual_daa_score,
    networkId: result.networkId || result.network_id,
    raw: result
  };
}

export function mapKaspaAddressBalance(result: any, address: string): KaspaAddressBalance {
  if (!result) return { address, balanceSompi: 0n, raw: result };
  
  const balance = result.balance !== undefined ? result.balance : result.balanceSompi;
  const balanceSompi = balance !== undefined ? BigInt(balance) : 0n;

  return {
    address,
    balanceSompi,
    raw: result
  };
}

export function mapKaspaRpcUtxos(result: any, address: string): KaspaRpcUtxo[] {
  if (!result) return [];
  
  let entries: any = null;

  if (Array.isArray(result)) {
    entries = result;
  } else if (result.result && Array.isArray(result.result)) {
    entries = result.result;
  } else if (result.result && (result.result.entries || result.result.utxos)) {
    entries = result.result.entries || result.result.utxos;
  } else {
    entries = result.entries || result.utxos || result;
  }
  
  if (!Array.isArray(entries)) {
    // Handle { "address": [...] } format
    if (typeof entries === "object" && entries !== null) {
       const keys = Object.keys(entries);
       const firstKey = keys[0];
       if (keys.length === 1 && firstKey && Array.isArray(entries[firstKey])) {
         entries = entries[firstKey];
       } else {
         return [];
       }
    } else {
      return [];
    }
  }

  return (entries as any[]).map((entry: any) => {
    const utxoEntry = entry.utxoEntry || entry.utxo_entry || entry;
    const outpoint = entry.outpoint || entry;

    return {
      outpoint: {
        transactionId: outpoint.transactionId || outpoint.transaction_id || outpoint.txId || outpoint.tx_id || "",
        index: Number(outpoint.index !== undefined ? outpoint.index : outpoint.outputIndex)
      },
      address: entry.address || address,
      amountSompi: BigInt(utxoEntry.amount || utxoEntry.amountSompi || utxoEntry.amount_sompi || 0),
      scriptPublicKey: utxoEntry.scriptPublicKey || utxoEntry.script_public_key,
      blockDaaScore: utxoEntry.blockDaaScore || utxoEntry.block_daa_score,
      isCoinbase: utxoEntry.isCoinbase || utxoEntry.is_coinbase,
      raw: entry
    };
  });
}

export function mapKaspaSubmitTransactionResult(result: any): KaspaSubmitTransactionResult {
  if (!result) return { raw: result };

  return {
    transactionId: result.transactionId || result.transaction_id || result.txId || result.tx_id,
    accepted: result.accepted !== undefined ? result.accepted : (result.isAccepted || result.success),
    raw: result
  };
}

export class MockKaspaRpcClient implements KaspaRpcClient {
  private utxosByAddress = new Map<string, KaspaRpcUtxo[]>();

  constructor(private readonly networkId: KaspaNetworkId = "simnet") {}

  async getInfo(): Promise<KaspaNodeInfo> {
    return { networkId: this.networkId, serverVersion: "mock", isSynced: true, virtualDaaScore: 0, raw: {} };
  }

  async healthCheck(): Promise<KaspaRpcHealth> {
    return { reachable: true, rpcUrl: "mock://local", info: await this.getInfo() };
  }

  async getBalanceByAddress(address: string): Promise<KaspaAddressBalance> {
    const utxos = this.utxosByAddress.get(address) || [];
    const balanceSompi = utxos.reduce((acc, u) => acc + u.amountSompi, 0n);
    return { address, balanceSompi };
  }

  async getUtxosByAddress(address: string): Promise<KaspaRpcUtxo[]> {
    return this.utxosByAddress.get(address) || [];
  }

  setUtxos(address: string, utxos: KaspaRpcUtxo[]): void {
    this.utxosByAddress.set(address, utxos);
  }

  async submitTransaction(rawTransaction: string): Promise<KaspaSubmitTransactionResult> {
    return { 
      transactionId: "mock-txid", 
      accepted: true,
      raw: { rawTransaction }
    };
  }

  async getMempoolEntry(_txId: string): Promise<MempoolEntry | null> {
    return null;
  }

  async getBlockDagInfo(): Promise<BlockDagInfo> {
    return { networkId: this.networkId, virtualDaaScore: 0n };
  }

  async getServerInfo(): Promise<ServerInfo> {
    return { networkId: this.networkId, serverVersion: "mock", isSynced: true };
  }

  async close(): Promise<void> {}
}

export * from "./json-rpc-client.js";
export * from "./health.js";
