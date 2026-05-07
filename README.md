# HardKAS

HardKAS is a Kaspa-native TypeScript developer toolkit. It is inspired by modern developer tooling, but it is built specifically for the Kaspa ecosystem.

## Core Principles

- **Kaspa-Native**: Kaspa L1 does not execute EVM smart contracts. HardKAS does not emulate Ethereum on Kaspa L1.
- **UTXO-First**: Transactions are planned and built around the UTXO model.
- **Simulated-First MVP**: The current MVP focuses on a high-fidelity local simulation for rapid development and testing.

## Current MVP Features

- **Simulated Local Devnet**: A fully in-memory simulated Kaspa chain.
- **Deterministic Accounts**: Pre-configured accounts (alice, bob, carol) with aliases for easy development.
- **UTXO Transaction Planning**: Logic to select UTXOs, calculate fees, and plan outputs (including change).
- **Transaction Simulation**: A lifecycle-based simulator to trace transaction progress from planning to "confirmation".
- **Tracing**: Detailed trace events for each phase of a transaction's lifecycle.
- **CLI**: A command-line interface to orchestrate the development environment.

## Getting Started

### Installation

```bash
pnpm install
pnpm build
```

### Start Local Devnet

```bash
pnpm --filter @hardkas/cli hardkas dev
```

### Simulate a Transaction

```bash
pnpm --filter @hardkas/cli hardkas tx simulate --from alice --to bob --amount 1
```

## Real node orchestration

The `hardkas node` commands allow you to manage a real `kaspad` or `rusty-kaspa` process locally.

- The simulated devnet does not need a real node.
- The real-local mode requires a `kaspad` binary (provided via `--binary` or in your PATH).
- HardKAS does not reimplement Kaspa; it orchestrates the official binaries.
- By default, `.hardkas` is stored in the workspace root: `.hardkas/nodes/<network>`.
- You can override this with the `--data-dir` flag.

### Commands

```bash
# Diagnose setup
hardkas node doctor --network devnet

# Start a node
hardkas node start --network devnet --binary /path/to/kaspad

# Check status
hardkas node status --network devnet

# View logs
hardkas node logs --network devnet

# Stop the node
hardkas node stop --network devnet

# Clean data
hardkas node clean --network devnet
hardkas node clean --network devnet --yes
```

- **Default Network**: `devnet` (uses `--devnet` flag).
- **Default RPC**: Binds to `127.0.0.1` for safety.
- **Data Directory**: Defaults to `<workspaceRoot>/.hardkas/nodes/<network>`.

## Project configuration

HardKAS can work without configuration using defaults, but you can initialize a project to customize networks and targets.

```bash
# Initialize a new project (creates hardkas.config.ts)
hardkas init

# Show current configuration (resolved path and networks)
hardkas config show
hardkas config show --json
```

### hardkas.config.ts

```typescript
import { defineHardkasConfig } from "@hardkas/config";

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
  }
});
```

- **Priority**: CLI flags (like `--url` or `--network`) always have priority over the configuration file.
- **Targets**:
  - `simulated`: In-memory simulation (Phase 1).
  - `kaspa-node`: Local node managed by HardKAS (Phase 2).
  - `kaspa-rpc`: External or remote RPC endpoint (Phase 3).
  - `igra`: Reserved for future Igra L2 integration.

## Accounts

HardKAS provides a robust identity management system through `@hardkas/accounts`.

```bash
# List all available accounts (defaults + config)
hardkas accounts list

# Show account details
hardkas accounts show alice

# Resolve an alias to a Kaspa address
hardkas accounts resolve bob
```

### Deterministic Accounts

By default, HardKAS includes deterministic simulated accounts for local development:
- `alice`: `kaspa:sim_alice`
- `bob`: `kaspa:sim_bob`
- `carol`: `kaspa:sim_carol`
- `dave`: `kaspa:sim_dave`
- `erin`: `kaspa:sim_erin`

### Account Configuration

You can define custom accounts in `hardkas.config.ts`:

```typescript
accounts: {
  alice: {
    kind: "simulated",
    address: "kaspa:sim_alice"
  },

  devnetDeployer: {
    kind: "kaspa-private-key",
    privateKeyEnv: "KASPA_DEVNET_PRIVATE_KEY"
  }
}
```

> [!IMPORTANT]
> **Security**: Never store real private keys directly in your configuration file. Always use `privateKeyEnv` to reference environment variables.

## Read-only balance and UTXO tools

HardKAS allows you to inspect account balances and UTXOs across different networks.

```bash
# Show balance (uses simnet by default)
hardkas balance alice

# List UTXOs
hardkas utxo list alice
```

- **Simulated Mode**: Queries the local in-memory state.
- **Real Mode**: Connects to a Kaspa node via wRPC JSON.

## Transaction planning

HardKAS allows you to build unsigned transaction plans. This is a read-only operation that selects UTXOs and estimates fees without signing or sending.

```bash
# Plan a transaction in simnet
hardkas tx plan --from alice --to bob --amount 1

# Plan a transaction in devnet using real UTXOs
hardkas tx plan --network devnet --from treasury --to kaspa:... --amount 10

# Output as JSON for integration
hardkas tx plan --from alice --to bob --amount 1 --json
```

- **tx simulate**: Focused on local simulation, trace lifecycle, and developer testing.
- **tx plan**: Focused on building valid plans using either simulated or real UTXOs from a node.

## Kaspa RPC adapter

The `hardkas rpc` commands allow you to interact with a real Kaspa node via its wRPC JSON interface.

- **Phase 3**: Supports health checks and node information.
- **Connection**: Uses WebSockets (`ws://`).
- **Simulated Mode**: Does not use or need a real RPC connection.

### Commands

```bash
# Check RPC health
hardkas rpc health --network devnet

# Get detailed node info
hardkas rpc info --network devnet
hardkas rpc info --network devnet --json
```

- **Default Network**: `devnet`.
- **Automatic Discovery**: Resolves the RPC URL from your `.hardkas` configuration if not provided via `--url`.

## Future Roadmap

- **Transaction sending**: Support for broadcasting real transactions to the network.
- **Wallet/Accounts adapter**: Integrated wallet management for real accounts.
- **Igra L2 Adapter**: Integration with Igra for EVM-compatible L2 workflows on Kaspa.
- **Silverscript Support**: Experimental support for Silverscript and advanced covenants.

- `@hardkas/core`: Base types, constants, and shared utilities.
- `@hardkas/tx-builder`: UTXO selection and transaction planning.
- `@hardkas/simulator`: Transaction lifecycle simulation and tracing.
- `@hardkas/localnet`: Deterministic accounts and simulated chain logic.
- `@hardkas/kaspa-rpc`: RPC client interfaces and mock implementations.
- `@hardkas/wallet-adapter`: Standardized interface for Kaspa wallet providers.
- `@hardkas/sdk`: Public-facing SDK re-exporting core functionality.
- `@hardkas/cli`: The `hardkas` command-line tool.

## License

MIT
