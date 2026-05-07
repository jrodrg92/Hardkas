import { StoredSimulatedTxReceipt, loadSimulatedReceipt } from "./receipts";
import { StoredSimulatedTxTrace, loadSimulatedTrace } from "./traces";

export interface SimulatedReplaySummary {
  readonly receipt: StoredSimulatedTxReceipt;
  readonly trace: StoredSimulatedTxTrace;
  readonly summary: {
    readonly spentCount: number;
    readonly createdCount: number;
    readonly transferredSompi: bigint;
    readonly feeSompi: bigint;
    readonly changeSompi: bigint;
    readonly finalDaaScore: string;
  };
}

export async function getSimulatedReplaySummary(
  txId: string,
  options?: { cwd?: string }
): Promise<SimulatedReplaySummary> {
  const receipt = await loadSimulatedReceipt(txId, options);
  const trace = await loadSimulatedTrace(txId, options);

  return {
    receipt,
    trace,
    summary: {
      spentCount: receipt.spentUtxoIds.length,
      createdCount: receipt.createdUtxoIds.length,
      transferredSompi: BigInt(receipt.amountSompi),
      feeSompi: BigInt(receipt.feeSompi),
      changeSompi: BigInt(receipt.changeSompi || "0"),
      finalDaaScore: receipt.daaScore
    }
  };
}
