import { 
  loadRealAccountStore, 
  saveRealAccountStore, 
  removeRealDevAccount 
} from "@hardkas/localnet";

export interface AccountsRealRemoveOptions {
  name: string;
  yes?: boolean;
}

export async function runAccountsRealRemove(options: AccountsRealRemoveOptions): Promise<{
  name: string;
  formatted: string;
}> {
  if (!options.yes) {
    throw new Error("Refusing to remove account without --yes.");
  }

  const store = await loadRealAccountStore();
  if (!store) {
    throw new Error("No real account store found.");
  }

  const newStore = removeRealDevAccount(store, options.name);
  await saveRealAccountStore(newStore);

  return {
    name: options.name,
    formatted: `Account '${options.name}' removed successfully.`
  };
}
