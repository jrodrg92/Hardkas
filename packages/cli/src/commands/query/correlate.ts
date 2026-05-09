import { Command } from "commander";
import { handleError } from "../../ui.js";
import { printCorrelationBundle } from "./ui-helpers.js";

export function registerCorrelateQueryCommands(queryCmd: Command) {
  queryCmd
    .command("correlate <txId>")
    .description("Full cross-domain timeline (lineage, dag, rpc, replay)")
    .option("--include <domains...>", "Domains to include", ["lineage", "dag", "rpc", "replay"])
    .option("--json", "Output as JSON", false)
    .option("--explain [level]", "Attach explain chains (brief|full)")
    .action(async (txId, options) => {
      try {
        const { QueryEngine, correlate } = await import("@hardkas/query");
        const engine = new QueryEngine({ artifactDir: process.cwd() });
        const explain = options.explain === true ? "brief" as const : (options.explain || false);
        const result = await correlate(txId, engine, {
          include: options.include,
          cwd: process.cwd(),
          explain
        });
        if (options.json) {
          const { serializeQueryResult } = await import("@hardkas/query");
          console.log(serializeQueryResult(result));
        } else { printCorrelationBundle(result); }
      } catch (e) { handleError(e); process.exitCode = 1; }
    });
}
