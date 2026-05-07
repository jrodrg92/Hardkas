import type { KaspaNetworkId } from "@hardkas/core";
import type { Utxo } from "@hardkas/tx-builder";

export interface BlockDagInfo {
  readonly networkId: KaspaNetworkId;
  readonly virtualDaaScore?: bigint;
  readonly tipHashes?: readonly string[];
}

export interface ServerInfo {
  readonly networkId: KaspaNetworkId;
  readonly serverVersion?: string;
  readonly isSynced?: boolean;
}

export interface MempoolEntry {
  readonly txId: string;
  readonly acceptedAt?: string;
}

export interface KaspaRpcClient {
  getUtxosByAddress(address: string): Promise<readonly Utxo[]>;
  submitTransaction(tx: unknown): Promise<{ txId: string }>;
  getMempoolEntry(txId: string): Promise<MempoolEntry | null>;
  getBlockDagInfo(): Promise<BlockDagInfo>;
  getServerInfo(): Promise<ServerInfo>;
}

export class MockKaspaRpcClient implements KaspaRpcClient {
  private readonly utxosByAddress = new Map<string, readonly Utxo[]>();

  constructor(private readonly networkId: KaspaNetworkId = "simnet") {}

  setUtxos(address: string, utxos: readonly Utxo[]): void {
    this.utxosByAddress.set(address, utxos);
  }

  async getUtxosByAddress(address: string): Promise<readonly Utxo[]> {
    return this.utxosByAddress.get(address) ?? [];
  }

  async submitTransaction(_tx: unknown): Promise<{ txId: string }> {
    return {
      txId: `mock_tx_${Date.now().toString(36)}`
    };
  }

  async getMempoolEntry(txId: string): Promise<MempoolEntry | null> {
    return {
      txId,
      acceptedAt: new Date().toISOString()
    };
  }

  async getBlockDagInfo(): Promise<BlockDagInfo> {
    return {
      networkId: this.networkId,
      virtualDaaScore: 0n,
      tipHashes: []
    };
  }

  async getServerInfo(): Promise<ServerInfo> {
    return {
      networkId: this.networkId,
      serverVersion: "mock",
      isSynced: true
    };
  }
}
