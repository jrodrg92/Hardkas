# HardKAS

**HardKAS** is a Kaspa-native developer operating environment and infrastructure-grade simulation toolkit. It provides a local-first, deterministic environment for planning, verifying, and debugging transactions and protocol-level integrations on the Kaspa BlockDAG.

> [!IMPORTANT]
> **Status: v0.2-alpha / Active Development**
> HardKAS is currently in early alpha. Features, APIs, and artifact formats are subject to evolution.

> [!CAUTION]
> **Not Production Custody Software.**
> HardKAS is a developer infrastructure tool. It is NOT intended for high-value mainnet custody. Always use dedicated, hardware-backed core wallets for production assets.

---

## Project Status

HardKAS is currently in active alpha development (v0.2-alpha).

The architecture is stabilizing, but users should be aware:
- **APIs may change**: Commands and SDK interfaces are not yet finalized.
- **Artifact formats may evolve**: Schema stability is a goal but not guaranteed.
- **Simulation is a light-model**: The localnet uses a deterministic light-model of the BlockDAG, not a full consensus implementation.
- **Encrypted Keystore**: Intended for developer workflows and local simulation only.
- **RPC Integrations**: Health and diagnostic features are still hardening.

---

## What HardKAS IS vs. IS NOT

### HardKAS IS:
- **Developer Tooling**: Built for high-velocity local iteration.
- **Deterministic Simulation**: Provides reproducible transaction and state models.
- **Transaction Planning**: Formalizes the lifecycle of a transaction from plan to receipt.
- **Replay/Debugging**: Enables deterministic tracing of past simulated events.
- **Artifact Verification**: Strict auditing of transaction integrity and semantics.
- **Localnet Orchestration**: Simplifies managing kaspad nodes and simulated states.
- **RPC Diagnostics**: Professional-grade network and node health tools.
- **Early L2 Integration**: Foundational support for Igra EVM integration workflows.

### HardKAS IS NOT:
- **Production Custody**: Not a secure wallet for large-scale assets.
- **Full Node Implementation**: HardKAS orchestrates nodes but is not one itself.
- **Consensus Implementation**: Does not replace the official kaspad consensus logic.
- **Full GHOSTDAG/DAGKnight Parity**: The light-model simulates effects, not the full consensus protocol.
- **Trustless Bridge System**: Pre-ZK bridge integrations rely on multisig/MPC assumptions.
- **EVM on L1**: There is no EVM execution on the Kaspa L1 layer.

---

## Architecture Honesty

HardKAS maintains strict boundaries between different architectural layers:

### Kaspa L1 (BlockDAG)
- **Model**: UTXO-based BlockDAG.
- **Responsibility**: Sequencing and Data Availability.
- **Execution**: No EVM or programmable account-based state on L1.

### Igra L2 (Execution)
- **Model**: EVM-compatible, account-based state.
- **Status**: Separate execution environment for programmable logic.
- **Support**: HardKAS provides early integration preflights for Igra deployments.

### Bridge Realities
- **Pre-ZK**: Bridge modeling assumes trusted multisig or committee-based MPC assumptions.
- **Target**: Move toward ZK-based trustless models as the protocol matures.

---

## Current Capabilities

### Stable (Alpha)
- **Deterministic Artifacts**: V2 schemas for Plans, SignedTx, and Receipts.
- **Replay Invariants**: Reproducible simulated transaction outcomes.
- **Snapshot Hashing**: Verifiable state snapshots for localnet persistence.
- **Semantic Verification**: Deep auditing of fee correctness and lineage.
- **Encrypted Dev Keystore**: Argon2id/AES-256 protected local keys.
- **RPC Resilience**: Automated retries, health scoring, and diagnostics.

### Experimental
- **Igra L2 Integration**: Early contract deployment preflights.
- **Bridge Modeling**: Modeling cross-chain state transitions.
- **DAG Light-Model**: High-level simulation of reorgs and conflict handling.
- **Lineage Extensions**: Advanced provenance tracking across complex flows.

### Planned
- **Multi-node Localnet**: Orchestrating local clusters for networking tests.
- **Visual Trace Explorer**: Browser-based visualization of BlockDAG traces.
- **SilverScript Tooling**: Native support for advanced Kaspa script auditing.
- **vProg Tooling**: Verified protocol-aware programming utilities.
- **Fuzzing Infrastructure**: Automated mutation testing for artifact resilience.

---

## Design Philosophy

- **Local-First**: High-fidelity development should not require an internet connection.
- **Simulation-First**: Validate logic in a deterministic environment before touching the wire.
- **Deterministic by Default**: Avoid ambient state; all operations should be reproducible.
- **Explicit over Implicit**: Clear artifact boundaries and visible metadata.
- **Replay-Safe**: All transaction logic must be audit-ready and replay-verifiable.
- **Infrastructure-Grade**: Professional observability and diagnostic discipline.
- **No Protocol Inflation**: No claims of protocol features (like L1 smart contracts) that do not exist.

---

## Installation & Usage

### Pre-release Source Install

```bash
git clone https://github.com/jrodrg92/Hardkas.git
cd Hardkas
pnpm install
pnpm build
```

### Run Locally

```bash
pnpm cli --help
```

---

## License

MIT - See [LICENSE](LICENSE) for details.
