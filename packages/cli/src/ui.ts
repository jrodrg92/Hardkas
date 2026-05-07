import { formatSompi } from "@hardkas/core";

export const UI = {
  header(text: string) {
    console.log(`\n=== ${text} ===`);
  },

  info(text: string) {
    console.log(`  ${text}`);
  },

  success(text: string) {
    console.log(`\n✅ ${text}`);
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
    this.field(label, formatSompi(sompi));
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
    } else if (msg.includes("RPC") || msg.includes("Connection refused")) {
      suggestion = "The Kaspa node might still be starting. Try 'hardkas rpc health --wait'.";
    } else if (msg.includes("submitTransaction is not exposed")) {
      suggestion = "HardKAS v0.1-dev only supports transaction broadcasting in 'simulated' mode.";
    }
  }

  UI.error(context ? `${context}: ${msg}` : msg, suggestion);
}
