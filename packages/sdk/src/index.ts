import { loadHardkasConfig as loadConfig, LoadedHardkasConfig as LoadedConfig } from "@hardkas/config";
import { JsonWrpcKaspaClient, KaspaRpcClient } from "@hardkas/kaspa-rpc";
import { NetworkId } from "@hardkas/core";
import { HardkasAccounts } from "./accounts.js";
import { HardkasTx } from "./tx.js";
import { HardkasL2 } from "./l2.js";

export { HardkasAccounts } from "./accounts.js";
export { HardkasTx } from "./tx.js";
export { HardkasL2 } from "./l2.js";

// Re-export core types and utilities
export { 
  SOMPI_PER_KAS, 
  NetworkIdSchema, 
  HardkasError,
  parseKasToSompi,
  formatSompi 
} from "@hardkas/core";
export type { NetworkId } from "@hardkas/core";

export * from "@hardkas/kaspa-rpc";
export * from "@hardkas/accounts";
export * from "@hardkas/tx-builder";
export * from "@hardkas/artifacts";
export type { TxPlan } from "@hardkas/tx-builder";

export interface HardkasOptions {
  cwd?: string;
  configPath?: string;
}

/**
 * HardKAS SDK - Main Entry Point
 * 
 * Provides a high-level facade for interacting with the Kaspa ecosystem.
 * Modular boundaries are available via .accounts, .tx, and .l2.
 */
export class Hardkas {
  public readonly accounts: HardkasAccounts;
  public readonly tx: HardkasTx;
  public readonly l2: HardkasL2;

  private constructor(
    public readonly config: LoadedConfig,
    public readonly rpc: KaspaRpcClient
  ) {
    this.accounts = new HardkasAccounts(this);
    this.tx = new HardkasTx(this);
    this.l2 = new HardkasL2();
  }

  /**
   * Initializes the HardKAS SDK.
   */
  static async create(options: HardkasOptions = {}): Promise<Hardkas> {
    const loaded = await loadConfig(options);
    const networkId = loaded.config.defaultNetwork || "simnet";
    const target = loaded.config.networks?.[networkId];
    
    let rpcUrl = "ws://127.0.0.1:18210"; 
    if (target) {
      if (target.kind === "kaspa-rpc" || target.kind === "igra") {
        rpcUrl = target.rpcUrl;
      } else if (target.kind === "kaspa-node" && target.rpcUrl) {
        rpcUrl = target.rpcUrl;
      }
    }

    const rpc = new JsonWrpcKaspaClient({ rpcUrl });

    return new Hardkas(loaded, rpc);
  }

  /**
   * Performs a lightweight SDK health and environment self-check.
   * @alpha
   */
  async checkHealth(): Promise<{
    status: "ok" | "error";
    environment: NetworkId;
    network: string;
    rpcUrl: string;
    version: string;
  }> {
    try {
      const info = await this.rpc.getInfo();
      return {
        status: "ok",
        environment: (this.config.config.defaultNetwork as NetworkId) || "simnet",
        network: info.networkId || "unknown",
        rpcUrl: (this.rpc as any).rpcUrl || "unknown",
        version: "0.2.0-alpha"
      };
    } catch (e) {
      return {
        status: "error",
        environment: (this.config.config.defaultNetwork as NetworkId) || "simnet",
        network: "unknown",
        rpcUrl: (this.rpc as any).rpcUrl || "unknown",
        version: "0.2.0-alpha"
      };
    }
  }

  /**
   * Current active network name.
   */
  get network(): NetworkId {
    return (this.config.config.defaultNetwork as NetworkId) || "simnet";
  }
}
