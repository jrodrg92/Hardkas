#!/usr/bin/env node

import { Command } from "commander";
import { formatSompi, parseKasToSompi, SOMPI_PER_KAS } from "@hardkas/core";
import {
  startSimulatedDevnet,
  createDeterministicAccounts,
  loadOrCreateLocalnetState,
  getDefaultLocalnetStatePath,
  getAccountBalanceSompi,
  getAddressBalanceSompi
} from "@hardkas/localnet";
import { 
  resolveHardkasAccountAddress,
  listHardkasAccounts,
  describeAccount
} from "@hardkas/accounts";
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
import { runUp } from "./runners/up-runner.js";
import { runExampleList } from "./runners/example-list-runner.js";
import { runExampleRun } from "./runners/example-run-runner.js";
import { runAccountsRealInit } from "./runners/accounts-real-init-runner.js";
import { runAccountsRealImport } from "./runners/accounts-real-import-runner.js";
import { runAccountsRealList } from "./runners/accounts-real-list-runner.js";
import { runAccountsRealShow } from "./runners/accounts-real-show-runner.js";
import { runAccountsRealGenerate } from "./runners/accounts-real-generate-runner.js";
import { runAccountsRealRemove } from "./runners/accounts-real-remove-runner.js";
import { runAccountsRealBalance } from "./runners/accounts-real-balance-runner.js";
import { runAccountsRealUtxos } from "./runners/accounts-real-utxos-runner.js";
import { 
  runL2Networks 
} from "./runners/l2-networks-runner.js";
import { 
  runL2ProfileShow 
} from "./runners/l2-profile-show-runner.js";
import { 
  runL2ProfileValidate 
} from "./runners/l2-profile-validate-runner.js";
import { 
  runL2RpcHealth 
} from "./runners/l2-rpc-health-runner.js";
import { 
  runL2RpcChainId,
  runL2RpcBlockNumber,
  runL2RpcGasPrice
} from "./runners/l2-rpc-query-runners.js";
import { runL2Balance, runL2Nonce } from "./runners/l2-account-runners.js";
import { runL2Call, runL2EstimateGas } from "./runners/l2-call-runners.js";
import { runL2TxBuild, runL2TxSign, runL2TxSend, runL2TxReceipt, runL2TxReceipts, runL2TxStatus } from "./runners/l2-tx-runners.js";
import { runL2ContractDeployPlan } from "./runners/l2-contract-runners.js";
import { runL2BridgeStatus, runL2BridgeAssumptions } from "./runners/l2-bridge-runners.js";
import { runArtifactVerify } from "./runners/artifact-verify-runner.js";
import { runArtifactExplain } from "./runners/artifact-explain-runner.js";
import { runTxProfile } from "./runners/tx-profile-runner.js";
import { bigIntReplacer } from "@hardkas/artifacts";
import { UI, handleError } from "./ui.js";

const program = new Command();

program
  .name("hardkas")
  .description("HardKAS: Kaspa-native developer operating environment")
  .version("0.2.0-alpha");

// --- Init Command ---
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

// --- Up Command ---
program
  .command("up")
  .description("Boot or validate the HardKAS developer runtime environment")
  .action(async () => {
    try {
      await runUp();
    } catch (e) {
      handleError(e, "Bootstrap failed");
      process.exitCode = 1;
    }
  });

// --- Example Commands ---
const exampleCmd = program.command("example").description("Manage HardKAS examples");

exampleCmd.command("list")
  .description("List available HardKAS examples")
  .action(async () => {
    try {
      await runExampleList();
    } catch (e) {
      handleError(e, "Failed to list examples");
      process.exitCode = 1;
    }
  });

exampleCmd.command("run <id>")
  .description("Run a HardKAS example")
  .action(async (id: string) => {
    try {
      await runExampleRun(id);
    } catch (e) {
      handleError(e, `Failed to run example '${id}'`);
      process.exitCode = 1;
    }
  });

// --- Snapshot Commands ---
const snapshotCmd = program.command("snapshot").description("Manage HardKAS localnet snapshots");

snapshotCmd.command("verify <idOrName>")
  .description("Verify the integrity of a snapshot")
  .action(async (idOrName: string) => {
    const { runSnapshotVerify } = await import("./runners/snapshot-verify-runner.js");
    await runSnapshotVerify({ idOrName });
  });

