# HardKAS

**HardKAS** is a production-grade developer toolkit for the Kaspa ecosystem. It provides a robust, Kaspa-native environment for building, testing, and deploying decentralized applications and protocols.

> **Status: v0.1-dev (Early Preview)**
> HardKAS is currently in active development. Features and APIs are subject to change.

---

## Core Philosophy

- **Kaspa Native**: Designed from the ground up for Kaspa's BlockDAG architecture. No EVM/Ethereum legacy assumptions.
- **Developer First**: Focus on high-speed iteration, robust diagnostics, and actionable feedback.
- **Hybrid Workflow**: Seamlessly switch between a high-fidelity **Simulated Mode** and a real **Node Mode** backed by `kaspad`.

## Main Features

### 1. Persistent Simulated Localnet
Develop and test without waiting for block confirmations or managing real funds.
- **Instant confirmations**: Zero-latency transaction processing.
- **Persistence**: Localnet state (balances, UTXOs) survives restarts in `.hardkas/localnet.json`.
- **Snapshots**: Capture and restore state at any point for reproducible tests.
- **Faucet**: Instantly fund any address or alias.

### 2. Real Kaspa Node Mode
Run a local `kaspad` node in Docker with a single command.
- **Automated Orchestration**: HardKAS manages Docker containers for you.
- **RPC Diagnostics**: Comprehensive health checks, mempool inspection, and DAG status.
- **Simnet Ready**: Pre-configured for local simulation networks.

### 3. Advanced Transaction Tooling
- **Simulated Traces**: Detailed step-by-step logs of how a transaction was processed.
- **Persistent Receipts**: Every simulated transaction generates a verifiable receipt.
- **Replay System**: Reproduce any past simulated transaction to debug logic changes.
- **Plan & Sign Workflow**: Multi-step transaction lifecycle for security and auditability.

### 4. Developer Account Management
Securely manage real Kaspa development keys.
- **Local Storage**: Encrypted (roadmap) storage for dev addresses and keys.
- **SDK Integration**: Key generation using the official Kaspa WASM SDK.
- **Security Guardrails**: Protection against accidental mainnet usage and plaintext exposure.

---

## Quickstart

### Installation

```bash
pnpm install -g @hardkas/cli
```

### Initialize Project

```bash
hardkas init
```

### Start Simulated Development

```bash
# Start the simulated environment
hardkas dev

# Fund an account
hardkas faucet alice 1000

# Check balance
hardkas balance alice

# Simulate a transaction
hardkas tx simulate --from alice --to bob --amount 10

# Send and mutate state
hardkas tx send --from alice --to bob --amount 10 --yes
```

---

## Security Warnings

- **Development Only**: HardKAS v0.1-dev is intended for local development and testing.
- **Plaintext Keys**: In this version, `.hardkas/accounts.real.json` stores keys in plaintext. Ensure this file is never committed to version control.
- **No Mainnet**: Do not use HardKAS with real Mainnet funds yet. The toolkit is optimized for `simnet` and `testnet-10`.

## Roadmap

- [x] **v0.1-dev**: Persistent localnet, basic transaction flow, RPC diagnostics, account management.
- [ ] **v0.2**: Real transaction signing and broadcasting, encrypted keystores, and BIP39 support.
- [x] **v0.3**: Integrated L2 (SilverScripts/Igra) simulation foundation.

### Real Transaction Support
HardKAS has started laying the foundation for real Kaspa network transactions.
- **Artifact Prepared**: `RealTxPlanArtifact` schema is defined for node/rpc modes.
- **Validation**: Strict schema and financial data validation are in place.
- **Account Queries**: Inspect real on-chain state for your dev accounts.
  ```bash
  # Check balance and UTXOs on a real node/simnet
  hardkas accounts real balance alice
  hardkas accounts real utxos alice

  # Build a real transaction plan artifact
  hardkas tx real build --from alice --to kaspa:... --amount 1

  # Sign a real transaction plan (requires 'kaspa' package installed)
  hardkas tx real sign plans/realplan_....real.plan.json --account alice

  # Submit a signed transaction (requires --yes, mainnet is blocked)
  hardkas tx real send signed/signed_....real.signed.json --yes
  ```

## Mainnet Broadcast Disabled

> [!IMPORTANT]
> **Mainnet broadcast is disabled in v0.1-dev.**
> Production transaction submission is intentionally unavailable in this development release.
> Use `simnet` or `testnet-10` for real transaction testing.

## Igra / Kaspa L2 Profiles

HardKAS provides foundation support for Layer 2 (L2) networks built on Kaspa, with a primary focus on the **Igra** EVM-based rollup.

> [!NOTE]
> HardKAS v0.1-dev supports L2 profile metadata and registry management. Transaction submission and bridge automation are not yet available for L2.

### Igra L2 RPC diagnostics
HardKAS provides read-only diagnostics for EVM-compatible L2 networks. This allows you to verify node connectivity and basic network state.

