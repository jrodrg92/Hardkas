import { formatSompi } from "@hardkas/core";

export const UI = {
  header(text: string) {
    console.log(`\n=== ${text} ===`);
  },
  
  divider() {
    console.log("--------------------------------------------------");
  },

  info(text: string) {
    console.log(`  ${text}`);
  },

  success(text: string) {
    console.log(`  \x1b[32m✔\x1b[0m ${text}`);
  },

  box(title: string, subtitle?: string) {
    console.log("\x1b[35m╔══════════════════════════════╗\x1b[0m");
    console.log(`\x1b[35m║         \x1b[1m${title.padEnd(7)}\x1b[0m\x1b[35m              ║\x1b[0m`);
    if (subtitle) {
      const padding = Math.max(0, Math.floor((26 - subtitle.length) / 2));
      console.log(`\x1b[35m║${"".padEnd(padding + 2)}\x1b[3m${subtitle}\x1b[0m${"".padEnd(28 - padding - 2 - subtitle.length)}║\x1b[0m`);
    }
    console.log("\x1b[35m╚══════════════════════════════╝\x1b[0m");
    console.log("");
  },

  warning(text: string) {
    console.log(`\n⚠️  WARNING:`);
    console.log(`   ${text}`);
  },

  error(msg: string, suggestion?: string) {
    console.error(`\n❌ Error:`);
    console.error(`   ${msg}`);
    if (suggestion) {
      console.error(`\n💡 Suggestion:`);
      console.error(`   ${suggestion}`);
    }
  },

  field(label: string, value: string | number | boolean | undefined | null) {
    const val = value === undefined || value === null ? "none" : String(value);
    console.log(`  ${label.padEnd(14)} ${val}`);
  },

  kas(label: string, sompi: bigint | string) {
    this.field(label, formatSompi(BigInt(sompi)));
  },

  footer(hint?: string) {
    if (hint) {
      console.log(`\nHint: ${hint}`);
    }
    console.log("");
  }
};

export function handleError(e: unknown, context?: string) {
  const msg = e instanceof Error ? e.message : String(e);
  const errorObj = e as any;
  
  let reason = errorObj.reason;
  let suggestion = errorObj.suggestion;

  if (msg === "Real transaction signing is not available") {
    console.error(`\n${msg}`);
    if (reason) console.error(`\nReason:\n  ${reason}`);
    if (suggestion) console.error(`\nSuggestion:\n  ${suggestion}\n  No artifact was written.`);
    return;
  }

  if (!suggestion) {
    if (msg.includes("Localnet state not found")) {
      suggestion = "Run 'hardkas localnet reset' to initialize the simulated environment.";
    } else if (msg.includes("Insufficient funds")) {
      suggestion = "Use 'hardkas faucet <address> <amount>' to add funds to your account.";
    } else if (msg.includes("Account not found")) {
      suggestion = "Check your 'hardkas.config.ts' or use a full Kaspa address.";
    } else if (msg.includes("Docker") || msg.includes("container")) {
      suggestion = "Ensure Docker is running and you have permissions to manage containers.";
    } else if (msg.includes("L2 RPC") || msg.includes("L2 profile")) {
      suggestion = "Check your L2 network configuration or pass a valid --url.";
    } else if (msg.includes("RPC") || msg.includes("Connection refused")) {
      suggestion = "The Kaspa node might still be starting. Try 'hardkas rpc health --wait'.";
    } else if (msg.includes("submitTransaction is not exposed")) {
      suggestion = "Ensure your node/RPC provider supports transaction submission and you are NOT on mainnet without --allow-mainnet-signing.";
    }
  }

  UI.error(context ? `${context}: ${msg}` : msg, suggestion);
}
