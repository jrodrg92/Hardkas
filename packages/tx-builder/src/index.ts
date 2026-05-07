export type Sompi = bigint;

export interface Outpoint {
  readonly transactionId: string;
  readonly index: number;
}

export interface Utxo {
  readonly outpoint: Outpoint;
  readonly address: string;
  readonly amountSompi: Sompi;
  readonly scriptPublicKey: string;
  readonly blockDaaScore?: bigint;
  readonly isCoinbase?: boolean;
}

export interface TxOutput {
  readonly address: string;
  readonly amountSompi: Sompi;
  /** Future: Silverscript / custom script support */
  readonly scriptPublicKey?: string;
}

export interface TxBuildRequest {
  readonly fromAddress: string;
  readonly outputs: readonly TxOutput[];
  readonly availableUtxos: readonly Utxo[];
  readonly feeRateSompiPerMass: bigint;
  readonly changeAddress?: string;
  readonly payloadBytes?: number;
}

export interface TxPlan {
  readonly inputs: readonly Utxo[];
  readonly outputs: readonly TxOutput[];
  readonly change?: TxOutput | undefined;
  readonly estimatedMass: bigint;
  readonly estimatedFeeSompi: bigint;
}

export function buildPaymentPlan(request: TxBuildRequest): TxPlan {
  if (request.outputs.length === 0) {
    throw new Error("At least one transaction output is required.");
  }

  const target = request.outputs.reduce(
    (sum, output) => sum + output.amountSompi,
    0n
  );

  if (target <= 0n) {
    throw new Error("Transaction amount must be positive.");
  }

  const sortedUtxos = [...request.availableUtxos].sort((a, b) =>
    a.amountSompi < b.amountSompi ? -1 : a.amountSompi > b.amountSompi ? 1 : 0
  );

  const selected: Utxo[] = [];
  let selectedAmount = 0n;

  for (const utxo of sortedUtxos) {
    selected.push(utxo);
    selectedAmount += utxo.amountSompi;

    const estimatedMass = estimateMass({
      inputCount: selected.length,
      outputCount: request.outputs.length + 1,
      payloadBytes: request.payloadBytes ?? 0
    });

    const estimatedFeeSompi = estimatedMass * request.feeRateSompiPerMass;

    if (selectedAmount >= target + estimatedFeeSompi) {
      const changeAmount = selectedAmount - target - estimatedFeeSompi;

      return {
        inputs: selected,
        outputs: request.outputs,
        change:
          changeAmount > 0n
            ? {
                address: request.changeAddress ?? request.fromAddress,
                amountSompi: changeAmount
              }
            : undefined,
        estimatedMass,
        estimatedFeeSompi
      };
    }
  }

  throw new Error("Insufficient funds for transaction amount plus estimated fee.");
}

export function estimateMass(input: {
  readonly inputCount: number;
  readonly outputCount: number;
  readonly payloadBytes: number;
}): bigint {
  if (input.inputCount <= 0) {
    throw new Error("inputCount must be positive.");
  }

  if (input.outputCount <= 0) {
    throw new Error("outputCount must be positive.");
  }

  const baseMass = 100n;
  const inputMass = BigInt(input.inputCount) * 150n;
  const outputMass = BigInt(input.outputCount) * 50n;
  const payloadMass = BigInt(input.payloadBytes);

  return baseMass + inputMass + outputMass + payloadMass;
}

export function createMockUtxo(input: {
  readonly address: string;
  readonly amountSompi: bigint;
  readonly index?: number;
}): Utxo {
  return {
    outpoint: {
      transactionId: `mock-${input.address}-${input.index ?? 0}`,
      index: input.index ?? 0
    },
    address: input.address,
    amountSompi: input.amountSompi,
    scriptPublicKey: "mock-script"
  };
  }
