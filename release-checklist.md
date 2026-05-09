# HardKAS Release Checklist

This checklist must be completed and verified before any public or private Release Candidate (RC) tag.

## 1. Quality Gates
- [ ] `pnpm typecheck` passes with no errors in any package.
- [ ] `pnpm build` completes successfully for the entire monorepo.
- [ ] `pnpm test` passes 100% across all packages.
- [ ] `pnpm example:ci` passes (validates user-facing workflow examples).
- [ ] `pnpm example:dag-reorg` passes (validates complex simulation logic).

## 2. Artifact Integrity
- [ ] `hardkas artifact verify packages/artifacts/test/fixtures/golden --strict` passes.
- [ ] Recursive verification of `fixtures/corrupted` correctly rejects all items.

## 3. Distribution Integrity
- [ ] `pnpm pack` verification for core packages:
    - [ ] `@hardkas/cli`: contains `dist`, `README.md`, correct `bin`.
    - [ ] `@hardkas/sdk`: contains `dist`, `types`.
    - [ ] `@hardkas/artifacts`: contains `dist`, `types`.
    - [ ] `@hardkas/tx-builder`: contains `dist`, `types`.
    - [ ] `@hardkas/accounts`: contains `dist`, `types`.

## 4. Repository Hygiene
- [ ] `git status` is clean (no untracked files intended for inclusion).
- [ ] No temporary files (`scratch/`, `test-artifacts/`, etc.) in root.
- [ ] No plaintext secrets or keystores committed.
- [ ] `.gitignore` is up to date.

## 5. Automated Confidence
- [ ] GitHub Actions CI is **Green** for the target branch/commit.

## 6. Documentation
- [ ] `README.md` version matches `package.json`.
- [ ] `SECURITY.md` is present.
- [ ] `v0.2-alpha` banners are updated in CLI output.
