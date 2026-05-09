#!/usr/bin/env node

import { Command } from "commander";
import { registerInitCommands } from "./commands/init.js";
import { registerTxCommands } from "./commands/tx.js";
import { registerArtifactCommands } from "./commands/artifact.js";
import { registerReplayCommands } from "./commands/replay.js";
import { registerSnapshotCommands } from "./commands/snapshot.js";
import { registerRpcCommands } from "./commands/rpc.js";
import { registerDagCommands } from "./commands/dag.js";
import { registerAccountsCommands } from "./commands/accounts.js";
import { registerL2Commands } from "./commands/l2.js";
import { registerNodeCommands } from "./commands/node.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerMiscCommands } from "./commands/misc.js";
import { registerQueryCommands } from "./commands/query.js";

const HARDKAS_VERSION = "0.2.0-alpha";

async function main() {
  const program = new Command();

  program
    .name("hardkas")
    .description("HardKAS: Kaspa-native developer operating environment")
    .version(HARDKAS_VERSION);

  // Global options
  program
    .option("--json", "Output results as JSON", false);

  // Register modular command groups
  registerInitCommands(program);
  registerTxCommands(program);
  registerArtifactCommands(program);
  registerReplayCommands(program);
  registerSnapshotCommands(program);
  registerRpcCommands(program);
  registerDagCommands(program);
  registerAccountsCommands(program);
  registerL2Commands(program);
  registerNodeCommands(program);
  registerConfigCommands(program);
  registerMiscCommands(program);
  registerQueryCommands(program);

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
