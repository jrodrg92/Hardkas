import { 
  loadRealAccountStore, 
  getRealDevAccount,
  RealDevAccount 
} from "@hardkas/localnet";

export interface AccountsRealShowOptions {
  name: string;
  showPrivate?: boolean;
}

export async function runAccountsRealShow(options: AccountsRealShowOptions): Promise<{
  account: RealDevAccount;
  formatted: string;
}> {
  const store = await loadRealAccountStore();
  if (!store) {
    throw new Error("No real account store found. Use 'hardkas accounts real init'.");
  }

  const account = getRealDevAccount(store, options.name);
  if (!account) {
    throw new Error(`Account '${options.name}' not found.`);
  }

  let privateKey = account.privateKey || "none";
  if (account.privateKey && !options.showPrivate) {
    const prefix = account.privateKey.substring(0, 8);
    privateKey = `${prefix}... (masked)`;
  }

  const lines = [
    "Real dev account",
    "",
    `Name:       ${account.name}`,
    `Address:    ${account.address}`,
    `Public key: ${account.publicKey || "none"}`,
    `Private key: ${privateKey}`,
    `Created at: ${account.createdAt}`
  ];

  if (options.showPrivate && account.privateKey) {
    lines.push("");
    lines.push("WARNING: Private key is shown. Do not share this information.");
  }

  return {
    account,
    formatted: lines.join("\n")
  };
}
