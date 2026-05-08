import { 
  loadRealAccountStore, 
  listRealDevAccounts 
} from "@hardkas/accounts";

export interface AccountsRealListOptions {
  // Add filters if needed
}

export async function runAccountsRealList(options: AccountsRealListOptions = {}): Promise<{
  formatted: string;
}> {
  const store = await loadRealAccountStore();
  if (!store) return { formatted: "Real account store not found (run 'hardkas accounts real init')." };

  const accounts = listRealDevAccounts(store);
  if (accounts.length === 0) return { formatted: "No real dev accounts found." };

  const lines = [
    "Real dev accounts:",
    ""
  ];

  accounts.forEach(acc => {
    lines.push(`${acc.name.padEnd(12)} ${acc.address}`);
  });

  return { formatted: lines.join("\n") };
}
