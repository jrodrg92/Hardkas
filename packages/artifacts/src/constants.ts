export const HARDKAS_VERSION = "0.1.0-dev";

export const ARTIFACT_SCHEMAS = {
  LOCALNET_STATE: "hardkas.localnetState.v1",
  REAL_ACCOUNT_STORE: "hardkas.realAccountStore.v1",
  TX_PLAN: "hardkas.txPlan.v1",
  SIGNED_TX: "hardkas.signedTx.v1",
  TX_RECEIPT: "hardkas.txReceipt.v1",
  TX_TRACE: "hardkas.txTrace.v1",
  IGRA_TX_PLAN: "hardkas.igraTxPlan.v1",
  IGRA_SIGNED_TX: "hardkas.igraSignedTx.v1",
  IGRA_TX_RECEIPT: "hardkas.igraTxReceipt.v1"
} as const;

export type HardkasArtifactSchema = typeof ARTIFACT_SCHEMAS[keyof typeof ARTIFACT_SCHEMAS];

export type HardkasArtifactMode = "simulated" | "node" | "rpc" | "l2-rpc";