snapshotCmd.command("restore <idOrName>")
  .description("Restore localnet state from a snapshot")
  .action(async (idOrName: string) => {
    const { runSnapshotRestore } = await import("./runners/snapshot-restore-runner.js");
    await runSnapshotRestore({ idOrName });
  });

// --- Replay Commands ---
const replayCmd = program.command("replay").description("Manage HardKAS transaction replays");

replayCmd.command("verify <path>")
  .description("Verify replay invariants for a directory of artifacts")
  .action(async (path: string) => {
    const { runReplayVerify } = await import("./runners/replay-verify-runner.js");
    await runReplayVerify({ path });
  });

// --- Config Command ---
const configCmd = program.command("config").description("Manage HardKAS configuration");

configCmd.command("show")
  .description("Show the current HardKAS configuration")
  .option("--config <path>", "Path to config file")
  .option("--json", "Output as JSON", false)
  .action(async (options: { config?: string, json: boolean }) => {
    const { loadHardkasConfig } = await import("@hardkas/config");
    try {
      const loaded = await loadHardkasConfig(options.config ? { configPath: options.config } : {});

      if (options.json) {
        console.log(JSON.stringify(loaded, null, 2));
        return;
      }

      console.log("HardKAS config");
      console.log("");
      console.log(`Path: ${loaded.path || "defaults"}`);
      console.log(`Default network: ${loaded.config.defaultNetwork || "simnet"}`);
      console.log("");

      console.log("Networks:");
      const networks = loaded.config.networks || {};
      for (const [name, target] of Object.entries(networks)) {
        console.log(`  ${name} (${target.kind})`);
      }

      if (loaded.config.accounts) {
        console.log("");
        console.log("Accounts:");
        for (const [name, acc] of Object.entries(loaded.config.accounts)) {
          console.log(`  ${name} (${acc.kind})`);
        }
      }
    } catch (e) {
      handleError(e);
      process.exitCode = 1;
    }
  });


// --- Artifact Command ---
const artifactCmd = program.command("artifact").description("Manage HardKAS artifacts");

artifactCmd
  .command("verify <path>")
  .description("Verify an artifact's integrity and schema")
  .option("--json", "Output results as JSON", false)
  .option("--recursive", "Recursively verify all artifacts in a directory", false)
  .option("--strict", "Perform deep semantic and operational safety verification", false)
  .action(async (path: string, options: any) => {
    try {
      await runArtifactVerify({ path, ...options });
    } catch (e) {
      handleError(e);
      process.exitCode = 1;
    }
  });

artifactCmd
  .command("explain <path>")
  .description("Provide a human-readable operational summary of an artifact")
  .action(async (path: string) => {
    try {
      await runArtifactExplain({ path });
    } catch (e) {
      handleError(e);
      process.exitCode = 1;
    }
  });

artifactCmd
  .command("lineage <path>")
  .description("Show the provenance and operational history of an artifact")
  .action(async (path: string) => {
    try {
      const { runArtifactLineage } = await import("./runners/artifact-lineage-runner.js");
      await runArtifactLineage({ path });
    } catch (e) {
      handleError(e);
      process.exitCode = 1;
    }
  });

// --- Accounts Command ---
const accountsCmd = program.command("accounts").description("Manage HardKAS accounts");

accountsCmd.command("list")
  .description("List available HardKAS accounts")
  .option("--config <path>", "Path to config file")
  .option("--json", "Output as JSON", false)
  .action(async (options: { config?: string, json: boolean }) => {
    const { loadHardkasConfig } = await import("@hardkas/config");
    const { listHardkasAccounts, describeAccount } = await import("@hardkas/accounts");

    try {
      const loaded = await loadHardkasConfig(options.config ? { configPath: options.config } : {});
      const accounts = listHardkasAccounts(loaded.config);

      if (options.json) {
        console.log(JSON.stringify(accounts.map(a => describeAccount(a)), null, 2));
        return;
      }

      console.log("HardKAS accounts");
      console.log("");
      for (const acc of accounts) {
        const encrypted = acc.kind === "kaspa-private-key" && !acc.privateKeyEnv ? " (encrypted)" : "";
        console.log(`${acc.name.padEnd(12)} ${acc.address?.padEnd(24)} (${acc.kind})${encrypted}`);
      }
    } catch (e) {
      handleError(e);
      process.exitCode = 1;
    }
  });

