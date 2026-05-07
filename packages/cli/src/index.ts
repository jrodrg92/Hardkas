#!/usr/bin/env node

import { Command } from "commander";
import { formatSompi, parseKasToSompi, SOMPI_PER_KAS } from "@hardkas/core";
import { startSimulatedDevnet } from "@hardkas/localnet";
import { TxSimulator } from "@hardkas/simulator";
import { buildPaymentPlan, createMockUtxo } from "@hardkas/tx-builder";

const program = new Command();

program
  .name("hardkas")
  .description("Developer toolkit for Kaspa applications")
  .version("0.1.0");

program
  .command("init")
  .description("Create a new HardKAS project")
  .argument("[directory]", "Project directory", ".")
  .action(async (directory: string) => {
    console.log(`Initializing HardKAS project in ${directory}`);
    console.log("v0.1 scaffold command placeholder");
  });

program
  .command("dev")
  .description("Start a local HardKAS development environment")
  .option("--mode <mode>", "Devnet mode: simulated or node", "simulated")
  .option("--accounts <count>", "Number of deterministic accounts", "5")
  .option("--balance <kas>", "Initial account balance in KAS", "1000")
  .action(
    async (options: {
      mode: string;
      accounts: string;
      balance: string;
    }) => {
      if (options.mode !== "simulated") {
        console.error("Only simulated mode is implemented in v0.1.");
        console.error("Node mode will use rusty-kaspa/kaspad in the next phase.");
        process.exitCode = 1;
        return;
      }

      const accountCount = Number.parseInt(options.accounts, 10);

      if (!Number.isInteger(accountCount) || accountCount <= 0) {
        console.error("--accounts must be a positive integer.");
        process.exitCode = 1;
        return;
      }

      const initialBalanceSompi = BigInt(options.balance) * SOMPI_PER_KAS;

      const devnet = await startSimulatedDevnet({
        accounts: accountCount,
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
          `  ${account.name.padEnd(8)} ${account.address.padEnd(24)} ${formatSompi(
            account.balanceSompi
          )}`
        );
      }

      console.log("");
      console.log("Commands:");
      console.log(
        "  hardkas tx simulate --from kaspa:sim_alice --to kaspa:sim_bob --amount 1"
      );
      console.log("  hardkas faucet kaspa:sim_alice 100");
    }
  );

program
  .command("faucet")
  .description("Fund an address in the local simulated devnet")
  .argument("<address>", "Address or account name")
  .argument("<amount>", "Amount in KAS")
  .action(async (address: string, amount: string) => {
    console.log(`Funding ${address} with ${amount} KAS`);
    console.log("");
    console.log("v0.1 note:");
    console.log(
      "Persistent localnet state is not implemented yet, so this command is currently a placeholder."
    );
  });

const tx = program.command("tx").description("Transaction commands");

tx.command("simulate")
  .description("Simulate a Kaspa payment transaction")
  .requiredOption("--to <address>", "Recipient address")
  .requiredOption("--amount <kas>", "Amount in KAS")
  .option("--from <address>", "Sender address", "kaspa:sim_alice")
  .option("--fee-rate <sompiPerMass>", "Fee rate in sompi per mass", "1")
  .action(
    async (options: {
      to: string;
      amount: string;
      from: string;
      feeRate: string;
    }) => {
      const amountSompi = parseKasToSompi(options.amount);
      const feeRateSompiPerMass = BigInt(options.feeRate);

      const plan = buildPaymentPlan({
        fromAddress: options.from,
        outputs: [
          {
            address: options.to,
            amountSompi
          }
        ],
        availableUtxos: [
          createMockUtxo({
            address: options.from,
            amountSompi: amountSompi + 100n * SOMPI_PER_KAS,
            index: 0
          })
        ],
        feeRateSompiPerMass
      });

      const simulator = new TxSimulator();

      const result = await simulator.simulate([
        "resolve-account",
        "resolve-utxos",
        "select-utxos",
        "estimate-mass",
        "estimate-fee",
        "build",
        "validate-local"
      ]);

      if (!result.ok) {
        console.error("Simulation failed");
        console.error(JSON.stringify(result.events, null, 2));
        process.exitCode = 1;
        return;
      }

      console.log("Simulation OK");
      console.log("");
      console.log(`From: ${options.from}`);
      console.log(`To: ${options.to}`);
      console.log(`Amount: ${formatSompi(amountSompi)}`);
      console.log("");
      console.log(`Selected UTXOs: ${plan.inputs.length}`);
      console.log(`Outputs: ${plan.outputs.length + (plan.change ? 1 : 0)}`);
      console.log(`Estimated mass: ${plan.estimatedMass}`);
      console.log(`Estimated fee: ${formatSompi(plan.estimatedFeeSompi)}`);

      if (plan.change) {
        console.log(`Change: ${formatSompi(plan.change.amountSompi)}`);
      }

      console.log("");
      console.log("Trace:");

      for (const event of result.events) {
        if (event.type === "phase.completed") {
          console.log(`✓ ${event.phase}`);
        }
      }
    }
  );

program
  .command("wallet")
  .description("Wallet commands")
  .command("detect")
  .description("Detect installed Kaspa wallet providers")
  .action(async () => {
    console.log("Wallet detection placeholder");
    console.log(
      "No browser wallet providers are available from the Node.js CLI context yet."
    );
  });

program
  .command("trace")
  .description("Trace commands")
  .argument("[txId]", "Transaction id")
  .action(async (txId?: string) => {
    console.log(`Trace placeholder${txId ? ` for ${txId}` : ""}`);
  });

program
  .command("replay")
  .description("Replay a saved HardKAS trace")
  .argument("<traceFile>", "Trace JSON file")
  .action(async (traceFile: string) => {
    console.log(`Replay placeholder for ${traceFile}`);
  });

await program.parseAsync(process.argv);
