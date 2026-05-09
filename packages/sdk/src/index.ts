import { loadHardkasConfig as loadConfig, LoadedHardkasConfig as LoadedConfig } from "@hardkas/config";
import { JsonWrpcKaspaClient, KaspaRpcClient } from "@hardkas/kaspa-rpc";
import { NetworkId } from "@hardkas/core";
import { HardkasAccounts } from "./accounts.js";
import { HardkasTx } from "./tx.js";
import { HardkasL2 } from "./l2.js";
import { HardkasQuery } from "./query.js";
import { HardkasLocalnet } from "./localnet.js";

// Curated explicit exports only. No `export *`
export { HardkasAccounts } from "./accounts.js";
export { HardkasTx } from "./tx.js";
export { HardkasL2 } from "./l2.js";
export { HardkasQuery } from "./query.js";
export { HardkasLocalnet } from "./localnet.js";
export { defineTask, type TaskContext, type TaskArgs } from "./tasks.js";

export { 
  SOMPI_PER_KAS, 
  HardkasError,
  parseKasToSompi,
  formatSompi 
} from "@hardkas/core";
export type { NetworkId } from "@hardkas/core";

export interface HardkasOptions {
  cwd?: string;
  configPath?: string;
}

/**
 * HardKAS SDK - Main Entry Point
 * 
 * Provides a high-level facade for interacting with the Kaspa ecosystem.
 * Modular boundaries are available via .accounts, .tx, .localnet, .query and .l2.
 */
export class Hardkas {
  public readonly accounts: HardkasAccounts;
  public readonly tx: HardkasTx;
  public readonly l2: HardkasL2;
  public readonly query: HardkasQuery;
  public readonly localnet: HardkasLocalnet;

  private constructor(
    public readonly config: LoadedConfig,
    public readonly rpc: KaspaRpcClient
  ) {
    this.accounts = new HardkasAccounts(this);
    this.tx = new HardkasTx(this);
    this.l2 = new HardkasL2();
    this.query = new HardkasQuery(this);
    this.localnet = new HardkasLocalnet(this);
  }

  /**
   * Opens a HardKAS project in the given directory.
   */
  static async open(dirOrOptions: string | HardkasOptions = "."): Promise<Hardkas> {
    const options = typeof dirOrOptions === "string" ? { cwd: dirOrOptions } : dirOrOptions;
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
   * Current active network name.
   */
  get network(): NetworkId {
    return (this.sdkConfig.defaultNetwork as NetworkId) || "simnet";
  }

  get sdkConfig() {
    return this.config.config;
  }
  
  get cwd() {
    return this.config.cwd;
  }
}
