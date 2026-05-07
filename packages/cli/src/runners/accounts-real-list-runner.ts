import { 
  loadRealAccountStore, 
  listRealDevAccounts,
  RealDevAccount 
} from "@hardkas/localnet";

export interface AccountsRealListOptions {
  showPrivate?: boolean;
}

export async function runAccountsRealList(options: AccountsRealListOptions = {}): Promise<{
  accounts: readonly RealDevAccount[];
  formatted: string;
}> {
  const store = await loadRealAccountStore();
  if (!store || store.accounts.length === 0) {
    return {
      accounts: [],
      formatted: "No real dev accounts found. Use 'hardkas accounts real import' to add one."
    };
  }

  const accounts = listRealDevAccounts(store);
  
  const lines = [
    "Real dev accounts",
    ""
  ];

  accounts.forEach(a => {
    let privateInfo = "no";
    if (a.privateKey) {
      if (options.showPrivate) {
        privateInfo = a.privateKey;
      } else {
        const prefix = a.privateKey.substring(0, 8);
        privateInfo = `${prefix}... (masked)`;
      }
    }
    lines.push(`${a.name.padEnd(12)} ${a.address.padEnd(24)} private: ${privateInfo}`);
  });

  if (options.showPrivate) {
    lines.push("");
    lines.push("WARNING: Private keys were shown. Ensure your terminal screen is cleared.");
  }

  return {
    accounts,
    formatted: lines.join("\n")
  };
}
