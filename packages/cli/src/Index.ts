import { startSimulatedDevnet } from "@hardkas/localnet";

program
  .command("dev")
  .description("Start a local HardKAS development environment")
  .option("--mode <mode>", "Devnet mode: simulated or node", "simulated")
  .option("--accounts <count>", "Number of deterministic accounts", "5")
  .option("--balance <kas>", "Initial account balance in KAS", "1000")
  .action(async (options: { mode: string; accounts: string; balance: string }) => {
    if (options.mode !== "simulated") {
      console.error("Only simulated mode is implemented in v0.1.");
      console.error("Node mode will use rusty-kaspa/kaspad in the next phase.");
      process.exitCode = 1;
      return;
    }

    const accounts = Number.parseInt(options.accounts, 10);
    const initialBalanceSompi = BigInt(options.balance) * 100_000_000n;

    const devnet = await startSimulatedDevnet({
      accounts,
      initialBalanceSompi
    });

    console.log("HardKAS local devnet started");
    console.log("");
    console.log(`Mode: ${devnet.mode}`);
    console.log(`DAA score: ${devnet.chain.getDaaScore()}`);
    console.log("");
    console.log("Accounts:");

    for (const account of devnet.accounts) {
      console.log(
        `  ${account.name.padEnd(8)} ${account.address.padEnd(24)} ${account.balanceSompi / 100_000_000n} KAS`
      );
    }

    console.log("");
    console.log("Commands:");
    console.log("  hardkas tx simulate --from kaspa:sim_alice --to kaspa:sim_bob --amount 1");
    console.log("  hardkas faucet kaspa:sim_alice 100");
  });
