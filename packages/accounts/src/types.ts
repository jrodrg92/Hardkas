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
  privateKeyEnv: string;
  address?: string;
}

export interface HardkasExternalWalletAccount extends HardkasBaseAccount {
  kind: "external-wallet";
  walletId?: string;
  address?: string;
}

export interface HardkasEvmPrivateKeyAccount extends HardkasBaseAccount {
  kind: "evm-private-key";
  privateKeyEnv: string;
  address?: string;
}

export type HardkasAccount =
  | HardkasSimulatedAccount
  | HardkasKaspaPrivateKeyAccount
  | HardkasExternalWalletAccount
  | HardkasEvmPrivateKeyAccount;

export interface HardkasSigner<TTx = unknown, TSignedTx = unknown> {
  account: HardkasAccount;
  signTransaction(tx: TTx): Promise<TSignedTx>;
}
