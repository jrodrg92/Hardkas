#!/usr/bin/env node

import { Command } from "commander";
import { formatSompi, parseKasToSompi, SOMPI_PER_KAS } from "@hardkas/core";
import { startSimulatedDevnet, resolveAccountAddress, createDeterministicAccounts } from "@hardkas/localnet";
import { TxSimulator } from "@hardkas/simulator";
import { buildPaymentPlan, createMockUtxo } from "@hardkas/tx-builder";

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

      const devnet = await startSimulatedDevnet({
        accounts: accountCount,
        initialBalanceSompi
      });

      console.log("HardKAS simulated devnet");
      console.log("");
      console.log(`Mode:      ${devnet.mode}`);
      console.log(`RPC:       simulated://local`);
      console.log(`Consensus: not running`);
      console.log(`DAG:       not simulated`);
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
    const { resolveAccountAddress } = await import("@hardkas/accounts");
    const { loadHardkasConfig } = await import("@hardkas/config");
    
    const loaded = await loadHardkasConfig();
    let resolvedAddress: string;
    try {
      resolvedAddress = resolveAccountAddress(address, loaded.config);
    } catch (e) {
      resolvedAddress = address; // Fallback if not found as account
    }

    console.log(`Funding ${resolvedAddress} (${address}) with ${amount} KAS`);
    console.log("");
    console.log("v0.1 note:");
    console.log(
      "Persistent localnet state is not implemented yet, so this command is currently a placeholder."
    );
  });

const tx = program.command("tx").description("Transaction commands");

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
      const { resolveAccountAddress } = await import("@hardkas/accounts");
      const { loadHardkasConfig } = await import("@hardkas/config");
      const { TxSimulator } = await import("@hardkas/simulator");

      const loaded = await loadHardkasConfig({ configPath: options.config });
      
      const fromAddress = resolveAccountAddress(options.from, loaded.config);
      const toAddress = resolveAccountAddress(options.to, loaded.config);
      const amountSompi = parseKasToSompi(options.amount);
      const feeRateSompiPerMass = BigInt(options.feeRate);

      // Simulation mode always uses deterministic accounts
      const accounts = createDeterministicAccounts();
      const account = accounts.find(a => a.address === fromAddress);
      
      const availableUtxos = account 
        ? [createMockUtxo({ address: account.address, amountSompi: account.balanceSompi, index: 0 })]
        : [createMockUtxo({ address: fromAddress, amountSompi: 1000n * SOMPI_PER_KAS, index: 0 })];

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
      console.log("Selected UTXOs:");
      for (const input of plan.inputs) {
        console.log(`  - ${input.outpoint.transactionId}:${input.outpoint.index}  ${formatSompi(input.amountSompi)}`);
      }
      console.log("");
      console.log("Outputs:");
      for (const output of plan.outputs) {
        console.log(`  - ${output.address.padEnd(24)} ${formatSompi(output.amountSompi)}`);
      }
      if (plan.change) {
        console.log(`  - ${plan.change.address.padEnd(24)} ${formatSompi(plan.change.amountSompi)} change`);
      }
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
    }
  );