> [!IMPORTANT]
> These commands use EVM JSON-RPC to query L2 state. They do not interact with the Kaspa L1 UTXO state or the bridge automation.

```bash
# Check L2 RPC health and connectivity
hardkas l2 rpc health --network igra --url <rpcUrl>

# Wait for L2 RPC to be ready
hardkas l2 rpc health --network igra --url <rpcUrl> --wait

# Query basic L2 state
hardkas l2 rpc chain-id --url <rpcUrl>
hardkas l2 rpc block-number --url <rpcUrl>
hardkas l2 rpc gas-price --url <rpcUrl>
```

### Igra L2 account state
HardKAS allows you to inspect the state of EVM accounts on L2 networks.

> [!IMPORTANT]
> These commands read L2 EVM account state. This is NOT a Kaspa L1 UTXO balance. No signing or sending is performed.

```bash
# Check L2 balance for an address
hardkas l2 balance 0x... --network igra --url <rpcUrl>

# Check L2 nonce (transaction count)
hardkas l2 nonce 0x... --network igra --url <rpcUrl>

# Output as JSON
hardkas l2 balance 0x... --json
```

### Igra L2 preflight calls
HardKAS supports simulating EVM execution on L2 without sending transactions.

> [!IMPORTANT]
> These commands use EVM JSON-RPC to simulate/read state. They do not sign or broadcast transactions. L2 gas is not Kaspa L1 transaction mass.

```bash
# Perform a read-only EVM call
hardkas l2 call --to 0x... --data 0x... --url <rpcUrl>

# Estimate gas for a call
hardkas l2 estimate-gas --from 0x... --to 0x... --data 0x... --url <rpcUrl>
```

### Igra L2 transaction artifacts
HardKAS uses canonical, versioned artifacts for L2 transactions, isolated from Kaspa L1 UTXO artifacts.

- **`IgraTxPlanArtifact`**: Schema `hardkas.igraTxPlan.v1`. Used for planning EVM transactions.
- **`IgraSignedTxArtifact`**: Schema `hardkas.igraSignedTx.v1`. Stores raw signed EVM transactions.
- **`IgraTxReceiptArtifact`**: Schema `hardkas.igraTxReceipt.v1`. Tracks L2 submission and confirmation.

Example metadata:
```json
{
  "schema": "hardkas.igraTxPlan.v1",
  "hardkasVersion": "0.1.0-dev",
  "networkId": "igra",
  "mode": "l2-rpc",
  "createdAt": "2026-..."
}
```

### Igra L2 transaction plans
You can build a transaction plan for Igra/L2 using the CLI. This will fetch network data and simulate execution to estimate fees.

```bash
# Build a transaction plan
# Note: --value is in wei decimal, not iKAS.
hardkas l2 tx build --network igra --url <rpcUrl> --from 0x... --to 0x... --value 1000000000000000000
```

> [!NOTE]
> L2 transaction plans are stored in the `plans/` directory by default. They are strictly account-based and do not interact with Kaspa L1 UTXO state.

### Igra L2 signing
HardKAS supports signing Igra/L2 transaction plans using an EVM-compatible signing adapter (powered by `viem`).

> [!IMPORTANT]
> **L2 signing requires an account with an EVM 0x address and a valid private key.** 
> Kaspa L1 addresses (e.g., `kaspa:...`) cannot be used for L2 signing.
> Private keys are loaded from `.hardkas/accounts.real.json` and are never printed to the console.

```bash
# Sign an L2 transaction plan
hardkas l2 tx sign plans/p1.igra.plan.json --account alice
```

Success will generate a `*.igra.signed.json` artifact in the `signed/` directory.

> [!WARNING]
> **L2 transaction sending is not yet implemented.** 
> Signing an Igra L2 transaction is isolated from Kaspa L1 UTXO signing.

### Igra L2 transaction send
HardKAS supports broadcasting signed Igra/L2 transactions using `eth_sendRawTransaction`.

> [!IMPORTANT]
> **L2 transaction sending requires the `--yes` flag.**
> Before sending, HardKAS verifies that the RPC endpoint's `chainId` matches the artifact.
> Mainnet/production broadcast is disabled in v0.1-dev.

```bash
# Send a signed L2 transaction
hardkas l2 tx send signed/s1.igra.signed.json --network igra --url <rpcUrl> --yes
```

Success will generate an `IgraTxReceiptArtifact` in `.hardkas/l2-receipts/`.

### Igra L2 receipts and status
HardKAS provides tools to list and inspect the status of Igra L2 transactions.

```bash
# List local transaction receipts
hardkas l2 tx receipts

# Inspect local and remote status for a transaction
hardkas l2 tx receipt 0x... --network igra --url <rpcUrl>

# Quick remote status check (success/reverted/pending)
hardkas l2 tx status 0x... --network igra --url <rpcUrl>
```

