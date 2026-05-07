import { 
  loadRealAccountStore, 
  resolveRealAccountOrAddress 
} from "@hardkas/localnet";
import { JsonWrpcKaspaClient } from "@hardkas/kaspa-rpc";
import { formatSompi } from "@hardkas/core";

export interface AccountsRealUtxosOptions {
  nameOrAddress: string;
  url?: string;
  json?: boolean;
}

export interface AccountsRealUtxoResult {
  txId: string;
  index: number;
  amountSompi: string;
  amount: string;
  daaScore?: string;
}

export interface AccountsRealUtxosResult {
  name?: string;
  address: string;
  networkId: string;
  count: number;
  balanceSompi: string;
  utxos: AccountsRealUtxoResult[];
  formatted: string;
}

export async function runAccountsRealUtxos(options: AccountsRealUtxosOptions): Promise<AccountsRealUtxosResult> {
  const store = await loadRealAccountStore();
  const { address, name } = resolveRealAccountOrAddress(store, options.nameOrAddress);

  const rpcUrl = options.url || "http://127.0.0.1:18210";
  const client = new JsonWrpcKaspaClient({ rpcUrl });

  try {
    const info = await client.getInfo();
    const rpcUtxos = await client.getUtxosByAddress(address);
    const balanceSompi = rpcUtxos.reduce((acc, u) => acc + u.amountSompi, 0n);

    const utxos: AccountsRealUtxoResult[] = rpcUtxos.map(u => ({
      txId: u.outpoint.transactionId,
      index: u.outpoint.index,
      amountSompi: u.amountSompi.toString(),
      amount: formatSompi(u.amountSompi),
      daaScore: u.blockDaaScore?.toString()
    }));

    const lines = [
      "Real account UTXOs",
      "",
      `Name:     ${name || "unknown"}`,
      `Address:  ${address}`,
      `Network:  ${info.networkId || "unknown"}`,
      `Count:    ${utxos.length}`,
      `Balance:  ${formatSompi(balanceSompi)}`,
      "",
      "UTXOs:"
    ];

    if (utxos.length === 0) {
      lines.push("  none");
    } else {
      for (const u of utxos) {
        const id = `${u.txId}:${u.index}`.padEnd(70);
        const amt = u.amount.padStart(18);
        const daa = u.daaScore ? `DAA ${u.daaScore}` : "";
        lines.push(`  ${id} ${amt}    ${daa}`);
      }
    }

    return {
      name,
      address,
      networkId: info.networkId || "unknown",
      count: utxos.length,
      balanceSompi: balanceSompi.toString(),
      utxos,
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
