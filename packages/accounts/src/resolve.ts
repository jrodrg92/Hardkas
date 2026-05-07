import type { HardkasConfig } from "@hardkas/config";
import { createDeterministicAccounts } from "@hardkas/localnet";
import type { HardkasAccount } from "./types";
import { 
  loadRealAccountStoreSync, 
  getRealDevAccount, 
  listRealDevAccounts 
} from "./real-accounts";

export interface ResolveAccountOptions {
  nameOrAddress: string;
  config?: HardkasConfig | undefined;
}

export function resolveHardkasAccount(
  options: ResolveAccountOptions
): HardkasAccount {
  const { nameOrAddress, config } = options;

  // 1. If it starts with "kaspa:", "kaspatest:", "kaspasim:", it's a direct address
  if (nameOrAddress.startsWith("kaspa:") || nameOrAddress.startsWith("kaspatest:") || nameOrAddress.startsWith("kaspasim:")) {
    return {
      name: nameOrAddress,
      kind: "external-wallet",
      address: nameOrAddress
    };
  }

  // 2. Check config.accounts
  if (config?.accounts && config.accounts[nameOrAddress]) {
    const accConfig = config.accounts[nameOrAddress];
    return {
      name: nameOrAddress,
      ...accConfig
    } as HardkasAccount;
  }

  // 3. Check real account store
  const realStore = loadRealAccountStoreSync();
  const realAcc = realStore ? getRealDevAccount(realStore, nameOrAddress) : null;
  if (realAcc) {
    return {
      name: realAcc.name,
      kind: "kaspa-private-key", // Assuming Kaspa for now, could be extensible
      address: realAcc.address
    };
  }

  // 4. Fallback to deterministic accounts
  const detAccounts = createDeterministicAccounts();
  const det = detAccounts.find(a => a.name === nameOrAddress);
  if (det) {
    return {
      name: det.name,
      kind: "simulated",
      address: det.address
    };
  }

  // 5. Not found
  const available = listHardkasAccounts(config).map(a => a.name).join(", ");
  throw new Error(`Unknown HardKAS account '${nameOrAddress}'. Available accounts: ${available}`);
}

export function listHardkasAccounts(config?: HardkasConfig): HardkasAccount[] {
  const accounts: Map<string, HardkasAccount> = new Map();

  // Add deterministic accounts first (defaults)
  const detAccounts = createDeterministicAccounts();
  for (const det of detAccounts) {
    accounts.set(det.name, {
      name: det.name,
      kind: "simulated",
      address: det.address
    });
  }

  // Add from real account store
  const realStore = loadRealAccountStoreSync();
  if (realStore) {
    for (const realAcc of listRealDevAccounts(realStore)) {
      accounts.set(realAcc.name, {
        name: realAcc.name,
        kind: "kaspa-private-key",
        address: realAcc.address
      });
    }
  }

  // Override/Add from config
  if (config?.accounts) {
    for (const [name, accConfig] of Object.entries(config.accounts)) {
      accounts.set(name, {
        name,
        ...accConfig
      } as HardkasAccount);
    }
  }

  return Array.from(accounts.values());
}

export function resolveAccountAddress(
  accountOrAddress: string,
  config?: HardkasConfig
): string {
  if (accountOrAddress.startsWith("kaspa:") || accountOrAddress.startsWith("kaspatest:") || accountOrAddress.startsWith("kaspasim:")) {
    return accountOrAddress;
  }

  const account = resolveHardkasAccount({ nameOrAddress: accountOrAddress, config });
  if (!account.address) {
    throw new Error(`Account '${account.name}' does not have a resolved address yet.`);
  }

  return account.address;
}

export function describeAccount(account: HardkasAccount): Record<string, unknown> {
  const desc: Record<string, unknown> = {
    name: account.name,
    kind: account.kind
  };

  if (account.address) {
    desc.address = account.address;
  }

  if (account.kind === "kaspa-private-key" || account.kind === "evm-private-key") {
    desc.privateKeyEnv = account.privateKeyEnv;
  }

  if (account.kind === "external-wallet" && account.walletId) {
    desc.walletId = account.walletId;
  }

  return desc;
}