const realAccountsCmd = accountsCmd.command("real").description("Persistent dev account store (L1)");

realAccountsCmd.command("init")
  .description("Initialize real dev account store")
  .option("--force", "Overwrite existing store", false)
  .option("--json", "Output as JSON", false)
  .action(async (options: { force: boolean, json: boolean }) => {
    try {
      const result = await runAccountsRealInit({ force: options.force });
      if (options.json) console.log(JSON.stringify(result, null, 2));
      else console.log(result.formatted);
    } catch (e) {
      handleError(e);
      process.exitCode = 1;
    }
  });

realAccountsCmd.command("import")
  .description("Import an account into the persistent store")
  .option("--name <name>", "Account name")
  .option("--address <address>", "Kaspa address")
  .option("--private-key <hex>", "Private key (plaintext, discouraged)")
  .option("--encrypted", "Import as encrypted keystore (recommended)", false)
  .option("--json", "Output as JSON", false)
  .action(async (options: { name?: string, address?: string, privateKey?: string, encrypted: boolean, json: boolean }) => {
    try {
      const { runAccountsKeystoreImport } = await import("./runners/accounts-keystore-runners.js");
      const result = await runAccountsKeystoreImport(options);
      if (options.json) console.log(JSON.stringify(result, null, 2));
      else console.log(result.formatted);
    } catch (e) {
      handleError(e);
      process.exitCode = 1;
    }
  });

realAccountsCmd.command("unlock <name>")
  .description("Verify password for an encrypted account")
  .action(async (name: string) => {
    try {
      const { runAccountsKeystoreUnlock } = await import("./runners/accounts-keystore-runners.js");
      await runAccountsKeystoreUnlock({ name });
    } catch (e) {
      handleError(e);
      process.exitCode = 1;
    }
  });

realAccountsCmd.command("lock <name>")
  .description("Lock an account (clear session)")
  .action(async (name: string) => {
    try {
      console.log(`Account '${name}' is now locked. (Session cleared)`);
    } catch (e) {
      handleError(e);
      process.exitCode = 1;
    }
  });

realAccountsCmd.command("change-password <name>")
  .description("Change password for an encrypted account")
  .action(async (name: string) => {
    try {
      const { runAccountsKeystoreChangePassword } = await import("./runners/accounts-keystore-runners.js");
      await runAccountsKeystoreChangePassword({ name });
    } catch (e) {
      handleError(e);
      process.exitCode = 1;
    }
  });

realAccountsCmd.command("generate")
  .description("Generate new real dev account(s) using Kaspa SDK")
  .option("--name <name>", "Base name for account(s)")
  .option("--count <number>", "Number of accounts to generate", "1")
  .option("--network <network>", "Kaspa network (simnet, testnet-10, mainnet)", "simnet")
  .option("--json", "Output as JSON", false)
  .action(async (options: { name?: string, count: string, network: string, json: boolean }) => {
    try {
      const result = await runAccountsRealGenerate({
        ...(options.name ? { name: options.name } : {}),
        count: parseInt(options.count, 10),
        networkId: options.network as any
      });
      if (options.json) console.log(JSON.stringify(result.accounts, null, 2));
      else console.log(result.formatted);
    } catch (e) {
      handleError(e);
      process.exitCode = 1;
    }
  });

// --- TX Command (Unified L1) ---
const tx = program.command("tx").description("L1 Transaction commands");

tx.command("profile <path>")
  .description("Show detailed mass and fee breakdown for a transaction plan")
  .action(async (path: string) => {
    try {
      await runTxProfile({ path });
    } catch (e) {
      handleError(e);
      process.exitCode = 1;
    }
  });