> [!NOTE]
> - **Local receipts** are stored as artifacts in `.hardkas/l2-receipts/`.
> - **Remote status** is queried directly from the L2 EVM node via `eth_getTransactionReceipt`.
- These commands only track Igra L2 transaction execution; they do not imply Kaspa L1 bridge finality or ZK exit completion.

### Igra bridge awareness
HardKAS models bridge assumptions but does **not** perform bridge operations (deposit/withdraw/claim) in v0.1-dev. Bridge security is phase-dependent.

```bash
# Show bridge security status and risks
hardkas l2 bridge status --network igra

# Show detailed bridge security assumptions
hardkas l2 bridge assumptions --network igra
```

### Igra L2 contract deployment planning
Build deployment plans for EVM contracts on Igra L2. This includes bytecode and optional constructor argument encoding.

```bash
# Basic deployment plan
hardkas l2 contract deploy-plan \
  --from 0x... \
  --bytecode 0x...

# Deployment plan with constructor arguments
hardkas l2 contract deploy-plan \
  --from 0x... \
  --bytecode 0x... \
  --constructor "constructor(address,uint256)" \
  --args "0x...,1000"
```

> [!NOTE]
> - This only builds a **deployment plan**. It does not sign or send the transaction.
> - Use `hardkas l2 tx sign` and `hardkas l2 tx send` to complete the deployment.
> - This is for Igra L2 EVM deployment, not Kaspa L1.

> [!WARNING]
> - **Trustless exit** is available only in the **ZK phase**.
> - pre-ZK and MPC phases involve stronger trust assumptions regarding bridge custody and validators.
> - Always verify the current bridge implementation on the live network before moving significant funds.

### Architecture Guardrails
- **Strict Separation**: Igra L2 EVM operations are entirely decoupled from Kaspa L1 UTXO logic.
- **Kaspa L1 Role**: Kaspa provides sequencing, data availability (DA), and state anchoring. It does **not** execute EVM.
- **Igra L2 Role**: Full EVM execution and account-based state management occur on L2.
- **Bridge Security**: Security is phase-dependent (`pre-ZK` -> `MPC` -> `ZK`). Trustless exit exists **only** in the ZK phase.
- **Safety First**: Mainnet broadcasting is blocked in v0.1-dev. All L2 commands require explicit network/RPC configuration.

### CLI Usage
```bash
# List supported L2 networks
hardkas l2 networks

# Show detailed profile and security assumptions
hardkas l2 profile show igra
```

## Artifact Schemas

HardKAS uses a canonical, versioned schema for all persistent artifacts. Every artifact includes a metadata header for integrity and cross-environment validation.

Example of a Transaction Plan (`plans/*.json`):
```json
{
  "schema": "hardkas.txPlan.v1",
  "hardkasVersion": "0.1.0-dev",
  "networkId": "testnet-10",
  "mode": "node",
  "createdAt": "2026-05-07T12:00:00Z",
  "status": "unsigned",
  ...
}
```

- **schema**: Canonical versioned identifier (`hardkas.<type>.v1`).
- **hardkasVersion**: Version of the tool that generated the artifact.
- **networkId**: The target Kaspa network (e.g., `simnet`, `testnet-10`).
- **mode**: The execution mode used (`simulated`, `node`, `rpc`).
- **createdAt**: ISO 8601 creation timestamp.

### Supported Schemas
- `hardkas.localnetState.v1`: Simulated localnet state.
- `hardkas.realAccountStore.v1`: Real development account storage.
- `hardkas.simulatedTxReceipt.v1`: Receipt for simulated transactions.
- `hardkas.simulatedTxTrace.v1`: Detailed execution trace for simulated transactions.
- `hardkas.txPlan.v1`: Transaction plan for simulated or real networks.
- `hardkas.signedTx.v1`: Signed transaction ready for broadcast.
- `hardkas.realTxPlan.v1`: Plan artifact specific to real Kaspa nodes.
- `hardkas.realSignedTx.v1`: Signed artifact specific to real Kaspa nodes.
- `hardkas.realTxSubmitReceipt.v1`: Receipt for transactions submitted to real nodes.
- `hardkas.igraTxPlan.v1`: Igra L2 EVM transaction or contract deployment plan.
- `hardkas.igraSignedTx.v1`: Igra L2 signed EVM transaction.
- `hardkas.igraTxReceipt.v1`: Igra L2 local submission receipt.
- `hardkas.l2Profile.v1`: Igra L2 network profile and security metadata.
- `hardkas.l2BridgeAssumptions.v1`: Igra bridge security and risk profile.

- **Status**: **Mainnet broadcast is DISABLED in v0.1-dev.**
  - Submitting real transactions requires the `--yes` flag.
  - Receipts are saved in `.hardkas/real-receipts/`.
  - Use `simulated` mode for end-to-end local testing.

## License

MIT - See [LICENSE](LICENSE) for details.
