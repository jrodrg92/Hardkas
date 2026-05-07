import { 
  loadRealAccountStore, 
  resolveRealAccountOrAddress 
} from "@hardkas/localnet";
import { JsonWrpcKaspaClient } from "@hardkas/kaspa-rpc";
import { formatSompi } from "@hardkas/core";

export interface AccountsRealBalanceOptions {
  nameOrAddress: string;
  url?: string;
  json?: boolean;
}

export interface AccountsRealBalanceResult {
  name?: string;
  address: string;
  networkId: string;
  utxoCount: number;
  balanceSompi: string;
  formatted: string;
}

export async function runAccountsRealBalance(options: AccountsRealBalanceOptions): Promise<AccountsRealBalanceResult> {
  const store = await loadRealAccountStore();
  const { address, name } = resolveRealAccountOrAddress(store, options.nameOrAddress);

  const rpcUrl = options.url || "http://127.0.0.1:18210";
  const client = new JsonWrpcKaspaClient({ rpcUrl });

  try {
    const info = await client.getInfo();
    const utxos = await client.getUtxosByAddress(address);
    const balanceSompi = utxos.reduce((acc, u) => acc + u.amountSompi, 0n);

    const lines = [
      "Real account balance",
      "",
      `Name:     ${name || "unknown"}`,
      `Address:  ${address}`,
      `Network:  ${info.networkId || "unknown"}`,
      `UTXOs:    ${utxos.length}`,
      `Balance:  ${formatSompi(balanceSompi)}`
    ];

    return {
      name,
      address,
      networkId: info.networkId || "unknown",
      utxoCount: utxos.length,
      balanceSompi: balanceSompi.toString(),
      formatted: lines.join("\n")
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ECONNREFUSED") || msg.includes("timed out")) {
      throw new Error(`RPC error: ${msg}\nSuggestion: hardkas rpc health --wait --timeout 60`);
    }
    throw e;
  } finally {
    await client.close();
  }
}
