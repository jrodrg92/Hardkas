import fs from "node:fs";
import path from "node:path";

export interface RealAccountStore {
  readonly version: 1;
  readonly kind: "hardkas.realAccountStore";
  readonly networkId: "simnet";
  readonly warning: string;
  readonly accounts: readonly RealDevAccount[];
}

export interface RealDevAccount {
  readonly name: string;
  readonly address: string;
  readonly publicKey?: string;
  readonly privateKey?: string;
  readonly createdAt: string;
}

export function getDefaultRealAccountsPath(cwd: string = process.cwd()): string {
  return path.join(cwd, ".hardkas", "accounts.real.json");
}

export function createEmptyRealAccountStore(): RealAccountStore {
  return {
    version: 1,
    kind: "hardkas.realAccountStore",
    networkId: "simnet",
    warning: "Development keys only. Do not use on mainnet. Private keys are stored in plaintext.",
    accounts: []
  };
}

export async function loadRealAccountStore(options?: {
  readonly cwd?: string;
  readonly path?: string;
}): Promise<RealAccountStore | null> {
  const filePath = options?.path || getDefaultRealAccountsPath(options?.cwd);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data) as RealAccountStore;
  } catch (e) {
    throw new Error(`Failed to load real account store at ${filePath}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function loadOrCreateRealAccountStore(options?: {
  readonly cwd?: string;
  readonly path?: string;
}): Promise<RealAccountStore> {
  const store = await loadRealAccountStore(options);
  if (store) return store;

  const newStore = createEmptyRealAccountStore();
  await saveRealAccountStore(newStore, options);
  return newStore;
}

export async function saveRealAccountStore(
  store: RealAccountStore,
  options?: {
    readonly cwd?: string;
    readonly path?: string;
  }
): Promise<void> {
  const filePath = options?.path || getDefaultRealAccountsPath(options?.cwd);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    throw new Error(`Failed to save real account store at ${filePath}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function validateAccountName(name: string): void {
  if (!name) {
    throw new Error("Account name is required.");
  }
  const nameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!nameRegex.test(name)) {
    throw new Error(`Invalid account name '${name}'. Only letters, numbers, dashes and underscores are allowed.`);
  }
}

export function validateAddressPrefix(address: string): void {
  if (!address) {
    throw new Error("Address is required.");
  }
  const validPrefixes = ["kaspa:", "kaspatest:", "kaspasim:"];
  const hasValidPrefix = validPrefixes.some(prefix => address.startsWith(prefix));
  if (!hasValidPrefix) {
    throw new Error(`Invalid address '${address}'. Must start with one of: ${validPrefixes.join(", ")}`);
  }
}

export function importRealDevAccount(
  store: RealAccountStore,
  account: {
    readonly name: string;
    readonly address: string;
    readonly publicKey?: string;
    readonly privateKey?: string;
  }
): RealAccountStore {
  validateAccountName(account.name);
  validateAddressPrefix(account.address);

  if (store.accounts.some(a => a.name.toLowerCase() === account.name.toLowerCase())) {
    throw new Error(`Account with name '${account.name}' already exists.`);
  }

  const newAccount: RealDevAccount = {
    ...account,
    createdAt: new Date().toISOString()
  };

  return {
    ...store,
    accounts: [...store.accounts, newAccount]
  };
}

export function removeRealDevAccount(
  store: RealAccountStore,
  name: string
): RealAccountStore {
  const index = store.accounts.findIndex(a => a.name.toLowerCase() === name.toLowerCase());
  if (index === -1) {
    throw new Error(`Account with name '${name}' not found.`);
  }

  const newAccounts = [...store.accounts];
  newAccounts.splice(index, 1);

  return {
    ...store,
    accounts: newAccounts
  };
}

export function getRealDevAccount(
  store: RealAccountStore,
  name: string
): RealDevAccount | null {
  return store.accounts.find(a => a.name.toLowerCase() === name.toLowerCase()) || null;
}

export function listRealDevAccounts(
  store: RealAccountStore
): readonly RealDevAccount[] {
  return store.accounts;
}
