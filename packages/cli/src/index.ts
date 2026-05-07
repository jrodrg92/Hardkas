#!/usr/bin/env node

import { Command } from "commander";
import { formatSompi, parseKasToSompi, SOMPI_PER_KAS } from "@hardkas/core";
import { 
  startSimulatedDevnet, 
  resolveAccountAddress, 
  createDeterministicAccounts,
  loadOrCreateLocalnetState,
  getDefaultLocalnetStatePath,
  getAccountBalanceSompi,
  getAddressBalanceSompi
} from "@hardkas/localnet";
import { TxSimulator } from "@hardkas/simulator";
import { buildPaymentPlan, createMockUtxo } from "@hardkas/tx-builder";
import { runTxPlan } from "./runners/tx-plan-runner.js";
import { runTxSign } from "./runners/tx-sign-runner.js";
import { runTxSend } from "./runners/tx-send-runner.js";
import { runTxFlow } from "./runners/tx-flow.js";
import { bigIntReplacer } from "@hardkas/artifacts";

const program = new Command();

program
  .name("hardkas")
  .description("Developer toolkit for Kaspa applications")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a new HardKAS project")
  .option("--force", "Overwrite existing hardkas.config.ts", false)
  .action(async (options: { force: boolean }) => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const configFile = path.join(process.cwd(), "hardkas.config.ts");

    if (fs.existsSync(configFile) && !options.force) {
      console.log("hardkas.config.ts already exists. Use --force to overwrite.");
      return;
    }

    const template = `import { defineHardkasConfig } from "@hardkas/config";

export default defineHardkasConfig({
  defaultNetwork: "simnet",

  networks: {
    simnet: {
      kind: "simulated"
    },

    devnet: {
      kind: "kaspa-node",
      network: "devnet",
      rpcUrl: "ws://127.0.0.1:18310"
    },

    testnet10: {
      kind: "kaspa-rpc",
      network: "testnet-10",
      rpcUrl: "ws://127.0.0.1:18210"
    }
  },

  accounts: {
    alice: {
      kind: "simulated",
      address: "kaspa:sim_alice"
    },
    bob: {
      kind: "simulated",
      address: "kaspa:sim_bob"
    },
    carol: {
      kind: "simulated",
      address: "kaspa:sim_carol"
    }
  }
});
`;

    fs.writeFileSync(configFile, template);
    console.log("HardKAS project initialized");
    console.log("");
    console.log(`Created: ${path.basename(configFile)}`);
    console.log("");
    console.log("Next:");
    console.log("  hardkas dev");
    console.log("  hardkas tx simulate --from alice --to bob --amount 1");
    console.log("  hardkas accounts list");
    console.log("  hardkas node doctor --network devnet");
    console.log("  hardkas rpc health --network devnet");
  });

const configCmd = program.command("config").description("Manage HardKAS configuration");

configCmd.command("show")
  .description("Show the current HardKAS configuration")
  .option("--config <path>", "Path to config file")
  .option("--json", "Output as JSON", false)
  .action(async (options: { config?: string, json: boolean }) => {
    const { loadHardkasConfig } = await import("@hardkas/config");
    const loaded = await loadHardkasConfig({ configPath: options.config });

    if (options.json) {
      console.log(JSON.stringify(loaded, null, 2));
      return;
    }

    console.log("HardKAS config");
    console.log("");
    console.log(`Path: ${loaded.path || "defaults"}`);
    console.log(`Default network: ${loaded.config.defaultNetwork || "simnet"}`);
    console.log("");
    
    if (loaded.config.accounts) {
       for (const acc of Object.values(loaded.config.accounts)) {
         if ((acc as any).privateKey) {
           console.warn("WARNING: Do not store private keys directly in hardkas.config.ts. Use privateKeyEnv instead.");
           break;
         }
       }
    }

    console.log("Networks:");
    
    const networks = loaded.config.networks || {};
    for (const [name, target] of Object.entries(networks)) {
      console.log(`  ${name}`);
      console.log(`    kind: ${target.kind}`);
      if (target.kind === "kaspa-node" || target.kind === "kaspa-rpc") {
        console.log(`    network: ${target.network}`);
        if (target.rpcUrl) console.log(`    rpcUrl: ${target.rpcUrl}`);
      }
      if (target.kind === "igra") {
        console.log(`    chainId: ${target.chainId}`);
        console.log(`    rpcUrl: ${target.rpcUrl}`);
      }
      console.log("");
    }

    if (loaded.config.accounts) {
      console.log("Accounts:");
      for (const [name, acc] of Object.entries(loaded.config.accounts)) {
        console.log(`  ${name} (${acc.kind})`);
      }
      console.log("");
    }
  });

const accountsCmd = program.command("accounts").description("Manage HardKAS accounts");

accountsCmd.command("list")
  .description("List available HardKAS accounts")
  .option("--config <path>", "Path to config file")
  .option("--json", "Output as JSON", false)
  .action(async (options: { config?: string, json: boolean }) => {
    const { loadHardkasConfig } = await import("@hardkas/config");
    const { listHardkasAccounts, describeAccount } = await import("@hardkas/accounts");
    
    const loaded = await loadHardkasConfig({ configPath: options.config });
    const accounts = listHardkasAccounts(loaded.config);

    if (options.json) {
      console.log(JSON.stringify(accounts.map(a => describeAccount(a)), null, 2));
      return;
    }

    console.log("HardKAS accounts");
    console.log("");
    for (const acc of accounts) {
      console.log(`${acc.name}`);
      console.log(`  kind:    ${acc.kind}`);
      if (acc.address) {
        console.log(`  address: ${acc.address}`);
      }
      if (acc.kind === "kaspa-private-key" || acc.kind === "evm-private-key") {
        console.log(`  privateKey: env:${acc.privateKeyEnv}`);
      }
      console.log("");
    }
  });

accountsCmd.command("show")
  .description("Show details of a specific account")
  .argument("<name>", "Account name")
  .option("--config <path>", "Path to config file")
  .option("--json", "Output as JSON", false)
  .action(async (name: string, options: { config?: string, json: boolean }) => {
    const { loadHardkasConfig } = await import("@hardkas/config");
    const { resolveHardkasAccount, describeAccount } = await import("@hardkas/accounts");
    
    const loaded = await loadHardkasConfig({ configPath: options.config });
    
    try {
      const acc = resolveHardkasAccount({ nameOrAddress: name, config: loaded.config });
      
      if (options.json) {
        console.log(JSON.stringify(describeAccount(acc), null, 2));
        return;
      }

      console.log("HardKAS account");
      console.log("");
      console.log(`Name:    ${acc.name}`);
      console.log(`Kind:    ${acc.kind}`);
      if (acc.address) {
        console.log(`Address: ${acc.address}`);
      }
      if (acc.kind === "kaspa-private-key" || acc.kind === "evm-private-key") {
        console.log(`Private key: env:${acc.privateKeyEnv}`);
      }
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exitCode = 1;
    }
  });

accountsCmd.command("resolve")
  .description("Resolve an account name to a Kaspa address")
  .argument("<name>", "Account name or address")
  .option("--config <path>", "Path to config file")
  .action(async (name: string, options: { config?: string }) => {
    const { loadHardkasConfig } = await import("@hardkas/config");
    const { resolveAccountAddress } = await import("@hardkas/accounts");
    
    const loaded = await loadHardkasConfig({ configPath: options.config });
    
    try {
      const address = resolveAccountAddress(name, loaded.config);
      console.log(address);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exitCode = 1;
    }
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

      const localState = await loadOrCreateLocalnetState({
        accounts: accountCount,
        initialBalanceSompi
      });

      console.log("HardKAS local devnet");
      console.log("");
      console.log(`Mode:      ${localState.mode}`);
      console.log(`Network:   ${localState.networkId}`);
      console.log(`State:     ${getDefaultLocalnetStatePath()}`);
      console.log(`DAA score: ${localState.daaScore}`);
      console.log("");
      console.log(`Consensus: not running`);
      console.log(`DAG:       not simulated`);
      console.log("");
      console.log("Accounts:");

      for (const account of localState.accounts) {
        const balanceSompi = getAddressBalanceSompi(localState, account.address);
        console.log(
          `  ${account.name.padEnd(8)} ${account.address.padEnd(24)} ${formatSompi(
            balanceSompi
          )}`
        );
      }

      console.log("");
      console.log("Commands:");
      console.log(
        "  hardkas tx simulate --from alice --to bob --amount 1"
      );
      console.log("  hardkas faucet alice 100");
    }
  );

