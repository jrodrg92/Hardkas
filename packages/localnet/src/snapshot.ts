import { 
  SnapshotV2, 
  HARDKAS_VERSION, 
  ARTIFACT_V2_VERSION,
  calculateContentHash,
  sortUtxosByOutpoint
} from "@hardkas/artifacts";
import type { LocalnetState } from "./types";

export function createLocalnetSnapshot(
  state: LocalnetState,
  name?: string
): LocalnetState {
  // Deterministic sorting of UTXOs for hashing
  const sortedUtxos = sortUtxosByOutpoint(state.utxos);

  const snapshot: any = {
    schema: "hardkas.snapshot.v2",
    hardkasVersion: HARDKAS_VERSION,
    version: ARTIFACT_V2_VERSION,
    createdAt: new Date().toISOString(),
    daaScore: state.daaScore,
    accounts: JSON.parse(JSON.stringify(state.accounts)),
    utxos: JSON.parse(JSON.stringify(sortedUtxos))
  };

  snapshot.contentHash = calculateContentHash(snapshot);

  return {
    ...state,
    snapshots: [...(state.snapshots || []), snapshot]
  };
}

export function restoreLocalnetSnapshot(
  state: LocalnetState,
  snapshotIdOrName: string
): LocalnetState {
  const snapshot = state.snapshots?.find(
    (s: any) => s.id === snapshotIdOrName || s.name === snapshotIdOrName || s.contentHash === snapshotIdOrName
  );

  if (!snapshot) {
    throw new Error(`Snapshot not found: ${snapshotIdOrName}`);
  }

  return {
    ...state,
    daaScore: snapshot.daaScore,
    accounts: JSON.parse(JSON.stringify(snapshot.accounts)),
    utxos: JSON.parse(JSON.stringify(snapshot.utxos))
  };
}