tx.command("plan")
  .description("Build a transaction plan artifact")
  .option("--from <accountOrAddress>", "Sender account name or address")
  .option("--to <address>", "Recipient address")
  .option("--amount <kas>", "Amount in KAS")
  .option("--network <name>", "Kaspa network name", "simnet")
  .option("--fee-rate <sompiPerMass>", "Fee rate in sompi per mass", "1")
  .option("--url <url>", "RPC URL (optional override)")
  .option("--out <path>", "Save plan as artifact JSON")
  .option("--json", "Output as JSON", false)
  .action(async (options: {
    from?: string;
    to?: string;
    amount?: string;
    network: string;
    feeRate: string;
    url?: string;
    out?: string;
    json: boolean;
  }) => {
    try {
      const { loadHardkasConfig } = await import("@hardkas/config");
      const { writeArtifact, formatTxPlanArtifact } = await import("@hardkas/artifacts");
      
      const loaded = await loadHardkasConfig();
      const artifact = await runTxPlan({
        from: options.from || "alice",
        to: options.to || "bob",
        amount: options.amount || "1",
        networkId: options.network,
        feeRate: options.feeRate,
        config: loaded.config,
        ...(options.url ? { url: options.url } : {})
      });

      if (options.out) await writeArtifact(options.out, artifact);
      if (options.json) console.log(JSON.stringify(artifact, bigIntReplacer, 2));
      else {
        console.log(formatTxPlanArtifact(artifact));
        if (options.out) console.log(`\nArtifact saved to: ${options.out}`);
      }
    } catch (e) {
      handleError(e);
      process.exitCode = 1;
    }
  });

tx.command("sign <planPath>")
  .description("Sign a transaction plan artifact")
  .option("--account <name>", "Account name to sign with")
  .option("--out <path>", "Save signed artifact JSON")
  .option("--allow-mainnet-signing", "Allow signing for mainnet", false)
  .option("--json", "Output as JSON", false)
  .action(async (planPath: string, options: {
    account?: string;
    out?: string;
    allowMainnetSigning: boolean;
    json: boolean;
  }) => {
    try {
      const { readTxPlanArtifact, writeArtifact, formatSignedTxArtifact } = await import("@hardkas/artifacts");
      const { loadHardkasConfig } = await import("@hardkas/config");

      const planArtifact = await readTxPlanArtifact(planPath);
      const loaded = await loadHardkasConfig();

      const signedArtifact = await runTxSign({
        planArtifact: planArtifact as any,
        ...(options.account ? { accountName: options.account } : {}),
        config: loaded.config,
        allowMainnetSigning: options.allowMainnetSigning
      });

      if (options.out) await writeArtifact(options.out, signedArtifact);
      if (options.json) console.log(JSON.stringify(signedArtifact, bigIntReplacer, 2));
      else {
        console.log(formatSignedTxArtifact(signedArtifact));
        if (options.out) console.log(`\nSigned artifact saved to: ${options.out}`);
      }
    } catch (e) {
      handleError(e);
      process.exitCode = 1;
    }
  });

tx.command("send [signedPath]")
  .description("Broadcast a signed transaction or send directly (simulated)")
  .option("--from <accountOrAddress>", "Sender (shortcut mode)")
  .option("--to <address>", "Recipient (shortcut mode)")
  .option("--amount <kas>", "Amount in KAS (shortcut mode)")
  .option("--network <name>", "Network name", "simnet")
  .option("--url <url>", "RPC URL (optional override)")
  .option("--yes", "Confirm broadcast", false)
  .option("--json", "Output as JSON", false)
  .action(async (signedPath: string | undefined, options: {
    from?: string;
    to?: string;
    amount?: string;
    network: string;
    url?: string;
    yes: boolean;
    json: boolean;
  }) => {
    try {
      const { loadHardkasConfig } = await import("@hardkas/config");
      const loaded = await loadHardkasConfig();

      if (signedPath) {
        const { readSignedTxArtifact } = await import("@hardkas/artifacts");
        const signedArtifact = await readSignedTxArtifact(signedPath);

        if (!options.yes && signedArtifact.networkId !== "simnet") {
          console.log(`Transaction is for network: ${signedArtifact.networkId}`);
          console.log("Run with --yes to broadcast.");
          return;
        }

        const result = await runTxSend({
          signedArtifact: signedArtifact as any,
          network: options.network,
          config: loaded.config,
          ...(options.url ? { url: options.url } : {})
        });

        if (options.json) console.log(JSON.stringify(result, bigIntReplacer, 2));
        else console.log(result.formatted);
      } else if (options.from && options.to && options.amount) {
        const result = await runTxFlow({
          ...options,
          amount: options.amount!,
          from: options.from!,
          to: options.to!,
          send: true,
          feeRate: "1", // Default fee rate for shortcut
          config: loaded.config,
          ...(options.url ? { url: options.url } : {})
        });
        if (options.json) console.log(JSON.stringify(result, bigIntReplacer, 2));
        else console.log(result.steps.send.artifact?.formatted || "Flow completed");
      } else {
        console.error("Provide a path to a signed artifact or use --from, --to, --amount.");
        process.exitCode = 1;
      }
    } catch (e) {
      handleError(e);
      process.exitCode = 1;
    }
  });

