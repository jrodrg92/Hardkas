import { loadHardkasConfig as loadConfig, LoadedHardkasConfig as LoadedConfig } from "@hardkas/config";
import { JsonWrpcKaspaClient, KaspaRpcClient } from "@hardkas/kaspa-rpc";
import { 
  listL2Profiles, 
  getL2Profile, 
  L2NetworkProfile 
} from "@hardkas/l2";
import { 
  HardkasAccount, 
  resolveHardkasAccount, 
  signTxPlanArtifact 
} from "@hardkas/accounts";
import { 
  buildPaymentPlan, 
  TxPlan,
  Utxo as BuilderUtxo
} from "@hardkas/tx-builder";
import { 
  TxPlanArtifact, 
  SignedTxArtifact, 
  TxReceiptArtifact, 
  ARTIFACT_SCHEMAS, 
  HARDKAS_VERSION,
  getBroadcastableSignedTransaction,
  writeArtifact,
  getDefaultReceiptPath,
  createTxPlanArtifact,
  readTxReceiptArtifact
} from "@hardkas/artifacts";
import { formatSompi, parseKasToSompi } from "@hardkas/core";

// Re-export core types and utilities
export { 
  SOMPI_PER_KAS, 
  kaspaNetworkIdSchema, 
  HardkasError,
  parseKasToSompi,
  formatSompi 
} from "@hardkas/core";
export type { KaspaNetworkId } from "@hardkas/core";

export * from "@hardkas/kaspa-rpc";
export * from "@hardkas/accounts";
export * from "@hardkas/tx-builder";
export * from "@hardkas/artifacts";

export interface HardkasOptions {
  cwd?: string;
  configPath?: string;
}

/**
 * Hardkas high-level facade.
 */
export class Hardkas {
  public readonly accounts: HardkasAccounts;
  public readonly tx: HardkasTx;

  private constructor(
    public readonly config: LoadedConfig,
    public readonly rpc: KaspaRpcClient,
    public readonly l2: HardkasL2
  ) {
    this.accounts = new HardkasAccounts(this);
    this.tx = new HardkasTx(this);
  }

  static async create(options: HardkasOptions = {}): Promise<Hardkas> {
    const loaded = await loadConfig(options);
    const networkId = loaded.config.defaultNetwork || "simnet";
    const target = loaded.config.networks?.[networkId];
    
    let rpcUrl = "ws://127.0.0.1:17110"; 
    if (target) {
      if (target.kind === "kaspa-rpc" || target.kind === "igra") {
        rpcUrl = target.rpcUrl;
      } else if (target.kind === "kaspa-node" && target.rpcUrl) {
        rpcUrl = target.rpcUrl;
      }
    }

    const rpc = new JsonWrpcKaspaClient({ rpcUrl });
    const l2 = new HardkasL2();

    return new Hardkas(loaded, rpc, l2);
  }

  get network(): string {
    return this.config.config.defaultNetwork || "simnet";
  }
}

/**
 * Sub-facade for Accounts.
 */
export class HardkasAccounts {
  constructor(private sdk: Hardkas) {}

  async resolve(nameOrAddress: string): Promise<HardkasAccount> {
    return resolveHardkasAccount({
      nameOrAddress,
      config: this.sdk.config.config
    });
  }

  async getBalance(accountNameOrAddress: string): Promise<{ sompi: bigint, formatted: string }> {
    const account = await this.resolve(accountNameOrAddress);
    if (!account.address) throw new Error(`Account ${accountNameOrAddress} has no address`);
    
    const { balanceSompi } = await this.sdk.rpc.getBalanceByAddress(account.address);
    const sompi = BigInt(balanceSompi);
    
    return {
      sompi,
      formatted: formatSompi(sompi)
    };
  }
}

/**
 * Sub-facade for Transactions (Workflow oriented).
 */
export class HardkasTx {
  constructor(private sdk: Hardkas) {}

