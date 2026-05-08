import { buildPaymentPlan } from "@hardkas/tx-builder";
import type { LocalnetState, LocalnetUtxo } from "./types";
import { resolveAccountAddressFromState } from "./state";
import { getSpendableUtxos } from "./balance";
import { 
  createTxPlanArtifact, 
  createSimulatedTxReceipt, 
  TxReceiptArtifact 
} from "@hardkas/artifacts";

export interface SimulatedPaymentInput {
  readonly from: string;
  readonly to: string;
  readonly amountSompi: bigint;
  readonly feeRateSompiPerMass?: bigint;
}

export interface ApplySimulatedPaymentResult {
  readonly state: LocalnetState;
  readonly receipt: TxReceiptArtifact;
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

  const planArtifact = createTxPlanArtifact({
    networkId: "simnet",
    mode: "simulated",
    from: { input: input.from, address: fromAddress },
    to: { input: input.to, address: toAddress },
    amountSompi,
    plan
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
  }

  const nextState: LocalnetState = {
    ...state,
    daaScore: nextDaaScore,
    utxos: nextUtxos
  };

  const receipt = createSimulatedTxReceipt(planArtifact, txId, {
    spentUtxoIds,
    createdUtxoIds,
    daaScore: nextDaaScore
  });

  return {
    state: nextState,
    receipt
  };
}
