import { KaspaJsonRpcClient } from "./json-rpc-client.js";

export interface RpcHealthCheckOptions {
  readonly url?: string | undefined;
  readonly timeoutMs?: number | undefined;
}

export interface RpcReadinessWaitOptions extends RpcHealthCheckOptions {
  readonly wait?: boolean | undefined;
  readonly intervalMs?: number | undefined;
  readonly maxWaitMs?: number | undefined;
}

export interface RpcHealthResult {
  readonly url: string;
  readonly ready: boolean;
  readonly checkedAt: string;
  readonly latencyMs?: number | undefined;
  readonly networkId?: string | undefined;
  readonly virtualDaaScore?: string | undefined;
  readonly serverVersion?: string | undefined;
  readonly isSynced?: boolean | undefined;
  readonly error?: string | undefined;
}

export async function checkKaspaRpcHealth(options?: RpcHealthCheckOptions): Promise<RpcHealthResult> {
  const url = options?.url || "http://127.0.0.1:18210";
  const client = new KaspaJsonRpcClient({ url, timeoutMs: options?.timeoutMs });
  const start = Date.now();
  const checkedAt = new Date().toISOString();

  try {
    // A node is ready if both server info and DAG info are accessible
    const [serverInfo, dagInfo] = await Promise.all([
      client.getServerInfo(),
      client.getBlockDagInfo()
    ]);

    const latencyMs = Date.now() - start;

    return {
      url,
      ready: true,
      checkedAt,
      latencyMs,
      networkId: serverInfo.networkId,
      virtualDaaScore: dagInfo.virtualDaaScore?.toString(),
      serverVersion: serverInfo.serverVersion,
      isSynced: serverInfo.isSynced
    };
  } catch (e) {
    return {
      url,
      ready: false,
      checkedAt,
      error: e instanceof Error ? e.message : String(e)
    };
  }
}

export async function waitForKaspaRpcReady(options?: RpcReadinessWaitOptions): Promise<RpcHealthResult> {
  const intervalMs = options?.intervalMs || 1000;
  const maxWaitMs = options?.maxWaitMs || 60000;
  const start = Date.now();

  let lastResult: RpcHealthResult | undefined;

  while (Date.now() - start < maxWaitMs) {
    lastResult = await checkKaspaRpcHealth({ 
      url: options?.url, 
      timeoutMs: options?.timeoutMs 
    });

    if (lastResult.ready) {
      return lastResult;
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return lastResult || {
    url: options?.url || "http://127.0.0.1:18210",
    ready: false,
    checkedAt: new Date().toISOString(),
    error: "Timed out waiting for RPC to be ready"
  };
}
