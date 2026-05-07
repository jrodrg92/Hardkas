import { buildPaymentPlan } from "@hardkas/tx-builder";
import type { LocalnetState, LocalnetUtxo } from "./types";
import { resolveAccountAddressFromState } from "./state";
import { getSpendableUtxos } from "./balance";

export interface SimulatedPaymentInput {
  readonly from: string;
  readonly to: string;
  readonly amountSompi: bigint;
  readonly feeRateSompiPerMass?: bigint;
}

export interface SimulatedTxReceipt {
  readonly version: 1;
  readonly kind: "hardkas.simulatedTxReceipt";
  readonly txId: string;
  readonly mode: "simulated";
  readonly networkId: "simnet";
  readonly fromAddress: string;
  readonly toAddress: string;
  readonly amountSompi: string;
  readonly feeSompi: string;
  readonly changeSompi?: string | undefined;
  readonly spentUtxoIds: readonly string[];
  readonly createdUtxoIds: readonly string[];
  readonly daaScore: string;
  readonly createdAt: string;
}

export interface ApplySimulatedPaymentResult {
  readonly state: LocalnetState;
  readonly receipt: SimulatedTxReceipt;
}

/**
 * Applies a simulated payment to the localnet state, updating balances and advancing DAA score.
 */
export function applySimulatedPayment(
  state: LocalnetState,
  input: SimulatedPaymentInput
): ApplySimulatedPaymentResult {
  const fromAddress = resolveAccountAddressFromState(state, input.from);
  const toAddress = resolveAccountAddressFromState(state, input.to);
  const amountSompi = input.amountSompi;
  const feeRateSompiPerMass = input.feeRateSompiPerMass ?? 1n;

  if (amountSompi <= 0n) {
    throw new Error("Amount must be greater than 0");
  }

  const unspent = getSpendableUtxos(state, fromAddress);
  if (unspent.length === 0) {
    throw new Error(`Insufficient funds: no unspent UTXOs for ${fromAddress}`);
  }

  const availableUtxos = unspent.map(u => {
    const parts = u.id.split(":");
    const index = Number(parts[parts.length - 1]);
    const transactionId = parts.slice(0, -1).join(":");
    return {
      outpoint: {
        transactionId,
        index
      },
      address: u.address,
      amountSompi: BigInt(u.amountSompi),
      scriptPublicKey: "mock-script"
    };
  });

  const plan = buildPaymentPlan({
    fromAddress,
    outputs: [
      {
        address: toAddress,
        amountSompi
      }
    ],
    availableUtxos,
    feeRateSompiPerMass
  });

  // Advance DAA Score
  const nextDaaScore = (BigInt(state.daaScore) + 1n).toString();
  const txId = `simtx_${nextDaaScore}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  const spentUtxoIds = plan.inputs.map(i => `${i.outpoint.transactionId}:${i.outpoint.index}`);
  
  // Mark inputs as spent
  const nextUtxos: LocalnetUtxo[] = state.utxos.map(u => {
    if (spentUtxoIds.includes(u.id)) {
      return {
        ...u,
        spent: true,
        spentAtDaaScore: nextDaaScore
      };
    }
    return u;
  });

  const createdUtxoIds: string[] = [];

  // Create recipient UTXO
  const recipientUtxo: LocalnetUtxo = {
    id: `${txId}:0`,
    address: toAddress,
    amountSompi: amountSompi.toString(),
    spent: false,
    createdAtDaaScore: nextDaaScore
  };
  nextUtxos.push(recipientUtxo);
  createdUtxoIds.push(recipientUtxo.id);

  // Create change UTXO
  let changeSompiStr: string | undefined;
  if (plan.change) {
    const changeUtxo: LocalnetUtxo = {
      id: `${txId}:1`,
      address: fromAddress,
      amountSompi: plan.change.amountSompi.toString(),
      spent: false,
      createdAtDaaScore: nextDaaScore
    };
    nextUtxos.push(changeUtxo);
    createdUtxoIds.push(changeUtxo.id);
    changeSompiStr = changeUtxo.amountSompi;
  }

  const nextState: LocalnetState = {
    ...state,
    daaScore: nextDaaScore,
    utxos: nextUtxos
  };

  const receipt: SimulatedTxReceipt = {
    version: 1,
    kind: "hardkas.simulatedTxReceipt",
    txId,
    mode: "simulated",
    networkId: "simnet",
    fromAddress,
    toAddress,
    amountSompi: amountSompi.toString(),
    feeSompi: plan.estimatedFeeSompi.toString(),
    changeSompi: changeSompiStr,
    spentUtxoIds,
    createdUtxoIds,
    daaScore: nextDaaScore,
    createdAt: new Date().toISOString()
  };

  return {
    state: nextState,
    receipt
  };
}
