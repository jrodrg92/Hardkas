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
# Plan a transaction and save it as an artifact
hardkas tx plan --from alice --to bob --amount 1 --out plans/alice-to-bob.json

# Show details of a saved plan
hardkas tx plan show plans/alice-to-bob.json

# Validate a plan artifact
hardkas tx plan validate plans/alice-to-bob.json
```

- **tx plan new**: (Default) Builds a new plan.
- **tx plan show**: Displays a saved artifact.
- **tx plan validate**: Checks the integrity and schema of an artifact.

### Transaction plan artifacts

Artifacts are JSON files that store the result of a planning session. They are designed to be shared and eventually signed and sent.

- **Unsigned**: Artifacts do not contain private keys or signatures.
- **Portable**: BigInt values are stored as strings for cross-platform compatibility.
- **Schema-checked**: Every artifact includes a schema and version for forward compatibility.

## Signing artifacts

HardKAS implements a two-step transaction workflow: Planning and Signing. Phase 7C introduces **Signed Transaction Artifacts**, which store the result of a signing operation.

> [!NOTE]
> Currently, only **simulated signing** for `simnet` and `simulated` accounts is supported. Real Kaspa signing and broadcasting will be added in future phases.

```bash
# Sign a transaction plan artifact (simulated)
hardkas tx sign plans/alice-to-bob.json --account alice --out signed/alice-to-bob.signed.json

# Show details of a signed transaction
hardkas tx signed show signed/alice-to-bob.signed.json

# Validate a signed artifact
hardkas tx signed validate signed/alice-to-bob.signed.json
```

- **tx sign**: Creates a signed artifact from a plan. It links to the source plan via a cryptographic hash.
- **tx signed show**: Displays details including the source plan hash and signature kind.
- **tx signed validate**: Ensures the artifact conforms to the `hardkas.signedTx` schema.

### Security guardrails

- **No Private Keys**: Artifacts never store private keys.
- **No Env Exposure**: The system avoids reading sensitive environment variables unless explicitly required by a future real signer.
- **Simulated First**: Real signing attempts on `devnet` or with real keys will fail with a clear message until the feature is fully implemented.

## Signing foundation

HardKAS provides a robust signer adapter architecture (Phase 8) to handle transaction signing across different account types and networks.

> [!IMPORTANT]
> **Security**: Real transaction signing uses the official **Kaspa WASM SDK**. By default, HardKAS maintains a "simulated-first" posture. Real signing requires the optional `kaspa` package and an explicit environment variable for the private key.

### Signing Backends

- **Simulated**: Used for `simnet`. Fully operational without extra dependencies.
- **Real Kaspa (WASM)**: Powered by the official `kaspa` SDK. Enabled automatically if the package is installed.
- **External Wallet**: Reserved for future integration.

### Enabling Real Signing

To enable real Kaspa signing for `devnet` or `testnet`:

1.  **Install the SDK**:
    ```bash
    pnpm add kaspa
    ```
2.  **Configure Account**: In `hardkas.config.ts`, use `kind: "kaspa-private-key"`.
3.  **Set Environment Variable**:
    ```bash
    export KASPA_DEVNET_PRIVATE_KEY=...
    ```

### Diagnostics

Use the `doctor` command to verify your environment:

```bash
hardkas tx sign doctor
```

### Usage

```bash
# Sign a simulated plan
hardkas tx sign plans/a-to-b.json --account alice --out signed/a-to-b.signed.json

# Sign a real plan (requires 'kaspa' package and ENV)
hardkas tx sign plans/devnet-payment.json --account devnetDeployer --out signed/devnet.signed.json

# Signing for mainnet (DANGEROUS - Requires explicit flag)
hardkas tx sign plans/mainnet.json --account myWallet --allow-mainnet-signing
```

### Security guardrails

- **Dynamic Backend**: The WASM SDK is loaded only when needed. If missing, HardKAS remains safe and operational.
- **Mainnet Protection**: Signing for `mainnet` is blocked unless `--allow-mainnet-signing` is provided.
- **No Secret Storage**: Artifacts never store private keys, seeds, or environment variable values.
- **Strict Matching**: Prevents signing simulated plans with real keys or vice versa.

## Broadcasting signed transactions

HardKAS can broadcast signed transactions to a real Kaspa network (Phase 9) by reading a `hardkas.signedTx` artifact.

### Requirements

- **Real Network**: The artifact must target a real network (`devnet`, `testnet`, or `mainnet`).
- **Raw Transaction**: The artifact must contain a real raw transaction (`encoding: "kaspa-raw"`). Simulated signatures cannot be broadcast.
- **Confirmation**: Broadcasting requires the `--yes` flag.

### Preview Mode

If you run the send command without `--yes`, HardKAS will show a preview of the transaction without sending it:

```bash
hardkas tx send signed/devnet-payment.signed.json --network devnet
```

### Broadcast

To actually send the transaction to the network:

```bash
hardkas tx send signed/devnet-payment.signed.json --network devnet --yes
```

### Security guardrails

- **Mainnet Block**: Broadcasting to `mainnet` is blocked by default. Use `--allow-mainnet-broadcast` to override.
- **Network Mismatch**: HardKAS prevents broadcasting an artifact to a network different from the one it was signed for.
- **Explicit Confirmation**: The `--yes` flag ensures no accidental broadcasts.

## End-to-end transaction workflow

HardKAS provides a high-level command to orchestrate the full transaction lifecycle in a single step (Phase 10).

```bash
hardkas tx flow --from alice --to bob --amount 1
```

### Chaining Steps

The `tx flow` command can chain: **plan -> sign -> send**.

- **Default**: Only performs planning (safe preview).
- **--sign**: Plans and creates a signed artifact.
- **--send**: Plans, signs, and broadcasts the transaction (requires `--yes`).

### Artifact Management

Use `--out-dir` and `--name` to persist intermediate artifacts:

```bash
hardkas tx flow \
  --from alice \
  --to bob \
  --amount 1 \
  --sign \
  --out-dir runs \
  --name payment-1
```

This will create `runs/payment-1.plan.json` and `runs/payment-1.signed.json`.

### Examples

**Real devnet broadcast:**

```bash
hardkas tx flow \
  --network devnet \
  --from devnetDeployer \
  --to kaspa:p... \
  --amount 1 \
  --send \
  --yes \
  --out-dir runs
```

### Security Guardrails

- **Explicit --yes**: Required for broadcasting real transactions.
- **Mainnet Block**: Signing and broadcasting to `mainnet` are blocked by default.
- **Simulated Safety**: `tx flow --send` in `simnet` will skip the real broadcast step.

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
