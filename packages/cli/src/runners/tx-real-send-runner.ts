import fs from "node:fs/promises";
import path from "node:path";
import { 
  readArtifact, 
  assertValidRealSignedTxArtifact,
  RealTxSubmitReceipt,
  assertValidRealTxSubmitReceipt,
  writeArtifact,
  HARDKAS_VERSION,
  ARTIFACT_SCHEMAS 
} from "@hardkas/artifacts";
import { 
  KaspaJsonRpcClient 
} from "@hardkas/kaspa-rpc";

export interface TxRealSendOptions {
  signedPath: string;
  url: string;
  yes: boolean;
}

export interface TxRealSendResult {
  txId: string;
  receiptPath: string;
  receipt: RealTxSubmitReceipt;
  formatted: string;
}

export async function runTxRealSend(options: TxRealSendOptions): Promise<TxRealSendResult> {
  // 1. Guardrail: --yes is required
  if (!options.yes) {
    throw new Error("Refusing to submit real transaction without --yes.");
  }

  // 2. Load and validate signed artifact
  const signedData = await readArtifact(options.signedPath);
  assertValidRealSignedTxArtifact(signedData);

  // 3. More Guardrails
  if (signedData.networkId === "mainnet") {
    throw new Error("Mainnet real transaction submission is disabled in this development release.");
  }

  if (signedData.status !== "signed") {
    throw new Error(`Invalid artifact status: expected 'signed', got '${signedData.status}'.`);
  }

  if (!signedData.signedTransaction.payload) {
    throw new Error("Signed transaction payload is empty.");
  }

  // 4. Submit to RPC
  const client = new KaspaJsonRpcClient({ url: options.url });
  
  let submitResult;
  try {
    submitResult = await client.submitTransaction(signedData.signedTransaction.payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Connection refused") || msg.includes("ECONNREFUSED")) {
      const error = new Error(`Cannot connect to Kaspa RPC at ${options.url}`);
      (error as any).suggestion = "The Kaspa node might still be starting. Try 'hardkas rpc health --wait --timeout 60'.";
      throw error;
    }
    throw e;
  }

  if (!submitResult.transactionId) {
    throw new Error("RPC accepted the transaction but did not return a transaction ID.");
  }

  const txId = submitResult.transactionId;

  // 5. Create Receipt
  const receipt: RealTxSubmitReceipt = {
    schema: ARTIFACT_SCHEMAS.REAL_TX_SUBMIT_RECEIPT,
    hardkasVersion: HARDKAS_VERSION,
    createdAt: new Date().toISOString(),
    status: "submitted",
    networkId: signedData.networkId,
    mode: signedData.mode,
    txId,
    sourceSignedId: signedData.signedId,
    sourceSignedPath: options.signedPath,
    submittedAt: new Date().toISOString(),
    rpcUrl: options.url,
    signedTransactionFormat: signedData.signedTransaction.format
  };

  assertValidRealTxSubmitReceipt(receipt);

  // 6. Save Receipt
  const receiptDir = path.join(".hardkas", "real-receipts");
  await fs.mkdir(receiptDir, { recursive: true });

  const receiptPath = path.join(receiptDir, `${txId}.json`);
  await writeArtifact(receiptPath, receipt);

  // 7. Format Output
  const lines = [
    "Real transaction submitted",
    "",
    `Tx ID:     ${txId}`,
    `Network:   ${receipt.networkId}`,
    `Mode:      ${receipt.mode}`,
    `Source:    ${options.signedPath}`,
    `RPC:       ${receipt.rpcUrl}`,
    "",
    "Receipt:",
    `  ${receiptPath}`,
    "",
    "Next:",
    "  Check mempool:",
    `    hardkas rpc mempool ${txId}`
  ];

  return {
    txId,
    receiptPath,
    receipt,
    formatted: lines.join("\n")
  };
}
