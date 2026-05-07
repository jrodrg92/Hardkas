export const HARDKAS_VERSION = "0.1.0-dev";

export const ARTIFACT_SCHEMAS = {
  LOCALNET_STATE: "hardkas.localnetState.v1",
  REAL_ACCOUNT_STORE: "hardkas.realAccountStore.v1",
  SIMULATED_TX_RECEIPT: "hardkas.simulatedTxReceipt.v1",
  SIMULATED_TX_TRACE: "hardkas.simulatedTxTrace.v1",
  REAL_TX_PLAN: "hardkas.realTxPlan.v1",
  REAL_SIGNED_TX: "hardkas.realSignedTx.v1",
  REAL_TX_SUBMIT_RECEIPT: "hardkas.realTxSubmitReceipt.v1",
  TX_PLAN: "hardkas.txPlan.v1",
  SIGNED_TX: "hardkas.signedTx.v1"
} as const;

export type HardkasArtifactSchema = typeof ARTIFACT_SCHEMAS[keyof typeof ARTIFACT_SCHEMAS];

export type HardkasArtifactMode = "simulated" | "node" | "rpc";
