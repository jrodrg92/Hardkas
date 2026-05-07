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
import { runTxReceipt } from "./runners/tx-receipt-runner.js";
import { runTxReceipts } from "./runners/tx-receipts-runner.js";
import { runTrace } from "./runners/trace-runner.js";
import { runReplay } from "./runners/replay-runner.js";
import { runNodeStart } from "./runners/node-start-runner.js";
import { runNodeStop } from "./runners/node-stop-runner.js";
import { runNodeStatus } from "./runners/node-status-runner.js";
import { runNodeLogs } from "./runners/node-logs-runner.js";
import { runRpcInfo } from "./runners/rpc-info-runner.js";
import { runRpcDag } from "./runners/rpc-dag-runner.js";
import { runRpcUtxos } from "./runners/rpc-utxos-runner.js";
import { runRpcMempool } from "./runners/rpc-mempool-runner.js";
import { runRpcHealth } from "./runners/rpc-health-runner.js";
import { runAccountsRealInit } from "./runners/accounts-real-init-runner.js";
import { runAccountsRealImport } from "./runners/accounts-real-import-runner.js";
import { runAccountsRealList } from "./runners/accounts-real-list-runner.js";
import { runAccountsRealShow } from "./runners/accounts-real-show-runner.js";
import { runAccountsRealGenerate } from "./runners/accounts-real-generate-runner.js";
import { runAccountsRealRemove } from "./runners/accounts-real-remove-runner.js";
import { runAccountsRealBalance } from "./runners/accounts-real-balance-runner.js";
import { runAccountsRealUtxos } from "./runners/accounts-real-utxos-runner.js";
import { runTxRealBuild } from "./runners/tx-real-build-runner.js";
import { runTxRealSign } from "./runners/tx-real-sign-runner.js";
import { bigIntReplacer } from "@hardkas/artifacts";
import { UI, handleError } from "./ui.js";

const program = new Command();

program
  .name("hardkas")
  .description("HardKAS: Production-grade developer toolkit for Kaspa")
  .version("0.1.0-dev");

