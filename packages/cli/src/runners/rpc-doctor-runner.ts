import { UI } from "../ui.js";
import { KaspaJsonRpcClient, LoadBalancedRpcProvider } from "@hardkas/kaspa-rpc";
import { loadHardkasConfig } from "@hardkas/config";

export interface RpcDoctorOptions {
  endpoints?: string[];
  config?: string;
}

export async function runRpcDoctor(options: RpcDoctorOptions) {
  let endpoints = options.endpoints || [];

  if (endpoints.length === 0) {
    const loaded = await loadHardkasConfig({ configPath: options.config });
    const networks = loaded.config.networks || {};
    const defaultNetwork = loaded.config.defaultNetwork || "simnet";
    const network = networks[defaultNetwork];

    if (network?.rpcUrl) {
      endpoints = [network.rpcUrl];
    } else {
      endpoints = ["http://127.0.0.1:18210"];
    }
  }

  UI.header("HardKAS RPC Doctor");
  console.log(`Auditing ${endpoints.length} endpoint(s)...\n`);

  const results = [];

  for (const url of endpoints) {
    const client = new KaspaJsonRpcClient({ url, timeoutMs: 5000 });
    const start = Date.now();
    const health = await client.healthCheck();
    const latency = Date.now() - start;

    results.push({ url, health, latency });

    if (health.reachable) {
      UI.success(`[HEALTHY] ${url}`);
      console.log(`  Latency: ${latency}ms`);
      console.log(`  Version: ${health.info?.serverVersion || "unknown"}`);
      console.log(`  Synced:  ${health.info?.isSynced ? "Yes" : "No"}`);
      console.log(`  Network: ${health.info?.networkId || "unknown"}`);
    } else {
      UI.error(`[UNREACHABLE] ${url}`);
      console.log(`  Error:   ${health.error}`);
    }
    console.log("");
  }

  if (endpoints.length > 1) {
    UI.divider();
    const healthy = results.filter(r => r.health.reachable);
    if (healthy.length === endpoints.length) {
      UI.success("All endpoints are healthy and ready for failover.");
    } else if (healthy.length > 0) {
      UI.warning(`${healthy.length}/${endpoints.length} endpoints are healthy. Load balancing will be degraded.`);
    } else {
      UI.error("CRITICAL: All endpoints are unreachable.");
    }
  }
}
