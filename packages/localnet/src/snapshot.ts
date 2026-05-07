import type { LocalnetState, LocalnetSnapshot } from "./types";

export function createLocalnetSnapshot(
  state: LocalnetState,
  name?: string
): LocalnetState {
  const snapshot: LocalnetSnapshot = {
    id: `snap-${Date.now().toString(36)}`,
    name,
    createdAt: new Date().toISOString(),
    daaScore: state.daaScore,
    accounts: JSON.parse(JSON.stringify(state.accounts)),
    utxos: JSON.parse(JSON.stringify(state.utxos))
  };

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
    s => s.id === snapshotIdOrName || s.name === snapshotIdOrName
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
