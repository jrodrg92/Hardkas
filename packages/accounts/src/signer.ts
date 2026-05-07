import { 
  TxPlanArtifact, 
  SignedTxArtifact,
  createSimulatedSignedTxArtifact,
  hashTxPlanArtifact,
  HARDKAS_VERSION,
  ARTIFACT_SCHEMAS
} from "@hardkas/artifacts";
import { HardkasAccount, HardkasTxPlanSigner, SignTxPlanInput, SignTxPlanResult, HardkasSignerKind, HardkasKaspaPrivateKeyAccount } from "./types.js";
import { HardkasConfig } from "@hardkas/config";
import { getKaspaSigningBackendStatus } from "./signer-backend.js";
import { KaspaWasmPrivateKeySigner, assertSigningNetworkAllowed } from "./kaspa-wasm-signer.js";

/**
 * Simulated signer for simnet development.
 * Produces deterministic signatures without real private keys.
 */
export class SimulatedTxPlanSigner implements HardkasTxPlanSigner {
  kind: HardkasSignerKind = "simulated";

  async signTxPlan(input: SignTxPlanInput): Promise<SignTxPlanResult> {
    const plan = input.planArtifact as TxPlanArtifact;
    const planHash = hashTxPlanArtifact(plan);

    return {
      signatureKind: "simulated",
      signerAddress: plan.from.address,
      signedTransaction: {
        format: "hex",
        payload: `simulated-signed-tx:${planHash}`
      },
      signature: {
        value: `simulated:${input.accountName}:${planHash}`
      }
    };
  }
}

/**
 * Placeholder for real Kaspa signing.
 * Throws error until an official Kaspa signing library is integrated.
 */
export class UnsupportedRealKaspaSigner implements HardkasTxPlanSigner {
  kind: HardkasSignerKind = "unsupported";

  async signTxPlan(_input: SignTxPlanInput): Promise<SignTxPlanResult> {
    throw new Error(
      "Real Kaspa signing requires an official Kaspa transaction signing library. " +
      "No supported signer backend is configured."
    );
  }
}

/**
 * Main entry point for signing transaction plan artifacts.
 * Resolves the appropriate signer based on the account kind and network.
 */
export async function signTxPlanArtifact(input: {
  planArtifact: TxPlanArtifact;
  account: HardkasAccount;
  config?: HardkasConfig;
  allowMainnet?: boolean;
}): Promise<SignedTxArtifact> {
  const { planArtifact, account } = input;

  // Security guardrails
  if (planArtifact.status !== "unsigned") {
    throw new Error(`Cannot sign artifact with status: ${planArtifact.status}`);
  }

  // Account and plan mode matching
  if (planArtifact.mode === "simulated") {
    if (account.kind !== "simulated") {
      throw new Error(`Simulated plans must be signed with simulated accounts (account '${account.name}' is '${account.kind}').`);
    }
  } else {
    if (account.kind === "simulated") {
      throw new Error(`Real Kaspa transaction plans (mode: ${planArtifact.mode}) cannot be signed with simulated accounts.`);
    }
  }

  // Block mainnet by default for safety
  // Block mainnet by default for safety
  if ((planArtifact.networkId === "mainnet" || planArtifact.networkId === "kaspa") && !input.allowMainnet) {
     throw new Error("Mainnet signing is disabled by default. Use --allow-mainnet-signing only if you understand the risks.");
  }

  if (account.kind === "simulated") {
    return createSimulatedSignedTxArtifact({
      plan: planArtifact,
      account: account.name,
      signerAddress: account.address
    });
  }

  if (account.kind === "kaspa-private-key") {
    const status = await getKaspaSigningBackendStatus();
    
    if (!status.available) {
      throw new Error(`Real Kaspa signing is not available: ${status.error || "Unknown error"}. Ensure 'kaspa' package is installed.`);
    }

    const signer = new KaspaWasmPrivateKeySigner({
      account: account as HardkasKaspaPrivateKeyAccount,
      allowMainnet: input.allowMainnet
    });

    const result = await signer.signTxPlan({
      planArtifact,
      accountName: account.name
    });

    return {
      schema: ARTIFACT_SCHEMAS.SIGNED_TX,
      hardkasVersion: HARDKAS_VERSION,
      status: "signed",
      createdAt: new Date().toISOString(),
      source: {
        schema: ARTIFACT_SCHEMAS.TX_PLAN,
        planHash: hashTxPlanArtifact(planArtifact)
      },
      networkId: planArtifact.networkId,
      mode: planArtifact.mode,
      from: planArtifact.from,
      to: planArtifact.to,
      amountSompi: planArtifact.amountSompi,
      amount: planArtifact.amount,
      selectedUtxos: planArtifact.selectedUtxos,
      outputs: planArtifact.outputs,
      estimatedMass: planArtifact.estimatedMass,
      estimatedFeeSompi: planArtifact.estimatedFeeSompi,
      estimatedFee: planArtifact.estimatedFee,
      changeSompi: planArtifact.changeSompi,
      change: planArtifact.change,
      signature: {
        kind: "kaspa",
        account: account.name,
        signerAddress: result.signerAddress,
        value: result.signature?.value || "unknown"
      },
      signedTransaction: result.signedTransaction ? {
        encoding: result.signedTransaction.format === "hex" ? "kaspa-raw" : "unknown",
        value: result.signedTransaction.payload
      } : undefined,
      metadata: {
        hardkasVersion: HARDKAS_VERSION,
        signingBackend: status.name,
        warning: "Broadcast not performed"
      }
    } as any;
  }

  if (account.kind === "external-wallet") {
    throw new Error("External wallet signing is not implemented yet.");
  }

  if (account.kind === "evm-private-key") {
    throw new Error("EVM accounts are reserved for future Igra support and cannot sign Kaspa L1 transactions.");
  }

  throw new Error(`Unsupported account kind for signing: ${(account as any).kind}`);
}
