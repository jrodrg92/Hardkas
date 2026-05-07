export interface LocalnetAccount {
  name: string;
  address: string;
}

export interface LocalnetUtxo {
  id: string;
  address: string;
  amountSompi: string; // string for JSON compatibility (BigInt)
  spent: boolean;
  createdAtDaaScore: string;
  spentAtDaaScore?: string;
}

export interface LocalnetSnapshot {
  id: string;
  name?: string | undefined;
  createdAt: string;
  daaScore: string;
  accounts: LocalnetAccount[];
  utxos: LocalnetUtxo[];
}

export interface LocalnetState {
  version: number;
  kind: "hardkas.localnetState";
  mode: "simulated";
  networkId: "simnet";
  daaScore: string;
  accounts: LocalnetAccount[];
  utxos: LocalnetUtxo[];
  snapshots?: LocalnetSnapshot[];
}
