
export interface HardkasAccount {
  readonly name: string;
  readonly address: string;
  readonly balanceSompi: bigint;
}

export function createDeterministicAccounts(input?: {
  readonly count?: number;
  readonly initialBalanceSompi?: bigint;
}): HardkasAccount[] {
  const count = input?.count ?? 5;
  const initialBalanceSompi = input?.initialBalanceSompi ?? 1000n * 100_000_000n;

  const names = ["alice", "bob", "carol", "dave", "erin"];

  return Array.from({ length: count }, (_, index) => {
    const name = names[index] ?? `account${index}`;

    return {
      name,
      address: `kaspa:sim_${name}`,
      balanceSompi: initialBalanceSompi
    };
  });
}
