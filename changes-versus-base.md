# Changes Versus Base

Date: 2026-02-16  
Repo: `<REPO_ROOT>`

## Purpose

This is the onboarding summary of what changed in this fork versus base, with formatting churn separated from functional work.

## Baselines

1. Fork base (`merge-base` with `upstream/main`):  
   `6440eb51831744fc3fbc09a20641a294ba796717`  
   Commit: `Merge pull request #328 from cloudflare/nightly`
2. Formatting baseline (pre-functional tree anchor):  
   `f26aaca` (tree-equivalent to historical `7128322e12e17e77d39530806ba06d63c94dfdfc`)
3. Current squashed `main` commits after base:
   - `f26aaca` `chore: squash formatting pass (16cffa6..7128322)`
   - `85fc9f4` `fix: squash local mac m1 sandbox reliability changes (563c7f8..6cc763d)`

Why two baselines:

- `6440eb5..HEAD` captures all fork changes (including large formatting churn).
- `f26aaca..85fc9f4` isolates functional/stabilization work.

## Delta Summary

1. Formatting/meta wave (`6440eb5..f26aaca`):
   - 557 files changed, 78,394 insertions, 79,545 deletions
   - primarily formatting + blame-ignore setup
2. Functional/stabilization wave (`f26aaca..85fc9f4`):
   - 20 files changed, 2,129 insertions, 198 deletions
   - reliability, deployment hardening, Apple Silicon local support, local docker portability, route fix, and handoff docs
3. Total (`6440eb5..HEAD`):
   - 567 files changed, 80,321 insertions, 79,541 deletions

## Functional Workstreams Included (Now Squashed)

Original work merged into this functional wave includes:

1. `fix/sandbox-file-write-robustness` (PR #2)
2. `fix/frontend-preview-dedupe-and-ws-normalization` (PR #5)
3. `fix/deployment-retry-improvements` (PR #3)
4. `fix/apple-silicon-sandbox-platform` (PR #1)
5. `feat/update-model-inference-config` (PR #4)
6. `codex/fix-stale-loop-and-signal-restore` (PR #6)
7. local sandbox/mac portability + warning-analysis docs (PR #7 + PR #8)

These are intentionally condensed into one functional commit (`85fc9f4`) for cleaner history.

## Functional Changes by Area

### 1) Sandbox file-write reliability

File:

- `worker/services/sandbox/sandboxSdkClient.ts`

What changed:

- deterministic UTF-8 base64 handling
- hardened shell write path and path escaping
- unique temp script usage + cleanup
- better partial-failure propagation

### 2) Frontend preview deploy dedupe + WS envelope normalization

Files:

- `src/routes/chat/hooks/use-chat.ts`
- `src/routes/chat/utils/handle-websocket-message.ts`

What changed:

- in-flight deploy guards
- stale guard timeout reset logic
- normalized malformed websocket envelope payloads

### 3) Deployment retry/stale-loop hardening

File:

- `worker/agents/services/implementations/DeploymentManager.ts`

What changed:

- longer per-attempt timeout
- generation-token stale guards
- stale-safe reset behavior
- startup-failure circuit breaker improvements

### 4) Apple Silicon local sandbox strategy

Files:

- `SandboxDockerfile`
- `scripts/setup.ts`
- `scripts/deploy.ts`

What changed:

- local amd64 platform strategy for Docker image compatibility on Apple Silicon
- setup/deploy cleanup and restoration hardening

### 5) Model inference configuration updates

File:

- `worker/agents/inferutils/config.ts`

What changed:

- updated Gemini model routing defaults/fallback behavior
- expanded model constraints in selected operations

### 6) Local docker host portability + route/preview fixes

Files:

- `package.json`
- `scripts/dev.ts` (new)
- `src/lib/utils.ts`
- `worker/api/routes/index.ts`

What changed:

- moved `dev` launcher to `tsx scripts/dev.ts`
- auto-detects docker socket and sets `WRANGLER_DOCKER_HOST` without hardcoding a user path
- preserves `npm run dev -- <vite flags>` forwarding
- local preview URL fallback prefers tunnel URL in dev
- re-enabled user secrets vault route registration

### 7) Documentation/handoff additions

Added files:

- `VIBESDK-ARCHITECTURE-DEEP-DIVE.md`
- `changes-versus-base.md` (this file)
- `rarestg-docs/sandbox-creation-failure-report.md`
- `rarestg-docs/sandbox-creation-failure-report-extra.md`
- `rarestg-docs/vault-status-bug-report.md`
- `rarestg-docs/monaco-editor-bug-report.md`
- `rarestg-docs/MONACO-INMEMORY-MODEL-WARNING-FIX-GUIDE.md`
- `FRAMER-TRANSFORMORIGIN-WARNING-FIX-GUIDE.md`

Notes:

- Monaco/Framer warning work in this wave is documentation + fix guidance, not direct code patches for those warnings yet.

## File-Level Functional Delta (`f26aaca..85fc9f4`)

- `FRAMER-TRANSFORMORIGIN-WARNING-FIX-GUIDE.md`: +139 / -0
- `rarestg-docs/MONACO-INMEMORY-MODEL-WARNING-FIX-GUIDE.md`: +152 / -0
- `SandboxDockerfile`: +6 / -6
- `VIBESDK-ARCHITECTURE-DEEP-DIVE.md`: +536 / -0
- `changes-versus-base.md`: +198 / -0
- `rarestg-docs/monaco-editor-bug-report.md`: +60 / -0
- `package.json`: +1 / -1
- `rarestg-docs/sandbox-creation-failure-report-extra.md`: +196 / -0
- `rarestg-docs/sandbox-creation-failure-report.md`: +248 / -0
- `scripts/deploy.ts`: +53 / -27
- `scripts/dev.ts`: +57 / -0
- `scripts/setup.ts`: +32 / -17
- `src/lib/utils.ts`: +15 / -1
- `src/routes/chat/hooks/use-chat.ts`: +20 / -2
- `src/routes/chat/utils/handle-websocket-message.ts`: +42 / -6
- `rarestg-docs/vault-status-bug-report.md`: +77 / -0
- `worker/agents/inferutils/config.ts`: +60 / -56
- `worker/agents/services/implementations/DeploymentManager.ts`: +184 / -44
- `worker/api/routes/index.ts`: +3 / -3
- `worker/services/sandbox/sandboxSdkClient.ts`: +50 / -35

Total: 20 files, 2,129 insertions, 198 deletions

## Recompute Commands

```bash
# Confirm fork base
git merge-base main upstream/main

# Show squashed commits after base
git log --reverse --oneline 6440eb5..HEAD

# Full delta (formatting + functional)
git diff --shortstat 6440eb5..HEAD

# Formatting wave
git diff --shortstat 6440eb5..f26aaca

# Functional wave
git diff --shortstat f26aaca..85fc9f4
git diff --numstat f26aaca..85fc9f4
```