tx.command("receipt <txId>")
  .description("Show transaction receipt")
  .option("--json", "Output as JSON", false)
  .action(async (txId, options) => {
    try {
      const result = await runTxReceipt({ txId });
      if (options.json) console.log(JSON.stringify(result.receipt, bigIntReplacer, 2));
      else console.log(result.formatted);
    } catch (e) {
      handleError(e);
      process.exitCode = 1;
    }
  });

// --- Node Commands ---
const nodeCmd = program.command("node").description("Kaspa node management (Docker)");

nodeCmd.command("start")
  .description("Start local node")
  .option("--image <image>", "Docker image")
  .action(async (options) => {
    try {
      const result = await runNodeStart(options);
      console.log(result.formatted);
    } catch (e) {
      handleError(e);
    }
  });

nodeCmd.command("status")
  .description("Check node status")
  .action(async () => {
    try {
      const result = await runNodeStatus({});
      console.log(result.formatted);
    } catch (e) {
      handleError(e);
    }
  });

// --- L2 Commands (Igra) ---
const l2 = program.command("l2").description("Layer 2 (Igra) management");

l2.command("networks")
  .description("List available L2 network profiles")
  .option("--json", "Output results in JSON format")
  .action(async (options) => { await runL2Networks(options); });

const l2Profile = l2.command("profile").description("L2 profile management");
l2Profile.command("show <name>")
  .description("Show L2 profile details")
  .option("--json", "Output results in JSON format")
  .action(async (name, options) => { await runL2ProfileShow({ name, ...options }); });

l2Profile.command("validate <name>")
  .description("Validate L2 profile")
  .option("--json", "Output results in JSON format")
  .action(async (name, options) => { await runL2ProfileValidate({ name, ...options }); });

const l2tx = l2.command("tx").description("Igra transaction management");
l2tx.command("build")
  .description("Build L2 transaction plan")
  .option("--network <name>", "L2 network name", "igra")
  .option("--url <url>", "RPC URL")
  .option("--from <address>", "From address")
  .option("--to <address>", "To address")
  .option("--value <wei>", "Value in wei", "0")
  .option("--data <hex>", "Call data", "0x")
  .option("--json", "Output as JSON")
  .action(async (options) => { try { await runL2TxBuild(options); } catch (e) { handleError(e); } });

l2tx.command("sign <planPath>")
  .description("Sign L2 transaction plan")
  .option("--account <name>", "Account to sign with")
  .option("--json", "Output as JSON")
  .action(async (planPath, options) => { try { await runL2TxSign({ planPath, ...options }); } catch (e) { handleError(e); } });

l2tx.command("send <signedPath>")
  .description("Send L2 transaction")
  .option("--yes", "Confirm submission")
  .option("--json", "Output as JSON")
  .action(async (signedPath, options) => { try { await runL2TxSend({ signedPath, ...options }); } catch (e) { handleError(e); } });

l2tx.command("receipt <txHash>")
  .description("Get L2 transaction receipt")
  .option("--json", "Output as JSON")
  .action(async (txHash, options) => { try { await runL2TxReceipt({ txHash, ...options }); } catch (e) { handleError(e); } });

l2tx.command("status <txHash>")
  .description("Check L2 transaction status via RPC")
  .option("--json", "Output as JSON")
  .action(async (txHash, options) => { try { await runL2TxStatus({ txHash, ...options }); } catch (e) { handleError(e); } });

const l2contract = l2.command("contract").description("Igra contract management");
l2contract.command("deploy-plan")
  .description("Build L2 contract deployment plan")
  .option("--network <name>", "L2 network name", "igra")
  .option("--bytecode <hex>", "Contract bytecode")
  .option("--constructor <sig>", "Constructor signature")
  .option("--args <csv>", "Constructor arguments")
  .option("--json", "Output as JSON")
  .action(async (options) => { try { await runL2ContractDeployPlan(options); } catch (e) { handleError(e); } });