program
  .command("faucet")
  .description("Fund an address in the local simulated devnet")
  .argument("<address>", "Address or account name")
  .argument("<amount>", "Amount in KAS")
  .action(async (address: string, amount: string) => {
    const { 
      loadOrCreateLocalnetState, 
      saveLocalnetState, 
      fundAddress, 
      resolveAccountAddressFromState,
      getAccountBalanceSompi
    } = await import("@hardkas/localnet");
    
    try {
      const state = await loadOrCreateLocalnetState();
      const resolvedAddress = resolveAccountAddressFromState(state, address);
      const amountSompi = parseKasToSompi(amount);

      const nextState = fundAddress(state, {
        address: resolvedAddress,
        amountSompi
      });

      await saveLocalnetState(nextState);

      const newBalanceSompi = getAccountBalanceSompi(nextState, resolvedAddress);

      console.log("HardKAS faucet");
      console.log("");
      console.log(`Address:     ${resolvedAddress}${address !== resolvedAddress ? ` (${address})` : ""}`);
      console.log(`Funded:      ${amount} KAS`);
      console.log(`New balance: ${formatSompi(newBalanceSompi)}`);
      console.log(`DAA score:   ${nextState.daaScore}`);
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

const tx = program.command("tx").description("Transaction commands");

tx.command("flow")
  .description("End-to-end transaction workflow: plan -> sign -> send")
  .requiredOption("--from <accountOrAddress>", "Sender account name or address")
  .requiredOption("--to <accountOrAddress>", "Recipient account name or address")
  .requiredOption("--amount <kas>", "Amount in KAS")
  .option("--network <network>", "Kaspa network name or config target", "simnet")
  .option("--config <path>", "Path to config file")
  .option("--url <wsUrl>", "Direct RPC WebSocket URL")
  .option("--fee-rate <sompiPerMass>", "Fee rate in sompi per mass", "1")
  .option("--plan-only", "Only plan the transaction, don't sign or send", false)
  .option("--sign", "Plan and sign the transaction", false)
  .option("--send", "Plan, sign, and send the transaction (implies --sign)", false)
  .option("--yes", "Confirm broadcast without prompt", false)
  .option("--out-dir <dir>", "Directory to save artifacts")
  .option("--name <name>", "Base name for artifacts")
  .option("--json", "Output results as JSON", false)
  .option("--allow-mainnet-signing", "Allow signing for mainnet", false)
  .option("--allow-mainnet-broadcast", "Allow broadcasting to mainnet", false)
  .action(async (options: {
    from: string;
    to: string;
    amount: string;
    network: string;
    config?: string;
    url?: string;
    feeRate: string;
    planOnly: boolean;
    sign: boolean;
    send: boolean;
    yes: boolean;
    outDir?: string;
    name?: string;
    json: boolean;
    allowMainnetSigning: boolean;
    allowMainnetBroadcast: boolean;
  }) => {
    const { loadHardkasConfig } = await import("@hardkas/config");
    const { formatTxPlanArtifact, formatSignedTxArtifact } = await import("@hardkas/artifacts");

    try {
      const loaded = await loadHardkasConfig({ configPath: options.config });
      const result = await runTxFlow({
        ...options,
        config: loaded.config
      });

      if (options.json) {
        console.log(JSON.stringify(result, bigIntReplacer, 2));
        if (!result.ok) process.exitCode = 1;
        return;
      }

      console.log("HardKAS tx flow");
      console.log("");

      // Step 1: Plan
      console.log("Step 1/3: plan");
      if (result.steps.plan.status === "ok") {
        console.log("  Status: ok");
        if (result.steps.plan.artifactPath) {
          console.log(`  Artifact: ${result.steps.plan.artifactPath}`);
        }
      } else {
        console.log(`  Status: ${result.steps.plan.status}`);
        if (result.steps.plan.error) console.log(`  Error: ${result.steps.plan.error}`);
      }

      // Step 2: Sign
      console.log("Step 2/3: sign");
      if (result.steps.sign.status === "ok") {
        console.log("  Status: ok");
        console.log(`  Signature: ${result.steps.sign.artifact?.signature.kind || "unknown"}`);
        if (result.steps.sign.artifactPath) {
          console.log(`  Artifact: ${result.steps.sign.artifactPath}`);
        }
      } else {
        console.log(`  Status: ${result.steps.sign.status}`);
        if (result.steps.sign.reason) console.log(`  Reason: ${result.steps.sign.reason}`);
        if (result.steps.sign.error) console.log(`  Error: ${result.steps.sign.error}`);
      }

      // Step 3: Send
      console.log("Step 3/3: send");
      if (result.steps.send.status === "ok") {
        console.log("  Status: ok");
        console.log(`  Tx ID: ${result.steps.send.artifact?.transactionId || "unknown"}`);
        console.log(`  Accepted: ${result.steps.send.artifact?.accepted ? "yes" : "no"}`);
      } else {
        console.log(`  Status: ${result.steps.send.status}`);
        if (result.steps.send.reason) console.log(`  Reason: ${result.steps.send.reason}`);
        if (result.steps.send.error) console.log(`  Error: ${result.steps.send.error}`);
      }

      console.log("");
      console.log(`Result: ${result.result.replace("-", " ")}`);

      if (!result.ok) {
        if (result.result === "signed" && options.send && !options.yes) {
           console.log("");
           console.log("Re-run with --send --yes to broadcast.");
        }
        process.exitCode = 1;
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

tx.command("simulate")
  .description("Simulate a Kaspa payment transaction (simulated devnet only)")
  .requiredOption("--to <address>", "Recipient address or alias")
  .requiredOption("--amount <kas>", "Amount in KAS")
  .option("--from <address>", "Sender address or alias", "alice")
  .option("--fee-rate <sompiPerMass>", "Fee rate in sompi per mass", "1")
  .option("--config <path>", "Path to config file")
  .action(
    async (options: {
      to: string;
      amount: string;
      from: string;
      feeRate: string;
      config?: string;
    }) => {
      const { 
        loadOrCreateLocalnetState, 
        resolveAccountAddressFromState,
        getSpendableUtxos
      } = await import("@hardkas/localnet");
      const { TxSimulator } = await import("@hardkas/simulator");

      try {
        const state = await loadOrCreateLocalnetState();
        
        const fromAddress = resolveAccountAddressFromState(state, options.from);
        const toAddress = resolveAccountAddressFromState(state, options.to);
        const amountSompi = parseKasToSompi(options.amount);
        const feeRateSompiPerMass = BigInt(options.feeRate);

        const unspent = getSpendableUtxos(state, fromAddress);
        
        if (unspent.length === 0) {
          throw new Error(`No UTXOs found for ${fromAddress} in local state.`);
        }

        const availableUtxos = unspent.map(u => ({
          outpoint: {
            transactionId: u.id.split(":")[0],
            index: Number(u.id.split(":")[2]) || 0
          },
          address: u.address,
          amountSompi: BigInt(u.amountSompi),
          scriptPublicKey: "mock-script"
        }));

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
          process.exitCode = 1;
          return;
        }

        console.log("Simulation OK");
        console.log("");
        console.log(`From:   ${fromAddress} (${options.from})`);
        console.log(`To:     ${toAddress} (${options.to})`);
        console.log(`Amount: ${formatSompi(amountSompi)}`);
        console.log("");
        console.log(`Selected UTXOs: ${plan.inputs.length}`);
        console.log(`Outputs:        ${plan.outputs.length + (plan.change ? 1 : 0)}`);
        console.log("");
        console.log(`Estimated mass: ${plan.estimatedMass}`);
        console.log(`Estimated fee:  ${formatSompi(plan.estimatedFeeSompi)}`);
        console.log(`Change:         ${plan.change ? formatSompi(plan.change.amountSompi) : "0.00000000 KAS"}`);
        console.log("");
        console.log("Trace:");
        for (const event of result.events) {
          if (event.type === "phase.completed") {
            console.log(`✓ ${event.phase}`);
          }
        }
      } catch (e) {
        console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
        process.exitCode = 1;
      }
    }
  );

const txPlan = tx.command("plan")
  .description("Manage Kaspa transaction plans")
  .option("--to <address>", "Recipient address or alias")
  .option("--amount <kas>", "Amount in KAS")
  .option("--from <address>", "Sender address or alias")
  .option("--fee-rate <sompiPerMass>", "Fee rate in sompi per mass", "1")
  .option("--network <network>", "Kaspa network name or config target", "simnet")
  .option("--config <path>", "Path to config file")
  .option("--url <wsUrl>", "WebSocket RPC URL")
  .option("--out <path>", "Save plan as artifact JSON")
  .option("--json", "Output as JSON", false)
  .action(async (options: {
    to?: string;
    amount?: string;
    from?: string;
    feeRate: string;
    network: string;
    config?: string;
    url?: string;
    out?: string;
    json: boolean;
  }, cmd: any) => {
    // If no arguments and no options provided, show help
    if (!options.to && !options.amount && !options.from && cmd.args.length === 0) {
      cmd.help();
      return;
    }

    // This action handles the "new plan" logic
    const { writeArtifact, formatTxPlanArtifact } = await import("@hardkas/artifacts");
    const { loadHardkasConfig } = await import("@hardkas/config");

    try {
      const loaded = await loadHardkasConfig({ configPath: options.config });
      
      const artifact = await runTxPlan({
        from: options.from,
        to: options.to,
        amount: options.amount,
        network: options.network,
        feeRate: options.feeRate,
        config: loaded.config,
        url: options.url
      });

      if (options.out) {
        await writeArtifact(options.out, artifact);
      }

      if (options.json) {
        console.log(JSON.stringify(artifact, bigIntReplacer, 2));
        return;
      }

      console.log(formatTxPlanArtifact(artifact));
      if (options.out) {
        console.log(`Artifact: ${options.out}`);
      }

    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

txPlan.command("show")
  .description("Show details of a saved transaction plan")
  .argument("<path>", "Path to artifact JSON")
  .option("--json", "Output as JSON", false)
  .action(async (filePath: string, options: { json: boolean }) => {
    const { readTxPlanArtifact, formatTxPlanArtifact } = await import("@hardkas/artifacts");
    try {
      const artifact = await readTxPlanArtifact(filePath);
      if (options.json) {
        console.log(JSON.stringify(artifact, null, 2));
        return;
      }
      console.log(formatTxPlanArtifact(artifact));
      console.log(`File:    ${filePath}`);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exitCode = 1;
    }
  });

txPlan.command("validate")
  .description("Validate a transaction plan artifact")
  .argument("<path>", "Path to artifact JSON")
  .option("--json", "Output as JSON", false)
  .action(async (filePath: string, options: { json: boolean }) => {
    const { readArtifact, validateTxPlanArtifact } = await import("@hardkas/artifacts");
    try {
      const data = await readArtifact(filePath);
      const result = validateTxPlanArtifact(data);
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.ok) {
          console.log("Tx plan artifact valid");
          console.log("");
          console.log(`File:    ${filePath}`);
          console.log(`Schema:  ${(data as any).schema}`);
          console.log(`Version: ${(data as any).version}`);
          console.log(`Status:  ${(data as any).status}`);
        } else {
          console.log("Invalid tx plan artifact");
          console.log("");
          console.log("Errors:");
          for (const err of result.errors) {
            console.log(`  - ${err}`);
          }
        }
      }

      if (!result.ok) {
        process.exitCode = 1;
      }
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exitCode = 1;
    }
  });

const txSign = tx.command("sign")
  .description("Transaction signing commands");

txSign.command("doctor")
  .description("Diagnose available signing backends")
  .option("--config <path>", "Path to config file")
  .action(async (options: { config?: string }) => {
    const { loadHardkasConfig } = await import("@hardkas/config");
    const { getKaspaSigningBackendStatus } = await import("@hardkas/accounts");
    
    try {
      await loadHardkasConfig({ configPath: options.config });
      const status = await getKaspaSigningBackendStatus();
      
      console.log("HardKAS signing doctor");
      console.log("");
      console.log("Simulated signing:          yes");
      console.log(`Kaspa private key signing:  ${status.available ? "yes" : "no"}`);
      console.log(`Backend:                    ${status.name}${status.available ? "" : " (none)"}`);
      console.log("External wallet signing:    no");
      console.log("Igra/EVM signing:           reserved for future");
      console.log("");
      console.log("Warnings:");
      if (!status.available) {
        console.log(`  - Real Kaspa signing backend is not available: ${status.error || "Package 'kaspa' missing"}`);
      }
      console.log("  - Mainnet signing is disabled by default.");
      
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

txSign.command("plan", { isDefault: true })
  .description("Sign a transaction plan artifact")
  .argument("<path>", "Path to tx plan artifact JSON")
  .option("--account <name>", "Account name to sign with")
  .option("--out <path>", "Save signed artifact JSON")
  .option("--config <path>", "Path to config file")
  .option("--allow-mainnet-signing", "Allow signing transactions for mainnet (DANGEROUS)", false)
  .option("--json", "Output as JSON", false)
  .action(async (filePath: string, options: {
    account?: string;
    out?: string;
    config?: string;
    allowMainnetSigning: boolean;
    json: boolean;
  }) => {
    const { readTxPlanArtifact, writeArtifact, formatSignedTxArtifact } = await import("@hardkas/artifacts");
    const { loadHardkasConfig } = await import("@hardkas/config");
    const { resolveHardkasAccount, signTxPlanArtifact } = await import("@hardkas/accounts");

    try {
      const planArtifact = await readTxPlanArtifact(filePath);
      const loaded = await loadHardkasConfig({ configPath: options.config });
      
      const signedArtifact = await runTxSign({
        planArtifact,
        accountName: options.account,
        config: loaded.config,
        allowMainnetSigning: options.allowMainnetSigning
      });

      if (options.out) {
        await writeArtifact(options.out, signedArtifact);
      }

      if (options.json) {
        console.log(JSON.stringify(signedArtifact, bigIntReplacer, 2));
        return;
      }

      console.log("HardKAS tx sign");
      console.log("");
      console.log(`Input:   ${filePath}`);
      console.log(`Mode:    ${planArtifact.mode}`);
      console.log(`Signer:  ${signedArtifact.signature.account}`);
      console.log(`Backend: ${signedArtifact.metadata?.signingBackend || "simulated"}`);
      console.log("");
      console.log("Signed artifact created");
      console.log("");
      if (options.out) {
        console.log(`Artifact: ${options.out}`);
        console.log("");
      }
      
      console.log(`Status:    ${signedArtifact.status}`);
      console.log(`Broadcast: ${signedArtifact.metadata?.warning || "not performed"}`);
      console.log("");
      
      console.log(formatSignedTxArtifact(signedArtifact));

    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

const txSigned = tx.command("signed").description("Manage signed transaction artifacts");

txSigned.command("show")
  .description("Show details of a signed transaction artifact")
  .argument("<path>", "Path to signed artifact JSON")
  .option("--json", "Output as JSON", false)
  .action(async (filePath: string, options: { json: boolean }) => {
    const { readSignedTxArtifact, formatSignedTxArtifact, getBroadcastableSignedTransaction } = await import("@hardkas/artifacts");
    try {
      const artifact = await readSignedTxArtifact(filePath);
      if (options.json) {
        console.log(JSON.stringify(artifact, null, 2));
        return;
      }

      let broadcastable = "yes";
      let reason = "";
      try {
        getBroadcastableSignedTransaction(artifact);
      } catch (e) {
        broadcastable = "no";
        reason = e instanceof Error ? e.message : String(e);
      }

      console.log(formatSignedTxArtifact(artifact));
      console.log(`Broadcastable: ${broadcastable}${reason ? ` (${reason})` : ""}`);
      console.log(`File:          ${filePath}`);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exitCode = 1;
    }
  });

txSigned.command("validate")
  .description("Validate a signed transaction artifact")
  .argument("<path>", "Path to signed artifact JSON")
  .option("--json", "Output as JSON", false)
  .action(async (filePath: string, options: { json: boolean }) => {
    const { readArtifact, validateSignedTxArtifact } = await import("@hardkas/artifacts");
    try {
      const data = await readArtifact(filePath);
      const result = validateSignedTxArtifact(data);
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.ok) {
          console.log("Signed tx artifact valid");
          console.log("");
          console.log(`File:    ${filePath}`);
          console.log(`Schema:  ${(data as any).schema}`);
          console.log(`Version: ${(data as any).version}`);
          console.log(`Status:  ${(data as any).status}`);
        } else {
          console.log("Invalid signed tx artifact");
          console.log("");
          console.log("Errors:");
          for (const err of result.errors) {
            console.log(`  - ${err}`);
          }
        }
      }

      if (!result.ok) {
        process.exitCode = 1;
      }
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exitCode = 1;
    }
  });

tx.command("send")
  .description("Broadcast a signed transaction artifact or send directly in simulated mode")
  .argument("[path]", "Path to signed artifact JSON")
  .option("--from <address>", "Sender address or alias")
  .option("--to <address>", "Recipient address or alias")
  .option("--amount <kas>", "Amount in KAS")
  .option("--fee-rate <sompiPerMass>", "Fee rate in sompi per mass", "1")
  .option("--network <name>", "Network name (defaults to artifact network or simnet)")
  .option("--config <path>", "Path to config file")
  .option("--url <wsUrl>", "Direct RPC WebSocket URL")
  .option("--yes", "Confirm broadcast without prompt", false)
  .option("--json", "Output as JSON", false)
  .option("--allow-mainnet-broadcast", "Allow broadcasting to mainnet (DANGEROUS)", false)
  .option("--verbose", "Show verbose response", false)
  .action(async (filePath: string | undefined, options: {
    from?: string;
    to?: string;
    amount?: string;
    feeRate: string;
    network?: string;
    config?: string;
    url?: string;
    yes: boolean;
    json: boolean;
    allowMainnetBroadcast: boolean;
    verbose: boolean;
  }) => {
    const { readSignedTxArtifact, getBroadcastableSignedTransaction } = await import("@hardkas/artifacts");
    const { loadHardkasConfig } = await import("@hardkas/config");

    try {
      const loaded = await loadHardkasConfig({ configPath: options.config });

      // Case A: Broadcast from artifact
      if (filePath) {
        const artifact = await readSignedTxArtifact(filePath);

        if (!options.yes) {
          const broadcastable = getBroadcastableSignedTransaction(artifact);
          console.log("This will broadcast a signed Kaspa transaction.");
          console.log("");
          console.log(`Artifact: ${filePath}`);
          console.log(`Network:  ${options.network || broadcastable.network}`);
          console.log(`Mode:     ${artifact.mode}`);
          console.log("");
          console.log(`From:     ${artifact.from.address} (${artifact.from.input})`);
          console.log(`To:       ${artifact.to.address} (${artifact.to.input})`);
          console.log(`Amount:   ${artifact.amount}`);
          console.log(`Fee:      ${artifact.estimatedFee}`);
          console.log("");
          console.log("Re-run with --yes to broadcast.");
          return;
        }

        const result = await runTxSend({
          signedArtifact: artifact,
          network: options.network,
          config: loaded.config,
          url: options.url,
          allowMainnetBroadcast: options.allowMainnetBroadcast
        });

        if (options.json) {
          console.log(JSON.stringify({
            ok: true,
            artifact: filePath,
            network: result.networkName,
            rpcUrl: result.rpcUrl,
            accepted: result.accepted,
            transactionId: result.transactionId,
            raw: options.verbose ? result.rawResponse : undefined
          }, bigIntReplacer, 2));
        } else {
          if (result.rpcUrl === "simulated://local") {
             console.log("Transaction sent in simulated localnet");
          } else {
             console.log("Kaspa transaction broadcast");
          }
          console.log("");
          console.log(`Artifact: ${filePath}`);
          console.log(`Network:  ${result.networkName}`);
          console.log(`RPC:      ${result.rpcUrl}`);
          console.log("");
          console.log(`Accepted: ${result.accepted ? "yes" : "no"}`);
          console.log(`Tx ID:    ${result.transactionId || "unknown"}`);
          
          if (result.rpcUrl === "simulated://local" && result.rawResponse) {
             const receipt = result.rawResponse;
             console.log(`Amount:    ${formatSompi(BigInt(receipt.amountSompi))}`);
             console.log(`Fee:       ${formatSompi(BigInt(receipt.feeSompi))}`);
             if (receipt.changeSompi) console.log(`Change:    ${formatSompi(BigInt(receipt.changeSompi))}`);
             console.log(`DAA score: ${receipt.daaScore}`);
              if (receipt.receiptPath || receipt.tracePath) {
                 console.log("");
                 console.log("Artifacts:");
                 if (receipt.receiptPath) console.log(`  Receipt: ${receipt.receiptPath}`);
                 if (receipt.tracePath) console.log(`  Trace:   ${receipt.tracePath}`);
              }
           }

          if (options.verbose && result.rawResponse) {
            console.log("");
            console.log("Raw Response:");
            console.log(JSON.stringify(result.rawResponse, null, 2));
          }
        }
      } 
      // Case B: Direct send (only for simulated/local flows usually, or as a shortcut for tx flow)
      else if (options.from && options.to && options.amount) {
        const result = await runTxFlow({
          from: options.from,
          to: options.to,
          amount: options.amount,
          feeRate: options.feeRate,
          network: options.network,
          config: loaded.config,
          url: options.url,
          send: true,
          yes: options.yes,
          allowMainnetBroadcast: options.allowMainnetBroadcast
        });

        if (options.json) {
          console.log(JSON.stringify(result, bigIntReplacer, 2));
          if (!result.ok) process.exitCode = 1;
          return;
        }

        if (!result.ok) {
          console.error(`Transaction failed: ${result.result}`);
          if (result.steps.plan.error) console.error(`Plan Error: ${result.steps.plan.error}`);
          if (result.steps.sign.error) console.error(`Sign Error: ${result.steps.sign.error}`);
          if (result.steps.send.error) console.error(`Send Error: ${result.steps.send.error}`);
          process.exitCode = 1;
          return;
        }

        const sendResult = result.steps.send.artifact!;
        if (sendResult.rpcUrl === "simulated://local") {
           console.log("Transaction sent in simulated localnet");
        } else {
           console.log("Kaspa transaction broadcast");
        }
        console.log("");
        console.log(`Network:   ${sendResult.networkName}`);
        console.log(`From:      ${options.from}`);
        console.log(`To:        ${options.to}`);
        console.log(`Amount:    ${options.amount} KAS`);
        console.log(`Accepted:  ${sendResult.accepted ? "yes" : "no"}`);
        console.log(`Tx ID:     ${sendResult.transactionId || "unknown"}`);

        if (sendResult.rpcUrl === "simulated://local" && sendResult.rawResponse) {
          const receipt = sendResult.rawResponse;
          console.log(`Fee:       ${formatSompi(BigInt(receipt.feeSompi))}`);
          if (receipt.changeSompi) console.log(`Change:    ${formatSompi(BigInt(receipt.changeSompi))}`);
          console.log(`DAA score: ${receipt.daaScore}`);
          console.log("");
          console.log("State updated:");
          console.log(`  Spent UTXOs:   ${receipt.spentUtxoIds.length}`);
          console.log(`  Created UTXOs: ${receipt.createdUtxoIds.length}`);
          
          if (receipt.receiptPath || receipt.tracePath) {
             console.log("");
             console.log("Artifacts:");
             if (receipt.receiptPath) console.log(`  Receipt: ${receipt.receiptPath}`);
             if (receipt.tracePath) console.log(`  Trace:   ${receipt.tracePath}`);
          }
        }
      } else {
        console.error("Provide a path to a signed artifact OR --from, --to, and --amount.");
        process.exitCode = 1;
      }

    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

const node = program.command("node").description("Local Kaspa node management");

node.command("start")
  .description("Start a local Kaspa node")
  .option("--network <network>", "Kaspa network", "devnet")
  .option("--binary <path>", "Path to kaspad binary")
  .option("--data-dir <path>", "Data directory")
  .option("--rpc-listen <host:port>", "RPC listen address")
  .option("--config <path>", "Path to config file")
  .action(async (options: {
    network: string;
    binary?: string;
    dataDir?: string;
    rpcListen?: string;
    config?: string;
  }) => {
    const { startKaspaNode } = await import("@hardkas/node-orchestrator");
    const { loadHardkasConfig, resolveNetworkTarget } = await import("@hardkas/config");

    const loaded = await loadHardkasConfig({ configPath: options.config });
    let resolvedNetwork = options.network;
    let binaryPath = options.binary;
    let dataDir = options.dataDir;
    let rpcListen = options.rpcListen;

    try {
      const { target } = resolveNetworkTarget({ config: loaded.config, network: options.network });
      if (target.kind === "kaspa-node") {
        resolvedNetwork = target.network;
        binaryPath = binaryPath ?? target.binaryPath;
        dataDir = dataDir ?? target.dataDir;
        if (target.rpcUrl && !rpcListen) {
           rpcListen = target.rpcUrl.replace("ws://", "");
        }
      }
    } catch (e) {}

    try {
      await startKaspaNode({
        network: resolvedNetwork as any,
        binaryPath,
        dataDir,
        rpcListen
      });
      console.log(`Kaspa node started on ${resolvedNetwork}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

node.command("status")
  .description("Check the status of a local Kaspa node")
  .option("--network <network>", "Kaspa network", "devnet")
  .option("--data-dir <path>", "Data directory")
  .option("--rpc", "Include RPC health check", false)
  .option("--config <path>", "Path to config file")
  .action(async (options: { network: string, dataDir?: string, rpc: boolean, config?: string }) => {
    const { getNodeStatus } = await import("@hardkas/node-orchestrator");
    const { loadHardkasConfig, resolveNetworkTarget } = await import("@hardkas/config");

    const loaded = await loadHardkasConfig({ configPath: options.config });
    let resolvedNetwork = options.network;
    let dataDir = options.dataDir;

    try {
      const { target } = resolveNetworkTarget({ config: loaded.config, network: options.network });
      if (target.kind === "kaspa-node") {
        resolvedNetwork = target.network;
        dataDir = dataDir ?? target.dataDir;
      }
    } catch (e) {}

    const status = await getNodeStatus({
      network: resolvedNetwork as any,
      dataDir: dataDir
    });

    console.log("Kaspa node status");
    console.log("");
    console.log(`Network:  ${resolvedNetwork}`);
    console.log(`Running:  ${status.running ? "yes" : "no"}`);
    
    if (status.running) {
      console.log(`PID:      ${status.pid}`);
      console.log(`RPC:      ${status.rpcUrl}`);
    }
    
    console.log(`Data dir: ${status.dataDir || "not resolved"}`);
    
    if (status.logFile) {
      console.log(`Log file: ${status.logFile}`);
    }
    
    if (status.message) {
      console.log(`Message:  ${status.message}`);
    }

    if (options.rpc && status.rpcUrl) {
      const { JsonWrpcKaspaClient } = await import("@hardkas/kaspa-rpc");
      const client = new JsonWrpcKaspaClient({ rpcUrl: status.rpcUrl });
      const health = await client.healthCheck();
      await client.close();

      console.log("");
      console.log("RPC health:");
      console.log(`  Reachable: ${health.reachable ? "yes" : "no"}`);
      if (health.reachable && health.info) {
        console.log(`  Version:   ${health.info.serverVersion || "unknown"}`);
        console.log(`  Network:   ${health.info.networkId || "unknown"}`);
        console.log(`  Synced:    ${health.info.isSynced !== undefined ? (health.info.isSynced ? "yes" : "no") : "unknown"}`);
      } else if (health.error) {
        console.log(`  Error:     ${health.error}`);
      }
    }
  });

node.command("stop")
  .description("Stop a local Kaspa node")
  .option("--network <network>", "Kaspa network", "devnet")
  .option("--data-dir <path>", "Data directory")
  .option("--config <path>", "Path to config file")
  .action(async (options: { network: string, dataDir?: string, config?: string }) => {
    const { stopKaspaNode } = await import("@hardkas/node-orchestrator");
    const { loadHardkasConfig, resolveNetworkTarget } = await import("@hardkas/config");

    const loaded = await loadHardkasConfig({ configPath: options.config });
    let resolvedNetwork = options.network;
    let dataDir = options.dataDir;

    try {
      const { target } = resolveNetworkTarget({ config: loaded.config, network: options.network });
      if (target.kind === "kaspa-node") {
        resolvedNetwork = target.network;
        dataDir = dataDir ?? target.dataDir;
      }
    } catch (e) {}
    
    await stopKaspaNode({
      network: resolvedNetwork as any,
      dataDir: dataDir
    });

    console.log("Kaspa node stopped");
  });

node.command("clean")
  .description("Delete node data for a specific network")
  .option("--network <network>", "Kaspa network", "devnet")
  .option("--data-dir <path>", "Data directory")
  .option("--yes", "Confirm deletion without prompting", false)
  .option("--config <path>", "Path to config file")
  .action(async (options: { network: string, dataDir?: string, yes: boolean, config?: string }) => {
    const { cleanKaspaNodeData, resolveRuntimeConfig } = await import("@hardkas/node-orchestrator");
    const { loadHardkasConfig, resolveNetworkTarget } = await import("@hardkas/config");

    const loaded = await loadHardkasConfig({ configPath: options.config });
    let resolvedNetwork = options.network;
    let dataDir = options.dataDir;

    try {
      const { target } = resolveNetworkTarget({ config: loaded.config, network: options.network });
      if (target.kind === "kaspa-node") {
        resolvedNetwork = target.network;
        dataDir = dataDir ?? target.dataDir;
      }
    } catch (e) {}
    
    const config = {
      network: resolvedNetwork as any,
      dataDir: dataDir
    };

    const runtime = resolveRuntimeConfig(config);

    if (!options.yes) {
      console.log(`This will delete node data for network "${resolvedNetwork}".`);
      console.log(`Data dir: ${runtime.dataDir}`);
      console.log("Re-run with --yes to confirm.");
      return;
    }

    try {
      await cleanKaspaNodeData(config);
      console.log("Kaspa node data cleaned");
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

node.command("doctor")
  .description("Diagnose the local Kaspa node setup")
  .option("--network <network>", "Kaspa network", "devnet")
  .option("--binary <path>", "Path to kaspad binary")
  .option("--data-dir <path>", "Data directory")
  .option("--rpc-listen <host:port>", "RPC listen address")
  .option("--rpc", "Include RPC health check", false)
  .option("--config <path>", "Path to config file")
  .action(async (options: {
    network: string;
    binary?: string;
    dataDir?: string;
    rpcListen?: string;
    rpc: boolean;
    config?: string;
  }) => {
    const { doctorKaspaNode } = await import("@hardkas/node-orchestrator");
    const { loadHardkasConfig, resolveNetworkTarget } = await import("@hardkas/config");

    const loaded = await loadHardkasConfig({ configPath: options.config });
    let resolvedNetwork = options.network;
    let binaryPath = options.binary;
    let dataDir = options.dataDir;
    let rpcListen = options.rpcListen;

    try {
      const { target } = resolveNetworkTarget({ config: loaded.config, network: options.network });
      if (target.kind === "kaspa-node") {
        resolvedNetwork = target.network;
        binaryPath = binaryPath ?? target.binaryPath;
        dataDir = dataDir ?? target.dataDir;
        if (target.rpcUrl && !rpcListen) {
           rpcListen = target.rpcUrl.replace("ws://", "");
        }
      }
    } catch (e) {}
    
    const report = await doctorKaspaNode({
      network: resolvedNetwork as any,
      binaryPath,
      dataDir,
      rpcListen
    });

    console.log("Kaspa node doctor");
    console.log("");
    console.log(`Network:         ${report.network}`);
    console.log(`Binary:          ${report.binaryPath}`);
    console.log(`Binary found:    ${report.binaryFound ? "yes" : "no"}`);
    console.log(`Data dir:        ${report.dataDir}`);
    console.log(`Data dir exists: ${report.dataDirExists ? "yes" : "no"}`);
    console.log(`PID file:        ${report.pidFile}`);
    console.log(`PID file exists: ${report.pidFileExists ? "yes" : "no"}`);
    console.log(`Running:         ${report.running ? "yes" : "no"}`);
    if (report.pid) console.log(`PID:             ${report.pid}`);
    console.log(`RPC:             ${report.rpcUrl}`);
    console.log(`Log file:        ${report.logFile}`);
    console.log(`Log file exists: ${report.logFileExists ? "yes" : "no"}`);

    let rpcReachable: boolean | undefined;

    if (options.rpc) {
      const { JsonWrpcKaspaClient } = await import("@hardkas/kaspa-rpc");
      const client = new JsonWrpcKaspaClient({ rpcUrl: report.rpcUrl });
      const health = await client.healthCheck();
      await client.close();
      rpcReachable = health.reachable;

      console.log(`RPC reachable:   ${health.reachable ? "yes" : "no"}`);
    }

    console.log("");
    
    console.log("Warnings:");
    const finalWarnings = [...report.warnings];
    if (options.rpc && rpcReachable === false) {
      finalWarnings.push(`RPC is not reachable at ${report.rpcUrl}. Start the node or check --rpclisten-json.`);
    }

    if (finalWarnings.length === 0) {
      console.log("  none");
    } else {
      for (const warning of finalWarnings) {
        console.log(`  - ${warning}`);
      }
    }
  });

node.command("logs")
  .description("Show logs for a local Kaspa node")
  .option("--network <network>", "Kaspa network", "devnet")
  .option("--data-dir <path>", "Data directory")
  .option("--config <path>", "Path to config file")
  .action(async (options: { network: string, dataDir?: string, config?: string }) => {
    const { readKaspaNodeLogs } = await import("@hardkas/node-orchestrator");
    const { loadHardkasConfig, resolveNetworkTarget } = await import("@hardkas/config");

    const loaded = await loadHardkasConfig({ configPath: options.config });
    let resolvedNetwork = options.network;
    let dataDir = options.dataDir;

    try {
      const { target } = resolveNetworkTarget({ config: loaded.config, network: options.network });
      if (target.kind === "kaspa-node") {
        resolvedNetwork = target.network;
        dataDir = dataDir ?? target.dataDir;
      }
    } catch (e) {}
    
    const logs = await readKaspaNodeLogs({
      network: resolvedNetwork as any,
      dataDir: dataDir
    });

    if (logs) {
      console.log(logs);
    } else {
      console.log("No logs found");
    }
  });

const rpc = program.command("rpc").description("Kaspa RPC commands");

rpc.command("health")
  .description("Check the health of a Kaspa RPC endpoint")
  .option("--url <wsUrl>", "WebSocket RPC URL")
  .option("--network <network>", "Kaspa network", "devnet")
  .option("--data-dir <path>", "Data directory")
  .option("--timeout <ms>", "Timeout in milliseconds", "3000")
  .option("--config <path>", "Path to config file")
  .action(async (options: {
    url?: string;
    network: string;
    dataDir?: string;
    timeout: string;
    config?: string;
  }) => {
    const { JsonWrpcKaspaClient } = await import("@hardkas/kaspa-rpc");
    const { resolveRuntimeConfig } = await import("@hardkas/node-orchestrator");
    const { loadHardkasConfig, resolveNetworkTarget } = await import("@hardkas/config");

    let rpcUrl = options.url;
    if (!rpcUrl) {
      const loaded = await loadHardkasConfig({ configPath: options.config });
      try {
        const { target, name } = resolveNetworkTarget({ config: loaded.config, network: options.network });
        
        if (target.kind === "kaspa-rpc" || target.kind === "kaspa-node") {
          rpcUrl = target.rpcUrl;
        }

        if (!rpcUrl) {
          if (target.kind === "kaspa-node") {
            const runtime = resolveRuntimeConfig({
              network: target.network,
              dataDir: target.dataDir ?? options.dataDir
            });
            rpcUrl = runtime.rpcUrl;
          } else if (target.kind === "simulated") {
            console.error(`Network '${name}' is simulated and has no real RPC endpoint. Use --url or select a kaspa-node/kaspa-rpc network.`);
            process.exitCode = 1;
            return;
          } else if (target.kind === "igra") {
            console.error(`Network '${name}' targets Igra L2. Use future Igra commands, not Kaspa L1 RPC.`);
            process.exitCode = 1;
            return;
          }
        }
      } catch (e) {
        const runtime = resolveRuntimeConfig({
          network: options.network as any,
          dataDir: options.dataDir
        });
        rpcUrl = runtime.rpcUrl;
      }
    }

    if (!rpcUrl) {
      console.error("Could not resolve RPC URL. Provide --url or check your config.");
      process.exitCode = 1;
      return;
    }

    const client = new JsonWrpcKaspaClient({
      rpcUrl,
      timeoutMs: parseInt(options.timeout, 10)
    });

    const health = await client.healthCheck();
    await client.close();

    console.log("Kaspa RPC health");
    console.log("");
    console.log(`RPC:       ${health.rpcUrl}`);
    console.log(`Reachable: ${health.reachable ? "yes" : "no"}`);

    if (health.reachable && health.info) {
      console.log(`Version:   ${health.info.serverVersion || "unknown"}`);
      console.log(`Network:   ${health.info.networkId || "unknown"}`);
      console.log(`Synced:    ${health.info.isSynced !== undefined ? (health.info.isSynced ? "yes" : "no") : "unknown"}`);
      console.log(`UTXO index: ${health.info.isUtxoIndexed !== undefined ? (health.info.isUtxoIndexed ? "yes" : "no") : "unknown"}`);
    } else if (health.error) {
      console.log(`Error:     ${health.error}`);
    }

    if (!health.reachable) {
      process.exitCode = 1;
    }
  });

rpc.command("info")
  .description("Get information from a Kaspa node via RPC")
  .option("--url <wsUrl>", "WebSocket RPC URL")
  .option("--network <network>", "Kaspa network", "devnet")
  .option("--data-dir <path>", "Data directory")
  .option("--timeout <ms>", "Timeout in milliseconds", "3000")
  .option("--json", "Output raw JSON info", false)
  .option("--config <path>", "Path to config file")
  .action(async (options: {
    url?: string;
    network: string;
    dataDir?: string;
    timeout: string;
    json: boolean;
    config?: string;
  }) => {
    const { JsonWrpcKaspaClient } = await import("@hardkas/kaspa-rpc");
    const { resolveRuntimeConfig } = await import("@hardkas/node-orchestrator");
    const { loadHardkasConfig, resolveNetworkTarget } = await import("@hardkas/config");

    let rpcUrl = options.url;
    if (!rpcUrl) {
      const loaded = await loadHardkasConfig({ configPath: options.config });
      try {
        const { target, name } = resolveNetworkTarget({ config: loaded.config, network: options.network });
        
        if (target.kind === "kaspa-rpc" || target.kind === "kaspa-node") {
          rpcUrl = target.rpcUrl;
        }

        if (!rpcUrl) {
          if (target.kind === "kaspa-node") {
            const runtime = resolveRuntimeConfig({
              network: target.network,
              dataDir: target.dataDir ?? options.dataDir
            });
            rpcUrl = runtime.rpcUrl;
          } else if (target.kind === "simulated") {
            console.error(`Network '${name}' is simulated and has no real RPC endpoint. Use --url or select a kaspa-node/kaspa-rpc network.`);
            process.exitCode = 1;
            return;
          } else if (target.kind === "igra") {
            console.error(`Network '${name}' targets Igra L2. Use future Igra commands, not Kaspa L1 RPC.`);
            process.exitCode = 1;
            return;
          }
        }
      } catch (e) {
        const runtime = resolveRuntimeConfig({
          network: options.network as any,
          dataDir: options.dataDir
        });
        rpcUrl = runtime.rpcUrl;
      }
    }

    if (!rpcUrl) {
      console.error("Could not resolve RPC URL. Provide --url or check your config.");
      process.exitCode = 1;
      return;
    }

    const client = new JsonWrpcKaspaClient({
      rpcUrl,
      timeoutMs: parseInt(options.timeout, 10)
    });

    try {
      const info = await client.getInfo();
      await client.close();

      if (options.json) {
        console.log(JSON.stringify(info.raw, null, 2));
        return;
      }

      console.log("Kaspa RPC info");
      console.log("");
      console.log(`RPC:         ${rpcUrl}`);
      console.log(`Version:     ${info.serverVersion || "unknown"}`);
      console.log(`Network:     ${info.networkId || "unknown"}`);
      console.log(`Synced:      ${info.isSynced !== undefined ? (info.isSynced ? "yes" : "no") : "unknown"}`);
      console.log(`UTXO index:  ${info.isUtxoIndexed !== undefined ? (info.isUtxoIndexed ? "yes" : "no") : "unknown"}`);
      console.log(`Mempool:     ${info.mempoolSize !== undefined ? info.mempoolSize : "unknown"}`);
      console.log(`DAA score:   ${info.virtualDaaScore !== undefined ? info.virtualDaaScore : "unknown"}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      await client.close();
      process.exitCode = 1;
    }
  });

program
  .command("balance")
  .description("Show the balance of a Kaspa account or address")
  .argument("<accountOrAddress>", "Account name or Kaspa address")
  .option("--network <network>", "Kaspa network name or config target", "simnet")
  .option("--config <path>", "Path to config file")
  .option("--url <wsUrl>", "WebSocket RPC URL")
  .option("--json", "Output as JSON", false)
  .action(async (accountOrAddress: string, options: {
    network: string;
    config?: string;
    url?: string;
    json: boolean;
  }) => {
    const { loadHardkasConfig, resolveNetworkTarget } = await import("@hardkas/config");
    const { resolveHardkasAccount } = await import("@hardkas/accounts");
    const { formatSompi } = await import("@hardkas/core");

    const loaded = await loadHardkasConfig({ configPath: options.config });
    const account = resolveHardkasAccount({ nameOrAddress: accountOrAddress, config: loaded.config });
    const address = account.address!;

    let balanceSompi = 0n;
    let mode = "simulated";
    let rpcUrl: string | undefined;
    let resolvedNetwork = options.network;

    try {
      const { target, name } = resolveNetworkTarget({ config: loaded.config, network: options.network });
      resolvedNetwork = name;

      if (target.kind === "simulated") {
         const { loadOrCreateLocalnetState, getAddressBalanceSompi } = await import("@hardkas/localnet");
         const localState = await loadOrCreateLocalnetState();
         balanceSompi = getAddressBalanceSompi(localState, address);
         mode = "simulated";
      } else if (target.kind === "kaspa-node" || target.kind === "kaspa-rpc") {
         const { JsonWrpcKaspaClient } = await import("@hardkas/kaspa-rpc");
         const { resolveRuntimeConfig } = await import("@hardkas/node-orchestrator");
         
         rpcUrl = options.url || target.rpcUrl;
         if (!rpcUrl && target.kind === "kaspa-node") {
           rpcUrl = resolveRuntimeConfig({ network: target.network, dataDir: target.dataDir }).rpcUrl;
         }

         if (!rpcUrl) throw new Error("Could not resolve RPC URL");

         const client = new JsonWrpcKaspaClient({ rpcUrl });
         const balanceRes = await client.getBalanceByAddress(address);
         await client.close();
         balanceSompi = balanceRes.balanceSompi;
         mode = target.kind;
      } else if (target.kind === "igra") {
         throw new Error(`Network '${name}' targets Igra L2. Use Igra commands for balance.`);
      }
    } catch (e) {
      if (options.url || options.network !== "simnet") {
         const { JsonWrpcKaspaClient } = await import("@hardkas/kaspa-rpc");
         const { resolveRuntimeConfig } = await import("@hardkas/node-orchestrator");
         rpcUrl = options.url;
         if (!rpcUrl) {
            rpcUrl = resolveRuntimeConfig({ network: options.network as any }).rpcUrl;
         }
         const client = new JsonWrpcKaspaClient({ rpcUrl });
         const balanceRes = await client.getBalanceByAddress(address);
         await client.close();
         balanceSompi = balanceRes.balanceSompi;
         mode = "kaspa-rpc";
      } else {
         throw e;
      }
    }

    if (options.json) {
      console.log(JSON.stringify({
        network: resolvedNetwork,
        mode,
        rpcUrl,
        account: account.name,
        address,
        balanceSompi: balanceSompi.toString(),
        balance: formatSompi(balanceSompi)
      }, null, 2));
      return;
    }

    console.log("HardKAS balance");
    console.log("");
    console.log(`Network: ${resolvedNetwork}`);
    console.log(`Mode:    ${mode}`);
    if (rpcUrl) console.log(`RPC:     ${rpcUrl}`);
    console.log(`Account: ${account.name}`);
    console.log(`Address: ${address}`);
    console.log(`Balance: ${formatSompi(balanceSompi)}`);
  });

const utxoCmd = program.command("utxo").description("Manage Kaspa UTXOs");

utxoCmd.command("list")
  .description("List UTXOs for a Kaspa account or address")
  .argument("<accountOrAddress>", "Account name or Kaspa address")
  .option("--network <network>", "Kaspa network name or config target", "simnet")
  .option("--config <path>", "Path to config file")
  .option("--url <wsUrl>", "WebSocket RPC URL")
  .option("--json", "Output as JSON", false)
  .action(async (accountOrAddress: string, options: {
    network: string;
    config?: string;
    url?: string;
    json: boolean;
  }) => {
    const { loadHardkasConfig, resolveNetworkTarget } = await import("@hardkas/config");
    const { resolveHardkasAccount } = await import("@hardkas/accounts");
    const { formatSompi } = await import("@hardkas/core");

    const loaded = await loadHardkasConfig({ configPath: options.config });
    const account = resolveHardkasAccount({ nameOrAddress: accountOrAddress, config: loaded.config });
    const address = account.address!;

    let utxos: any[] = [];
    let mode = "simulated";
    let rpcUrl: string | undefined;
    let resolvedNetwork = options.network;

    try {
      const { target, name } = resolveNetworkTarget({ config: loaded.config, network: options.network });
      resolvedNetwork = name;

      if (target.kind === "simulated") {
         const { loadOrCreateLocalnetState, getSpendableUtxos } = await import("@hardkas/localnet");
         const localState = await loadOrCreateLocalnetState();
         const unspent = getSpendableUtxos(localState, address);
         
         utxos = unspent.map(u => ({
           outpoint: { 
             transactionId: u.id.split(":")[0], 
             index: Number(u.id.split(":")[2]) || 0 
           },
           address: u.address,
           amountSompi: BigInt(u.amountSompi),
           raw: u
         }));
         mode = "simulated";
      } else if (target.kind === "kaspa-node" || target.kind === "kaspa-rpc") {
         const { JsonWrpcKaspaClient } = await import("@hardkas/kaspa-rpc");
         const { resolveRuntimeConfig } = await import("@hardkas/node-orchestrator");
         
         rpcUrl = options.url || target.rpcUrl;
         if (!rpcUrl && target.kind === "kaspa-node") {
           rpcUrl = resolveRuntimeConfig({ network: target.network, dataDir: target.dataDir }).rpcUrl;
         }

         if (!rpcUrl) throw new Error("Could not resolve RPC URL");

         const client = new JsonWrpcKaspaClient({ rpcUrl });
         utxos = await client.getUtxosByAddress(address);
         await client.close();
         mode = target.kind;
      }
    } catch (e) {
       if (options.url || options.network !== "simnet") {
         const { JsonWrpcKaspaClient } = await import("@hardkas/kaspa-rpc");
         const { resolveRuntimeConfig } = await import("@hardkas/node-orchestrator");
         rpcUrl = options.url;
         if (!rpcUrl) {
            rpcUrl = resolveRuntimeConfig({ network: options.network as any }).rpcUrl;
         }
         const client = new JsonWrpcKaspaClient({ rpcUrl });
         utxos = await client.getUtxosByAddress(address);
         await client.close();
         mode = "kaspa-rpc";
      } else {
         throw e;
      }
    }

    const totalSompi = utxos.reduce((acc, u) => acc + BigInt(u.amountSompi), 0n);

    if (options.json) {
      const jsonUtxos = utxos.map(u => ({
        transactionId: u.outpoint.transactionId,
        index: u.outpoint.index,
        amountSompi: u.amountSompi.toString(),
        amount: formatSompi(u.amountSompi),
        raw: u.raw
      }));

      console.log(JSON.stringify({
        network: resolvedNetwork,
        mode,
        rpcUrl,
        account: account.name,
        address,
        utxos: jsonUtxos,
        totalSompi: totalSompi.toString(),
        total: formatSompi(totalSompi),
        count: utxos.length
      }, null, 2));
      return;
    }

    console.log("HardKAS UTXOs");
    console.log("");
    console.log(`Network: ${resolvedNetwork}`);
    console.log(`Mode:    ${mode}`);
    if (rpcUrl) console.log(`RPC:     ${rpcUrl}`);
    console.log(`Account: ${account.name}`);
    console.log(`Address: ${address}`);
    console.log("");
    console.log("UTXOs:");
    if (utxos.length === 0) {
      console.log("  none");
    } else {
      for (const u of utxos) {
        console.log(`  - ${u.outpoint.transactionId}:${u.outpoint.index}  ${formatSompi(u.amountSompi)}`);
      }
    }
    console.log("");
    console.log(`Total: ${formatSompi(totalSompi)}`);
    console.log(`Count: ${utxos.length}`);
  });

const localnetCmd = program.command("localnet").description("Manage local simulated network state");

localnetCmd.command("reset")
  .description("Reset the local simulated network to initial state")
  .option("--accounts <count>", "Number of deterministic accounts", "5")
  .option("--balance <kas>", "Initial account balance in KAS", "1000")
  .action(async (options: { accounts: string, balance: string }) => {
    const { resetLocalnetState, getDefaultLocalnetStatePath } = await import("@hardkas/localnet");
    const accountCount = Number.parseInt(options.accounts, 10);
    const initialBalanceSompi = BigInt(options.balance) * SOMPI_PER_KAS;

    await resetLocalnetState({
      accounts: accountCount,
      initialBalanceSompi
    });

    console.log("Localnet state reset");
    console.log(`State: ${getDefaultLocalnetStatePath()}`);
  });

localnetCmd.command("status")
  .description("Show status of the local simulated network")
  .action(async () => {
    const { loadLocalnetState, getDefaultLocalnetStatePath, getAddressBalanceSompi } = await import("@hardkas/localnet");
    const path = getDefaultLocalnetStatePath();
    const state = await loadLocalnetState();

    if (!state) {
      console.log("Localnet state not initialized.");
      console.log(`Run 'hardkas localnet reset' or 'hardkas dev' to initialize at: ${path}`);
      return;
    }

    const unspent = state.utxos.filter(u => !u.spent);

    console.log("HardKAS localnet status");
    console.log("");
    console.log(`Mode:           ${state.mode}`);
    console.log(`Network:        ${state.networkId}`);
    console.log(`DAA score:      ${state.daaScore}`);
    console.log(`Accounts:       ${state.accounts.length}`);
    console.log(`Total UTXOs:    ${state.utxos.length}`);
    console.log(`Unspent UTXOs:  ${unspent.length}`);
    console.log(`Snapshots:      ${(state.snapshots || []).length}`);
    console.log(`State file:     ${path}`);
  });

localnetCmd.command("snapshot")
  .description("Create a point-in-time snapshot of the local network state")
  .argument("[name]", "Optional snapshot name")
  .action(async (name?: string) => {
    const { loadOrCreateLocalnetState, saveLocalnetState, createLocalnetSnapshot } = await import("@hardkas/localnet");
    const state = await loadOrCreateLocalnetState();
    const nextState = createLocalnetSnapshot(state, name);
    await saveLocalnetState(nextState);
    const snap = nextState.snapshots![nextState.snapshots!.length - 1];
    console.log(`Snapshot created: ${snap.id}${name ? ` (${name})` : ""}`);
  });

localnetCmd.command("restore")
  .description("Restore the local network to a previous snapshot")
  .argument("<idOrName>", "Snapshot ID or name")
  .action(async (idOrName: string) => {
    const { loadLocalnetState, saveLocalnetState, restoreLocalnetSnapshot } = await import("@hardkas/localnet");
    const state = await loadLocalnetState();
    if (!state) {
      console.error("Localnet state not found.");
      process.exitCode = 1;
      return;
    }

    try {
      const nextState = restoreLocalnetSnapshot(state, idOrName);
      await saveLocalnetState(nextState);
      console.log(`State restored to snapshot: ${idOrName}`);
      console.log(`DAA score: ${nextState.daaScore}`);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exitCode = 1;
    }
  });

// Update accounts command to support showing balances from localnet state
accountsCmd
  .action(async (options: any) => {
    const { loadOrCreateLocalnetState, getAddressBalanceSompi } = await import("@hardkas/localnet");
    const state = await loadOrCreateLocalnetState();
    
    console.log("HardKAS local accounts");
    console.log("");
    console.log(`State: ${getDefaultLocalnetStatePath()}`);
    console.log("");

    for (const account of state.accounts) {
      const balanceSompi = getAddressBalanceSompi(state, account.address);
      console.log(
        `  ${account.name.padEnd(8)} ${account.address.padEnd(24)} ${formatSompi(
          balanceSompi
        )}`
      );
    }
  });

program
  .command("utxos")
  .description("Alias for utxo list")
  .argument("<accountOrAddress>", "Account name or Kaspa address")
  .option("--network <network>", "Kaspa network name or config target", "simnet")
  .option("--config <path>", "Path to config file")
  .action(async (accountOrAddress, options) => {
    return program.commands.find(c => c.name() === "utxo")?.commands.find(c => c.name() === "list")?.action(accountOrAddress, options);
  });

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