program
  .command("init")
  .description("Initialize a new HardKAS project")
  .option("--force", "Overwrite existing hardkas.config.ts", false)
  .action(async (options: { force: boolean }) => {
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const configFile = path.join(process.cwd(), "hardkas.config.ts");

      if (fs.existsSync(configFile) && !options.force) {
        UI.warning("hardkas.config.ts already exists. Use --force to overwrite.");
        return;
      }

      const template = `import { defineHardkasConfig } from "@hardkas/config";

export default defineHardkasConfig({
  // HardKAS v0.1-dev Configuration
  defaultNetwork: "simulated",

  networks: {
    simulated: {
      kind: "simulated"
    },

    node: {
      kind: "kaspa-node",
      network: "simnet",
      rpcUrl: "ws://127.0.0.1:18210"
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
    }
  }
});
`;

      fs.writeFileSync(configFile, template, "utf-8");
      UI.success("HardKAS project initialized successfully.");
      UI.info(`Created: hardkas.config.ts`);
      UI.footer("Run 'hardkas dev' to start developing.");
    } catch (e) {
      handleError(e, "Initialization failed");
      process.exitCode = 1;
    }
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

const realAccountsCmd = accountsCmd.command("real").description("Manage real Kaspa dev accounts (persistent store)");

realAccountsCmd.command("init")
  .description("Initialize real dev account store")
  .option("--force", "Overwrite existing store", false)
  .option("--json", "Output as JSON", false)
  .action(async (options: { force: boolean, json: boolean }) => {
    try {
      const result = await runAccountsRealInit({ force: options.force });
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

realAccountsCmd.command("import")
  .description("Import a real dev account")
  .option("--name <name>", "Account name")
  .option("--address <address>", "Kaspa address")
  .option("--public-key <publicKey>", "Public key (optional)")
  .option("--private-key <privateKey>", "Private key (optional)")
  .option("--json", "Output as JSON", false)
  .action(async (options: { 
    name?: string, 
    address?: string, 
    publicKey?: string, 
    privateKey?: string, 
    json: boolean 
  }) => {
    try {
      if (!options.name || !options.address) {
        throw new Error("--name and --address are required for import.");
      }
      const result = await runAccountsRealImport({
        name: options.name,
        address: options.address,
        publicKey: options.publicKey,
        privateKey: options.privateKey
      });
      if (options.json) {
        console.log(JSON.stringify(result.account, null, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

realAccountsCmd.command("generate")
  .description("Generate new real dev account(s) using Kaspa SDK")
  .option("--name <name>", "Base name for account(s)")
  .option("--count <number>", "Number of accounts to generate", "1")
  .option("--network <network>", "Kaspa network (simnet, testnet-10, mainnet)", "simnet")
  .option("--json", "Output as JSON", false)
  .action(async (options: { 
    name?: string, 
    count: string, 
    network: string,
    json: boolean 
  }) => {
    try {
      const result = await runAccountsRealGenerate({
        name: options.name,
        count: parseInt(options.count, 10),
        networkId: options.network as any
      });
      if (options.json) {
        console.log(JSON.stringify(result.accounts, null, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

realAccountsCmd.command("list")
  .description("List real dev accounts")
  .option("--show-private", "Show private keys (masked by default)", false)
  .option("--json", "Output as JSON", false)
  .action(async (options: { showPrivate: boolean, json: boolean }) => {
    try {
      const result = await runAccountsRealList({ showPrivate: options.showPrivate });
      if (options.json) {
        console.log(JSON.stringify(result.accounts, bigIntReplacer, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

realAccountsCmd.command("show")
  .description("Show a real dev account")
  .argument("<name>", "Account name")
  .option("--show-private", "Show private key (masked by default)", false)
  .option("--json", "Output as JSON", false)
  .action(async (name: string, options: { showPrivate: boolean, json: boolean }) => {
    try {
      const result = await runAccountsRealShow({ name, showPrivate: options.showPrivate });
      if (options.json) {
        console.log(JSON.stringify(result.account, null, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

realAccountsCmd.command("remove")
  .description("Remove a real dev account")
  .argument("<name>", "Account name")
  .option("--yes", "Confirm removal", false)
  .option("--json", "Output as JSON", false)
  .action(async (name: string, options: { yes: boolean, json: boolean }) => {
    try {
      const result = await runAccountsRealRemove({ name, yes: options.yes });
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

realAccountsCmd.command("balance")
  .description("Show the real on-chain balance of a dev account")
  .argument("<nameOrAddress>", "Account name or Kaspa address")
  .option("--url <url>", "Kaspa RPC URL", "http://127.0.0.1:18210")
  .option("--json", "Output as JSON", false)
  .action(async (nameOrAddress: string, options: { url: string, json: boolean }) => {
    try {
      const result = await runAccountsRealBalance({ nameOrAddress, url: options.url });
      if (options.json) {
        console.log(JSON.stringify(result, bigIntReplacer, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      handleError(e, "Real balance query failed");
      process.exitCode = 1;
    }
  });

realAccountsCmd.command("utxos")
  .description("Show the real on-chain UTXOs of a dev account")
  .argument("<nameOrAddress>", "Account name or Kaspa address")
  .option("--url <url>", "Kaspa RPC URL", "http://127.0.0.1:18210")
  .option("--json", "Output as JSON", false)
  .action(async (nameOrAddress: string, options: { url: string, json: boolean }) => {
    try {
      const result = await runAccountsRealUtxos({ nameOrAddress, url: options.url });
      if (options.json) {
        console.log(JSON.stringify(result, bigIntReplacer, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      handleError(e, "Real UTXOs query failed");
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
      if (options.mode === "node") {
        console.log("HardKAS node devnet");
        console.log("");

        try {
          const statusResult = await runNodeStatus({});
          let status = statusResult.status;

          if (!status.running) {
            console.log("Starting Kaspa node in Docker...");
            const startResult = await runNodeStart({});
            status = startResult.status;
          }

          console.log(`Mode:      node`);
          console.log(`Backend:   Docker / rusty-kaspa/kaspad`);
          console.log(`Network:   ${status.network}`);
          console.log(`Status:    ${status.running ? "running" : "stopped"}`);
          console.log("");
          console.log("RPC:");
          console.log(`  gRPC:     127.0.0.1:${status.ports.rpc}`);
          console.log(`  Borsh:    127.0.0.1:${status.ports.borshRpc}`);
          console.log(`  JSON RPC: 127.0.0.1:${status.ports.jsonRpc}`);
          console.log("");
          console.log(`Consensus: ${status.running ? "running" : "stopped"}`);
          console.log(`DAG:       real kaspad simnet`);
          
          if (status.running) {
            try {
              const { waitForKaspaRpcReady } = await import("@hardkas/kaspa-rpc");
              const rpcResult = await waitForKaspaRpcReady({ 
                url: `http://127.0.0.1:${status.ports.jsonRpc}`,
                maxWaitMs: 10000 // Short wait for dev command
              });

              if (rpcResult.ready) {
                console.log("");
                console.log("RPC Data:");
                console.log(`  Network ID: ${rpcResult.networkId}`);
                console.log(`  Virtual DAA: ${rpcResult.virtualDaaScore}`);
                console.log(`  Synced:     ${rpcResult.isSynced ? "yes" : "no"}`);
                console.log(`  Version:    ${rpcResult.serverVersion}`);
              } else {
                console.log("");
                console.log("RPC:       not ready");
                console.log("           (node may still be initializing consensus)");
                console.log("Suggestion: hardkas rpc health --wait --timeout 60");
              }
            } catch (e) {
              // Ignore wait errors in dev command
            }
          }

          console.log("");
          console.log("Notes:");
          console.log("  Real accounts, faucet and signing are not implemented yet.");
          console.log("  Use simulated mode for stateful tx simulation.");
        } catch (e) {
          console.error(`Error managing node: ${e instanceof Error ? e.message : String(e)}`);
          process.exitCode = 1;
        }
        return;
      }

      if (options.mode !== "simulated") {
        console.error("Invalid mode. Use 'simulated' or 'node'.");
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

function validateTxIdArg(txId: string): void {
  if (txId.includes("/") || txId.includes("\\") || txId.includes("..")) {
    throw new Error(`Invalid txId: ${txId}. Path traversal not allowed.`);
  }
}

tx.command("receipt")
  .description("Show details of a simulated transaction receipt")
  .argument("<txId>", "Transaction ID")
  .option("--json", "Output as JSON", false)
  .action(async (txId: string, options: { json: boolean }) => {
    try {
      validateTxIdArg(txId);
      const result = await runTxReceipt({ txId });
      if (options.json) {
        console.log(JSON.stringify(result.receipt, bigIntReplacer, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

tx.command("receipts")
  .description("List saved simulated transaction receipts")
  .option("--json", "Output as JSON", false)
  .action(async (options: { json: boolean }) => {
    try {
      const result = await runTxReceipts({});
      if (options.json) {
        console.log(JSON.stringify(result.receipts, bigIntReplacer, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

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
        const sendArtifact = result.steps.send.artifact;
        console.log("  Status: ok");
        console.log(`  Tx ID: ${sendArtifact?.transactionId || "unknown"}`);
        console.log(`  Accepted: ${sendArtifact?.accepted ? "yes" : "no"}`);

        if (sendArtifact?.rpcUrl === "simulated://local" && sendArtifact.rawResponse) {
          const receipt = sendArtifact.rawResponse;
          if (receipt.receiptPath || receipt.tracePath) {
            console.log("");
            console.log("  Artifacts:");
            if (receipt.receiptPath) console.log(`    Receipt: ${receipt.receiptPath}`);
            if (receipt.tracePath) console.log(`    Trace:   ${receipt.tracePath}`);
          }
        }
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

const txReal = tx.command("real").description("Real transaction commands (node/rpc modes)");

txReal.command("build")
  .description("Build a transaction plan using real on-chain UTXOs")
  .requiredOption("--from <accountOrAddress>", "Sender account name or address")
  .requiredOption("--to <address>", "Recipient address")
  .requiredOption("--amount <kas>", "Amount in KAS")
  .option("--fee-rate <sompiPerMass>", "Fee rate in sompi per mass", "1")
  .option("--url <url>", "Kaspa RPC URL", "http://127.0.0.1:18210")
  .option("--out-dir <dir>", "Output directory for plan artifact", "plans")
  .option("--json", "Output as JSON", false)
  .action(async (options: {
    from: string;
    to: string;
    amount: string;
    feeRate: string;
    url: string;
    outDir: string;
    json: boolean;
  }) => {
    try {
      const result = await runTxRealBuild({
        from: options.from,
        to: options.to,
        amount: options.amount,
        feeRate: options.feeRate,
        url: options.url,
        outDir: options.outDir
      });

      if (options.json) {
        console.log(JSON.stringify({
          planId: result.planId,
          artifactPath: result.artifactPath,
          artifact: result.artifact
        }, bigIntReplacer, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      handleError(e, "Real transaction build failed");
      process.exitCode = 1;
    }
  });

txReal.command("sign")
  .description("Sign a real transaction plan artifact")
  .argument("<planPath>", "Path to real transaction plan artifact")
  .requiredOption("--account <name>", "Account name to sign with")
  .option("--out-dir <dir>", "Output directory for signed artifact", "signed")
  .option("--json", "Output as JSON", false)
  .action(async (planPath: string, options: {
    account: string;
    outDir: string;
    json: boolean;
  }) => {
    try {
      const result = await runTxRealSign({
        planPath,
        accountName: options.account,
        outDir: options.outDir
      });

      if (options.json) {
        console.log(JSON.stringify({
          signedId: result.signedId,
          artifactPath: result.artifactPath,
          artifact: result.artifact
        }, bigIntReplacer, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      handleError(e, "Real transaction signing failed");
      process.exitCode = 1;
    }
  });


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

const node = program.command("node").description("Local Kaspa node management (Docker-based)");

node.command("start")
  .description("Start a local Kaspa node in Docker (simnet)")
  .option("--image <image>", "Docker image to use")
  .option("--container <name>", "Container name")
  .option("--data-dir <path>", "Data directory")
  .option("--json", "Output as JSON", false)
  .action(async (options: {
    image?: string;
    container?: string;
    dataDir?: string;
    json: boolean;
  }) => {
    try {
      const result = await runNodeStart({
        image: options.image,
        containerName: options.container,
        dataDir: options.dataDir
      });
      if (options.json) {
        console.log(JSON.stringify(result.status, bigIntReplacer, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

node.command("stop")
  .description("Stop the local Kaspa node container")
  .option("--container <name>", "Container name")
  .option("--json", "Output as JSON", false)
  .action(async (options: { container?: string, json: boolean }) => {
    try {
      const status = await runNodeStop({ containerName: options.container });
      if (options.json) {
        console.log(JSON.stringify(status, bigIntReplacer, 2));
      } else {
        console.log("Kaspa node stopped");
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

node.command("status")
  .description("Check the status of the local Kaspa node container")
  .option("--container <name>", "Container name")
  .option("--json", "Output as JSON", false)
  .action(async (options: { container?: string, json: boolean }) => {
    try {
      const result = await runNodeStatus({ containerName: options.container });
      if (options.json) {
        console.log(JSON.stringify(result.status, bigIntReplacer, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

node.command("logs")
  .description("Show logs from the Kaspa node container")
  .option("--container <name>", "Container name")
  .option("--tail <lines>", "Number of lines to show", "100")
  .option("--json", "Output as JSON", false)
  .action(async (options: { container?: string, tail: string, json: boolean }) => {
    try {
      const logs = await runNodeLogs({
        containerName: options.container,
        tail: parseInt(options.tail, 10)
      });
      if (options.json) {
        console.log(JSON.stringify({ logs }, bigIntReplacer, 2));
      } else {
        console.log(logs);
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

const rpc = program.command("rpc").description("Kaspa RPC commands");

rpc.command("health")
  .description("Check Kaspa RPC health and readiness")
  .option("--url <url>", "JSON-RPC URL", "http://127.0.0.1:18210")
  .option("--wait", "Wait until RPC is ready", false)
  .option("--timeout <seconds>", "Max wait time in seconds", "60")
  .option("--interval <ms>", "Polling interval in milliseconds", "1000")
  .option("--json", "Output as JSON", false)
  .action(async (options: { 
    url: string, 
    wait: boolean, 
    timeout: string, 
    interval: string, 
    json: boolean 
  }) => {
    try {
      const { result, formatted } = await runRpcHealth({
        url: options.url,
        wait: options.wait,
        timeout: parseInt(options.timeout, 10),
        interval: parseInt(options.interval, 10)
      });

      if (options.json) {
        console.log(JSON.stringify(result, bigIntReplacer, 2));
      } else {
        console.log(formatted);
      }

      if (!result.ready) {
        process.exitCode = 1;
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

rpc.command("info")
  .description("Show Kaspa node information")
  .option("--url <url>", "JSON-RPC URL", "http://127.0.0.1:18210")
  .option("--json", "Output as JSON", false)
  .action(async (options: { url: string, json: boolean }) => {
    try {
      const result = await runRpcInfo({ url: options.url });
      if (options.json) {
        console.log(JSON.stringify(result.info, bigIntReplacer, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

rpc.command("dag")
  .description("Show Kaspa DAG information")
  .option("--url <url>", "JSON-RPC URL", "http://127.0.0.1:18210")
  .option("--json", "Output as JSON", false)
  .action(async (options: { url: string, json: boolean }) => {
    try {
      const result = await runRpcDag({ url: options.url });
      if (options.json) {
        console.log(JSON.stringify(result.dag, bigIntReplacer, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

rpc.command("utxos")
  .description("Show UTXOs for a Kaspa address")
  .argument("<address>", "Kaspa address")
  .option("--url <url>", "JSON-RPC URL", "http://127.0.0.1:18210")
  .option("--json", "Output as JSON", false)
  .action(async (address: string, options: { url: string, json: boolean }) => {
    try {
      const result = await runRpcUtxos({ address, url: options.url });
      if (options.json) {
        console.log(JSON.stringify(result.utxos, bigIntReplacer, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

rpc.command("mempool")
  .description("Check if a transaction is in the mempool")
  .argument("<txId>", "Transaction ID")
  .option("--url <url>", "JSON-RPC URL", "http://127.0.0.1:18210")
  .option("--json", "Output as JSON", false)
  .action(async (txId: string, options: { url: string, json: boolean }) => {
    try {
      const result = await runRpcMempool({ txId, url: options.url });
      if (options.json) {
        console.log(JSON.stringify(result.entry, bigIntReplacer, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
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
  .description("Show the execution trace of a simulated transaction")
  .argument("<txId>", "Transaction ID")
  .option("--json", "Output as JSON", false)
  .action(async (txId: string, options: { json: boolean }) => {
    try {
      validateTxIdArg(txId);
      const result = await runTrace({ txId });
      if (options.json) {
        console.log(JSON.stringify(result.trace, bigIntReplacer, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

program
  .command("replay")
  .description("Show a summary replay of a simulated transaction")
  .argument("<txId>", "Transaction ID")
  .option("--json", "Output as JSON", false)
  .action(async (txId: string, options: { json: boolean }) => {
    try {
      validateTxIdArg(txId);
      const result = await runReplay({ txId });
      if (options.json) {
        console.log(JSON.stringify(result.replay, bigIntReplacer, 2));
      } else {
        console.log(result.formatted);
      }
    } catch (e) {
      console.error(e instanceof Error ? `Error: ${e.message}` : String(e));
      process.exitCode = 1;
    }
  });

await program.parseAsync(process.argv);