tx.command("plan")
  .description("Build an unsigned transaction plan (simulated or real)")
  .requiredOption("--to <address>", "Recipient address or alias")
  .requiredOption("--amount <kas>", "Amount in KAS")
  .requiredOption("--from <address>", "Sender address or alias")
  .option("--fee-rate <sompiPerMass>", "Fee rate in sompi per mass", "1")
  .option("--network <network>", "Kaspa network name or config target", "simnet")
  .option("--config <path>", "Path to config file")
  .option("--url <wsUrl>", "WebSocket RPC URL")
  .option("--json", "Output as JSON", false)
  .action(async (options: {
    to: string;
    amount: string;
    from: string;
    feeRate: string;
    network: string;
    config?: string;
    url?: string;
    json: boolean;
  }) => {
    const { resolveAccountAddress } = await import("@hardkas/accounts");
    const { loadHardkasConfig, resolveNetworkTarget } = await import("@hardkas/config");
    const { formatSompi, parseKasToSompi } = await import("@hardkas/core");
    const { buildPaymentPlan, createMockUtxo } = await import("@hardkas/tx-builder");

    const loaded = await loadHardkasConfig({ configPath: options.config });
    const fromAddress = resolveAccountAddress(options.from, loaded.config);
    const toAddress = resolveAccountAddress(options.to, loaded.config);
    const amountSompi = parseKasToSompi(options.amount);
    const feeRateSompiPerMass = BigInt(options.feeRate);

    let availableUtxos: any[] = [];
    let mode = "simulated";
    let rpcUrl: string | undefined;
    let resolvedNetwork = options.network;

    try {
      const { target, name } = resolveNetworkTarget({ config: loaded.config, network: options.network });
      resolvedNetwork = name;

      if (target.kind === "simulated") {
         const { createDeterministicAccounts } = await import("@hardkas/localnet");
         const detAccounts = createDeterministicAccounts();
         const det = detAccounts.find(a => a.address === fromAddress);
         if (det) {
           availableUtxos = [createMockUtxo({ address: det.address, amountSompi: det.balanceSompi, index: 0 })];
         }
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
         const rpcUtxos = await client.getUtxosByAddress(fromAddress);
         await client.close();
         
         availableUtxos = rpcUtxos.map(u => ({
           outpoint: u.outpoint,
           address: u.address,
           amountSompi: u.amountSompi,
           scriptPublicKey: u.scriptPublicKey || "unresolved"
         }));
         mode = target.kind;
      } else if (target.kind === "igra") {
         throw new Error(`Network '${name}' targets Igra L2. Use Igra commands for planning.`);
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
         const rpcUtxos = await client.getUtxosByAddress(fromAddress);
         await client.close();
         
         availableUtxos = rpcUtxos.map(u => ({
           outpoint: u.outpoint,
           address: u.address,
           amountSompi: u.amountSompi,
           scriptPublicKey: u.scriptPublicKey || "unresolved"
         }));
         mode = "kaspa-rpc";
      } else {
         throw e;
      }
    }

    if (availableUtxos.length === 0) {
      console.error(`Error: No UTXOs found for ${fromAddress} on network '${resolvedNetwork}'.`);
      process.exitCode = 1;
      return;
    }

    try {
      const plan = buildPaymentPlan({
        fromAddress,
        outputs: [{ address: toAddress, amountSompi }],
        availableUtxos,
        feeRateSompiPerMass
      });

      if (options.json) {
        console.log(JSON.stringify({
          network: resolvedNetwork,
          mode,
          rpcUrl,
          from: { input: options.from, address: fromAddress },
          to: { input: options.to, address: toAddress },
          amountSompi: amountSompi.toString(),
          amount: formatSompi(amountSompi),
          selectedUtxos: plan.inputs.map(i => ({
            id: `${i.outpoint.transactionId}:${i.outpoint.index}`,
            txId: i.outpoint.transactionId,
            outputIndex: i.outpoint.index,
            address: i.address,
            amountSompi: i.amountSompi.toString(),
            amount: formatSompi(i.amountSompi)
          })),
          outputs: [
            ...plan.outputs.map(o => ({
              kind: "payment",
              address: o.address,
              amountSompi: o.amountSompi.toString(),
              amount: formatSompi(o.amountSompi)
            })),
            ...(plan.change ? [{
              kind: "change",
              address: plan.change.address,
              amountSompi: plan.change.amountSompi.toString(),
              amount: formatSompi(plan.change.amountSompi)
            }] : [])
          ],
          estimatedMass: plan.estimatedMass.toString(),
          estimatedFeeSompi: plan.estimatedFeeSompi.toString(),
          estimatedFee: formatSompi(plan.estimatedFeeSompi),
          changeSompi: plan.change ? plan.change.amountSompi.toString() : "0",
          change: plan.change ? formatSompi(plan.change.amountSompi) : "0.00000000 KAS",
          status: "unsigned"
        }, null, 2));
        return;
      }

      console.log("HardKAS tx plan");
      console.log("");
      console.log(`Network: ${resolvedNetwork}`);
      console.log(`Mode:    ${mode}`);
      if (rpcUrl) console.log(`RPC:     ${rpcUrl}`);
      console.log("");
      console.log(`From:   ${fromAddress} (${options.from})`);
      console.log(`To:     ${toAddress} (${options.to})`);
      console.log(`Amount: ${formatSompi(amountSompi)}`);
      console.log("");
      console.log(`Selected UTXOs: ${plan.inputs.length}`);
      for (const input of plan.inputs) {
        console.log(`  - ${input.outpoint.transactionId}:${input.outpoint.index}  ${formatSompi(input.amountSompi)}`);
      }
      console.log("");
      console.log("Outputs:");
      for (const output of plan.outputs) {
        console.log(`  - ${output.address.padEnd(24)} ${formatSompi(output.amountSompi)}`);
      }
      if (plan.change) {
        console.log(`  - ${plan.change.address.padEnd(24)} ${formatSompi(plan.change.amountSompi)} change`);
      }
      console.log("");
      console.log(`Estimated mass: ${plan.estimatedMass}`);
      console.log(`Estimated fee:  ${formatSompi(plan.estimatedFeeSompi)}`);
      console.log(`Change:         ${plan.change ? formatSompi(plan.change.amountSompi) : "0.00000000 KAS"}`);
      console.log("");
      console.log("Status: unsigned plan only");
      console.log("Next:   future hardkas tx sign / hardkas tx send");

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
         const { createDeterministicAccounts } = await import("@hardkas/localnet");
         const detAccounts = createDeterministicAccounts();
         const det = detAccounts.find(a => a.address === address);
         balanceSompi = det ? det.balanceSompi : 0n;
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
         const { createDeterministicAccounts } = await import("@hardkas/localnet");
         const { createMockUtxo } = await import("@hardkas/tx-builder");
         const detAccounts = createDeterministicAccounts();
         const det = detAccounts.find(a => a.address === address);
         if (det) {
           utxos = [{
             outpoint: { transactionId: `mock-${det.address}-0`, index: 0 },
             address: det.address,
             amountSompi: det.balanceSompi
           }];
         }
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
