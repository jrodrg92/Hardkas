import { KaspaJsonRpcClient, BlockDagInfo } from "@hardkas/kaspa-rpc";

export interface RpcDagOptions {
  url?: string;
}

export async function runRpcDag(options: RpcDagOptions = {}): Promise<{
  dag: BlockDagInfo;
  formatted: string;
}> {
  const client = new KaspaJsonRpcClient({ url: options.url });
  const dag = await client.getBlockDagInfo();
  
  const lines = [
    "Kaspa DAG info",
    "",
    `Network:        ${dag.networkId}`,
    `Virtual DAA:    ${dag.virtualDaaScore?.toString() || "unknown"}`,
    `Tips:           ${dag.tipHashes?.length || 0}`
  ];

  if (dag.tipHashes && dag.tipHashes.length > 0) {
    lines.push("");
    lines.push("Tips:");
    dag.tipHashes.slice(0, 5).forEach(hash => lines.push(`  - ${hash}`));
    if (dag.tipHashes.length > 5) {
      lines.push(`  ... and ${dag.tipHashes.length - 5} more`);
    }
  }

  return {
    dag,
    formatted: lines.join("\n")
  };
}
