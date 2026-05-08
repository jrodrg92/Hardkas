import { HardkasArtifactBase, SnapshotV2 } from "@hardkas/artifacts";

export interface LocalnetAccount {
  name: string;
  address: string;
}

export interface LocalnetUtxo {
  id: string;
  address: string;
  amountSompi: string; 
  spent: boolean;
  createdAtDaaScore: string;
  spentAtDaaScore?: string;
}

export interface LocalnetState extends HardkasArtifactBase {
  schema: "hardkas.localnetState.v1";
  mode: "simulated";
  networkId: "simnet";
  daaScore: string;
  accounts: LocalnetAccount[];
  utxos: LocalnetUtxo[];
  snapshots?: SnapshotV2[];
}