  async plan(options: { 
    from: string | HardkasAccount, 
    to: string | HardkasAccount, 
    amount: string | bigint,
    feeRate?: bigint
  }): Promise<TxPlanArtifact> {
    const fromAccount = typeof options.from === "string" ? await this.sdk.accounts.resolve(options.from) : options.from;
    const toAccount = typeof options.to === "string" ? await this.sdk.accounts.resolve(options.to) : options.to;
    
    if (!fromAccount.address) throw new Error(`From account ${fromAccount.name} has no address.`);
    if (!toAccount.address) throw new Error(`To account ${toAccount.name} has no address.`);

    const amountSompi = typeof options.amount === "string" ? parseKasToSompi(options.amount) : options.amount;

    // Fetch UTXOs
    const rpcUtxos = await this.sdk.rpc.getUtxosByAddress(fromAccount.address);
    const builderUtxos: BuilderUtxo[] = rpcUtxos.map(u => ({
      outpoint: {
        transactionId: u.outpoint.transactionId,
        index: u.outpoint.index
      },
      address: u.address,
      amountSompi: u.amountSompi,
      scriptPublicKey: u.scriptPublicKey || ""
    }));

    const builderPlan = buildPaymentPlan({
      fromAddress: fromAccount.address,
      availableUtxos: builderUtxos,
      outputs: [{
        address: toAccount.address,
        amountSompi
      }],
      feeRateSompiPerMass: options.feeRate ?? 1n
    });

    return createTxPlanArtifact({
      networkId: this.sdk.network,
      mode: "simulated", // Default for now, should be derived from config
      from: {
        input: fromAccount.name,
        address: fromAccount.address,
        accountName: fromAccount.name
      },
      to: {
        input: toAccount.name,
        address: toAccount.address
      },
      amountSompi,
      plan: builderPlan
    });
  }

  async sign(plan: TxPlanArtifact, account?: HardkasAccount | string): Promise<SignedTxArtifact> {
    let resolvedAccount: HardkasAccount;
    if (typeof account === "string") {
      resolvedAccount = await this.sdk.accounts.resolve(account);
    } else if (account) {
      resolvedAccount = account;
    } else {
      if (!plan.from.accountName) throw new Error("Plan does not specify an account name and no account was provided for signing.");
      resolvedAccount = await this.sdk.accounts.resolve(plan.from.accountName);
    }

    return signTxPlanArtifact({
      planArtifact: plan,
      account: resolvedAccount,
      config: this.sdk.config.config
    });
  }

  async send(signed: SignedTxArtifact): Promise<TxReceiptArtifact> {
    const broadcastable = getBroadcastableSignedTransaction(signed);
    const result = await this.sdk.rpc.submitTransaction(broadcastable.rawTransaction);
    
    const txId = result.transactionId;
    if (!txId) throw new Error("Broadcast failed: RPC returned no transaction ID.");

    const receipt: TxReceiptArtifact = {
      schema: ARTIFACT_SCHEMAS.TX_RECEIPT,
      hardkasVersion: HARDKAS_VERSION,
      networkId: signed.networkId,
      mode: signed.mode,
      status: "submitted",
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      txId,
      sourceSignedId: signed.signedId,
      from: {
        address: signed.from.address,
        accountName: signed.from.accountName
      },
      to: {
        address: signed.to.address
      },
      amountSompi: signed.amountSompi,
      amount: signed.amount,
      feeSompi: (signed as any).estimatedFeeSompi || "0", 
      rpcUrl: (this.sdk.rpc as any).rpcUrl || "unknown"
    };

    // Auto-save receipt
    const receiptPath = getDefaultReceiptPath(txId, this.sdk.config.cwd);
    await writeArtifact(receiptPath, receipt);

    return {
      ...receipt,
      receiptPath
    };
  }

  async confirm(txId: string, options: { timeout?: number, interval?: number } = {}): Promise<TxReceiptArtifact> {
    const timeout = options.timeout || 60000;
    const interval = options.interval || 2000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      try {
        const txInfo = await this.sdk.rpc.getTransaction(txId);
        
        if (txInfo) {
           const info = await this.sdk.rpc.getInfo();
           const receiptPath = getDefaultReceiptPath(txId, this.sdk.config.cwd);
           const receipt = await readTxReceiptArtifact(receiptPath).catch(() => null);
           
           if (receipt) {
             const updated: TxReceiptArtifact = {
               ...receipt,
               status: (txInfo as any).blockHash ? "accepted" : "submitted",
               daaScore: String(info.virtualDaaScore || ""),
               blueScore: String((info.raw as any)?.blueScore || ""),
               confirmedAt: new Date().toISOString()
             };
             await writeArtifact(receiptPath, updated);
             if (updated.status === "accepted") return updated;
           }
        }
      } catch (e) {
        // Ignore errors during polling
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Transaction ${txId} confirmation timed out after ${timeout}ms`);
  }
}

/**
 * Sub-facade for L2/Igra capabilities.
 */
export class HardkasL2 {
  listProfiles(): readonly L2NetworkProfile[] {
    return listL2Profiles();
  }

  getProfile(name: string): L2NetworkProfile | null {
    return getL2Profile(name);
  }
}
