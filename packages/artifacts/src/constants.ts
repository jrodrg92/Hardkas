export const HARDKAS_VERSION = "0.1.0-dev";

export const ARTIFACT_SCHEMAS = {
  LOCALNET_STATE: "hardkas.localnetState.v1",
  REAL_ACCOUNT_STORE: "hardkas.realAccountStore.v1",
  TX_PLAN: "hardkas.txPlan.v2",
  SIGNED_TX: "hardkas.signedTx.v2",
  TX_RECEIPT: "hardkas.txReceipt.v2",
  TX_TRACE: "hardkas.txTrace.v2",
  SNAPSHOT: "hardkas.snapshot.v2",
  IGRA_TX_PLAN: "hardkas.igraTxPlan.v1",
  IGRA_SIGNED_TX: "hardkas.igraSignedTx.v1",
  IGRA_TX_RECEIPT: "hardkas.igraTxReceipt.v1"
} as const;

export type HardkasArtifactSchema = typeof ARTIFACT_SCHEMAS[keyof typeof ARTIFACT_SCHEMAS] | string;

export type HardkasArtifactMode = "simulated" | "node" | "rpc" | "l2-rpc" | "real";
