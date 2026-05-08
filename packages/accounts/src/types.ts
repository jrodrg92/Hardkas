export type HardkasAccountKind =
  | "simulated"
  | "kaspa-private-key"
  | "external-wallet"
  | "evm-private-key";

export interface HardkasBaseAccount {
  name: string;
  kind: HardkasAccountKind;
  address?: string;
}

export interface HardkasSimulatedAccount extends HardkasBaseAccount {
  kind: "simulated";
  address: string;
}

export interface HardkasKaspaPrivateKeyAccount extends HardkasBaseAccount {
  kind: "kaspa-private-key";
  privateKeyEnv?: string | undefined;
  address?: string;
}

export interface HardkasExternalWalletAccount extends HardkasBaseAccount {
  kind: "external-wallet";
  walletId?: string;
  address?: string;
}

export interface HardkasEvmPrivateKeyAccount extends HardkasBaseAccount {
  kind: "evm-private-key";
  privateKeyEnv?: string | undefined;
  address?: string;
}

export type HardkasAccount =
  | HardkasSimulatedAccount
  | HardkasKaspaPrivateKeyAccount
  | HardkasExternalWalletAccount
  | HardkasEvmPrivateKeyAccount;

export type HardkasSignerKind =
  | "simulated"
  | "kaspa-private-key"
  | "external-wallet"
  | "unsupported";

export interface SignTxPlanInput {
  planArtifact: any; // Using any here to avoid circular dependency with @hardkas/artifacts if needed, or cast later
  accountName: string;
}

export interface SignTxPlanResult {
  signatureKind: "simulated" | "kaspa";
  signerAddress?: string;
  signedTransaction?: {
    format: "hex" | "json" | "simulated" | "unknown";
    payload: string;
  };
  signature?: {
    value: string;
  };
}

export interface HardkasTxPlanSigner {
  kind: HardkasSignerKind;
  signTxPlan(input: SignTxPlanInput): Promise<SignTxPlanResult>;
}

export interface HardkasSigner<TTx = unknown, TSignedTx = unknown> {
  account: HardkasAccount;
  signTransaction(tx: TTx): Promise<TSignedTx>;
}
