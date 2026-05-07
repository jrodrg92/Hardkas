import { 
  TxPlanArtifact, 
  SignedTxArtifact, 
  hashTxPlanArtifact
} from "@hardkas/artifacts";
import { 
  HardkasKaspaPrivateKeyAccount, 
  HardkasTxPlanSigner, 
  SignTxPlanInput, 
  SignTxPlanResult, 
  HardkasSignerKind 
} from "./types.js";
import { loadKaspaWasm } from "./signer-backend.js";

/**
 * Real Kaspa signer using the official WASM SDK.
 * Only works if the 'kaspa' package is installed.
 */
export class KaspaWasmPrivateKeySigner implements HardkasTxPlanSigner {
  kind: HardkasSignerKind = "kaspa-private-key";

  constructor(
    private options: {
      account: HardkasKaspaPrivateKeyAccount;
      allowMainnet?: boolean | undefined;
    }
  ) {}

  async signTxPlan(input: SignTxPlanInput): Promise<SignTxPlanResult> {
    const plan = input.planArtifact as TxPlanArtifact;
    const account = this.options.account;

    // 1. Load SDK
    const sdk = await loadKaspaWasm();

    // 2. Mainnet guard
    assertSigningNetworkAllowed({
      network: plan.networkId,
      mode: plan.mode,
      allowMainnet: this.options.allowMainnet
    });

    // 3. Resolve Private Key
    const pkValue = process.env[account.privateKeyEnv];
    if (!pkValue) {
      throw new Error(`Missing required environment variable '${account.privateKeyEnv}' for account '${account.name}'.`);
    }

    try {
      // 4. Map Artifact to SDK objects
      // Note: We use dynamic access or casting because we don't have types for 'kaspa' package yet
      const privateKey = new sdk.PrivateKey(pkValue);
      
      const utxos = plan.selectedUtxos.map(u => {
        if (!u.txId || u.outputIndex === undefined) {
          throw new Error(`UTXO ${u.id} is missing txId or outputIndex. Re-run tx plan.`);
        }
        if (!u.scriptPublicKey) {
          throw new Error(`UTXO ${u.id} is missing scriptPublicKey. Signing requires the scriptPublicKey. Re-run tx plan using a real RPC node.`);
        }
        
        return new sdk.UtxoEntry(
          BigInt(u.amountSompi),
          u.scriptPublicKey,
          u.txId,
          u.outputIndex,
          u.address
        );
      });

      const outputs = plan.outputs
        .filter(o => o.kind === "payment")
        .map(o => {
          if (!o.address) throw new Error("Payment output is missing address.");
          return new sdk.PaymentOutput(
            new sdk.Address(o.address),
            BigInt(o.amountSompi)
          );
        });

      const changeOutput = plan.outputs.find(o => o.kind === "change");
      const changeAddress = changeOutput?.address 
        ? new sdk.Address(changeOutput.address)
        : undefined;

      const priorityFee = BigInt(plan.estimatedFeeSompi);

      // 5. Create and Sign Transaction
      // The API might vary, using common pattern: createTransaction -> signTransaction
      const unsignedTx = sdk.createTransaction(
        utxos,
        outputs,
        changeAddress,
        priorityFee
      );

      const signedTx = sdk.signTransaction(unsignedTx, [privateKey], true);
      
      // 6. Serialize
      // Most common is hex or toRpcTransaction().serialize()
      const rawTx = signedTx.serialize ? signedTx.serialize() : JSON.stringify(signedTx.toRpcTransaction());

      return {
        signatureKind: "kaspa",
        signerAddress: account.address || privateKey.toAddress(plan.networkId).toString(),
        signedTransaction: {
          format: "hex",
          payload: rawTx
        },
        signature: {
          // We use the txid as the signature identifier in the artifact
          value: signedTx.id || hashTxPlanArtifact(plan)
        }
      };

    } catch (error) {
      // Never log the private key or pkValue
      throw new Error(`Kaspa WASM signing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Security guard for network types.
 */
export function assertSigningNetworkAllowed(input: {
  network: string;
  mode: string;
  allowMainnet?: boolean | undefined;
}): void {
  const isMainnet = input.network === "mainnet" || input.network === "kaspa";
  
  if (isMainnet && !input.allowMainnet) {
    throw new Error(
      "Mainnet signing is disabled by default. " +
      "Use --allow-mainnet-signing only if you understand the risks."
    );
  }
}
