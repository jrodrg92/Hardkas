# HardKAS

**HardKAS** is a Kaspa-native developer operating environment. It provides a robust, developer-centric environment for building, testing, and diagnosing decentralized applications and protocols on the Kaspa BlockDAG.

> **Status: v0.2-alpha / active development**
> HardKAS is currently in active development. Features and APIs are subject to change.

> [!CAUTION]
> **Not production custody software.**
> HardKAS is a development tool. Do not use it as a primary wallet for high-value mainnet funds. Always use dedicated, hardware-backed custody for production assets.

---

## Core Philosophy

- **Kaspa Native**: Designed from the ground up for Kaspa's BlockDAG architecture. No EVM/Ethereum legacy assumptions.
- **Developer First**: Focus on high-speed iteration, robust diagnostics, and actionable feedback.
- **Hybrid Workflow**: Seamlessly switch between a high-fidelity **Simulated Mode** and a real **Node Mode** backed by `kaspad`.
- **Simulation Transparency**: Clear boundaries between simulated behavior and real-world consensus. See [Simulation Model](docs/architecture/simulation-model.md).

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
- **V2 Artifacts**: Versioned, verifiable receipts and plans for all transaction types.
- **Replay System**: Reproduce any past simulated transaction to debug logic changes.
- **Plan & Sign Workflow**: Multi-step transaction lifecycle for security and auditability.

### 4. Developer Account Management
Securely manage real Kaspa development keys.
- **Encrypted Keystore (V2)**: Persistent real accounts are stored using Argon2id and AES-256-GCM.
- **SDK Integration**: Key generation and signing using the official Kaspa SDK.
- **Security Guardrails**: Protection against accidental mainnet usage and environment cross-contamination.

### 5. Diagnostics & Verification
- **RPC Doctor**: Comprehensive network and node health diagnostics.
- **Artifact Verify**: Strict semantic and integrity auditing of versioned transaction artifacts.
- **DAG Simulation**: Real-time observability and reorg simulation for localnet states.

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

# Build and send a transaction (Shortcut)
hardkas tx send --from alice --to bob --amount 10 --yes
```

---

## Security & Privacy

- **Development Only**: HardKAS is intended for local development and testing.
- **Encrypted Keystore**: Real accounts are stored in `.hardkas/keystore/`, encrypted with a user-defined password. Never commit this directory to version control.
- **Mainnet Guardrails**: Mainnet signing and broadcasting require explicit flags (`--allow-mainnet-signing`).
- **No Analytics**: HardKAS does not collect or transmit any developer data or private keys to external servers.

## Roadmap

- [x] **v0.1**: Initial CLI, basic simulation.
- [x] **v0.2-alpha**: Persistent localnet, V2 Artifacts, RPC diagnostics, Encrypted Keystore, DAG Light-Model.
- [ ] **v0.2**: BIP39 seed phrase support, extended replay analysis, multi-signature simulation.
- [ ] **v0.3**: Integrated L2 (Igra) bridge automation and pre-ZK preflights.
- [ ] **v0.4**: Advanced BlockDAG visualizer and cross-environment state diffing.

## Artifact Schemas (V2)

HardKAS uses a canonical, versioned schema for all persistent artifacts. Every artifact includes a metadata header for integrity and cross-environment validation.

- `hardkas.txPlan.v2`: Transaction plan for simulated or real networks.
- `hardkas.signedTx.v2`: Signed transaction ready for broadcast.
- `hardkas.txReceipt.v2`: Receipt for L1 transactions.
- `hardkas.txTrace.v2`: Detailed execution trace for simulated transactions.
- `hardkas.localnetState.v1`: Simulated localnet state.
- `hardkas.igraTxPlan.v1`: Igra L2 EVM transaction or contract deployment plan.
- `hardkas.igraSignedTx.v1`: Igra L2 signed EVM transaction.
- `hardkas.igraTxReceipt.v1`: Igra L2 local submission receipt.

---

## License

MIT - See [LICENSE](LICENSE) for details.
