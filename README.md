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
- [ ] **v0.3**: Integrated L2 (SilverScripts/Igra) simulation.

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

- **Status**: **Mainnet broadcast is DISABLED in v0.1-dev.**
  - Submitting real transactions requires the `--yes` flag.
  - Receipts are saved in `.hardkas/real-receipts/`.
  - Use `simulated` mode for end-to-end local testing.

## License

MIT - See [LICENSE](LICENSE) for details.