const l2bridge = l2.command("bridge").description("Igra bridge awareness");
l2bridge.command("status")
  .description("Show bridge security status")
  .option("--json", "Output as JSON")
  .action(async (options) => { try { await runL2BridgeStatus(options); } catch (e) { handleError(e); } });

l2bridge.command("assumptions")
  .description("Show bridge security assumptions")
  .option("--json", "Output as JSON")
  .action(async (options) => { try { await runL2BridgeAssumptions(options); } catch (e) { handleError(e); } });

const l2rpc = l2.command("rpc").description("Igra RPC diagnostics");
l2rpc.command("health")
  .description("Check L2 RPC health")
  .option("--json", "Output as JSON")
  .action(async (options) => { try { await runL2RpcHealth(options); } catch (e) { handleError(e); } });

l2.command("balance <address>")
  .description("Check Igra L2 balance")
  .option("--json", "Output as JSON")
  .action(async (address, options) => { try { await runL2Balance(address, options); } catch (e) { handleError(e); } });

l2.command("nonce <address>")
  .description("Check Igra L2 nonce")
  .option("--json", "Output as JSON")
  .action(async (address, options) => { try { await runL2Nonce(address, options); } catch (e) { handleError(e); } });

// --- DAG Simulation Commands ---
const dagCmd = program.command("dag").description("Simulate blockDAG operations (Localnet only)");

dagCmd.command("status")
  .description("View current DAG status")
  .action(async () => {
    try {
      const { runDagStatus } = await import("./runners/dag-runners.js");
      await runDagStatus();
    } catch (e) {
      handleError(e);
      process.exitCode = 1;
    }
  });

dagCmd.command("simulate-reorg")
  .description("Simulate a DAG reorg")
  .option("--depth <n>", "Reorg depth", "1")
  .action(async (options: { depth: string }) => {
    try {
      const { runDagSimulateReorg } = await import("./runners/dag-runners.js");
      await runDagSimulateReorg({ depth: parseInt(options.depth) });
    } catch (e) {
      handleError(e);
      process.exitCode = 1;
    }
  });

tx.command("verify <path>")
  .description("Perform deep semantic verification of a transaction plan")
  .option("--json", "Output as JSON", false)
  .action(async (path, options) => {
    const { runTxVerify } = await import("./runners/tx-verify-runner.js");
    await runTxVerify({ path, ...options });
  });

// --- RPC Commands ---
const rpcCmd = program.command("rpc").description("Kaspa RPC diagnostics and queries");

rpcCmd.command("info")
  .description("Show RPC connection info")
  .action(async () => { try { await runRpcInfo(); } catch (e) { handleError(e); } });

rpcCmd.command("health")
  .description("Check RPC health")
  .action(async () => { try { await runRpcHealth({}); } catch (e) { handleError(e); } });

rpcCmd.command("doctor")
  .description("Run comprehensive RPC diagnostics")
  .option("--endpoints <urls...>", "Specific endpoints to audit")
  .action(async (options: { endpoints?: string[] }) => { 
    const { runRpcDoctor } = await import("./runners/rpc-doctor-runner.js");
    try { await runRpcDoctor(options); } catch (e) { handleError(e); } 
  });

rpcCmd.command("dag")
  .description("Show DAG information from node")
  .action(async () => { try { await runRpcDag(); } catch (e) { handleError(e); } });

rpcCmd.command("utxos <address>")
  .description("Show UTXOs for an address from node")
  .action(async (address) => { try { await runRpcUtxos({ address }); } catch (e) { handleError(e); } });

rpcCmd.command("mempool [txId]")
  .description("Show mempool status from node")
  .action(async (txId) => { try { await runRpcMempool({ txId: txId || "all" }); } catch (e) { handleError(e); } });

// --- Misc ---
program.command("dev")
  .description("Start development environment")
  .option("--mode <mode>", "simulated or node", "simulated")
  .action(async (options: { mode: string }) => {
    if (options.mode === "simulated") {
      const state = await loadOrCreateLocalnetState();
      UI.success("Local HardKAS devnet (simulated) is ready.");
      UI.info(`Network: ${state.networkId}`);
      UI.info(`Accounts: ${state.accounts.length}`);
    } else {
      UI.info("Node mode requires 'hardkas node start'.");
    }
  });

await program.parseAsync(process.argv);
