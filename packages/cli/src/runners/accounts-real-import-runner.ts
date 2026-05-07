import { 
  loadOrCreateRealAccountStore, 
  saveRealAccountStore, 
  importRealDevAccount,
  RealDevAccount 
} from "@hardkas/localnet";

export interface AccountsRealImportOptions {
  name: string;
  address: string;
  publicKey?: string;
  privateKey?: string;
}

export async function runAccountsRealImport(options: AccountsRealImportOptions): Promise<{
  account: RealDevAccount;
  formatted: string;
}> {
  let store = await loadOrCreateRealAccountStore();
  
  store = importRealDevAccount(store, {
    name: options.name,
    address: options.address,
    publicKey: options.publicKey,
    privateKey: options.privateKey
  });

  await saveRealAccountStore(store);

  const account = store.accounts[store.accounts.length - 1];

  const lines = [
    "Real dev account imported",
    "",
    `Name:    ${account.name}`,
    `Address: ${account.address}`,
    `Private: ${account.privateKey ? "yes" : "no"}`,
    "",
    "WARNING:",
    "  Private keys are stored in plaintext for local development only."
  ];

  return {
    account,
    formatted: lines.join("\n")
  };
}
