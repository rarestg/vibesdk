# Changes Versus Base

Date: 2026-02-16  
Repo: `/Users/rares/GITHUB/SANDBOX/vibesdk`

## Purpose

This document is an onboarding summary of what changed in this fork versus its base, with formatting noise separated from functional changes.

## Baselines

1. Fork base (merge-base with `upstream/main`): `6440eb51831744fc3fbc09a20641a294ba796717`  
   Commit: `Merge pull request #328 from cloudflare/nightly`
2. Post-format baseline: `7128322e12e17e77d39530806ba06d63c94dfdfc`  
   Commit: `chore: add second formatting commit to blame-ignore-revs`
3. Current main at time of writing: `4a75589f642ca1db78ec47e1c58ca5ff05d6b074`

Why two baselines:

- `6440eb5..HEAD` captures all fork changes (including large formatting churn).
- `7128322..HEAD` isolates the functional changes merged in this stabilization wave.

## Delta Summary

1. Formatting/meta wave (`6440eb5..7128322`):
   - 557 files changed, 78,394 insertions, 79,545 deletions
   - primarily formatting + blame-ignore setup
2. Functional wave (`7128322..HEAD`):
   - 8 files changed, 397 insertions, 188 deletions
   - reliability, deployment, local Apple Silicon support, and model config updates

## Merged Functional Workstreams

1. `fix/sandbox-file-write-robustness` (PR #2)
2. `fix/frontend-preview-dedupe-and-ws-normalization` (PR #5)
3. `fix/deployment-retry-improvements` (PR #3)
4. `fix/apple-silicon-sandbox-platform` (PR #1)
5. `feat/update-model-inference-config` (PR #4)

Representative commits (since `7128322`):

- `563c7f8`, `b47d254`, `ed2ffcc`, `0258e91`
- `b49e0dc`, `c8fdc39`
- `d925320`, `e80d278`
- `6eeea0d`, `822bb8a`
- `9ce647e`, `14cc524`

## Functional Changes by Area

### 1) Sandbox file-write reliability

File:

- `worker/services/sandbox/sandboxSdkClient.ts`

What changed:

- replaced chunked `btoa` concatenation with deterministic UTF-8 base64 encoding
- hardened shell writing (`printf '%s' | base64 -d`) and single-quote escaping for paths
- switched temp script path to per-operation unique file
- added script cleanup in `finally`
- propagated partial write failures instead of returning blanket success

Effect:

- reduced corruption/collision risk and made partial failures visible to retry logic

### 2) Frontend preview deploy dedupe + WS envelope normalization

Files:

- `src/routes/chat/hooks/use-chat.ts`
- `src/routes/chat/utils/handle-websocket-message.ts`

What changed:

- added in-flight preview deploy guard refs
- added stale guard timeout reset logic (30s window)
- prevented repeated auto-preview requests during reconnect/state replay while a request is in flight
- normalized malformed websocket envelopes where `type` contains a JSON string payload

Effect:

- lower duplicate deploy pressure and cleaner WS state restoration behavior

### 3) Deployment retry hardening

File:

- `worker/agents/services/implementations/DeploymentManager.ts`

What changed:

- per-attempt timeout raised from 60s to 150s to exceed sandbox SDK internal retry window
- deployment generation tokens added to detect superseded retry loops
- stale checks added at pre-attempt, post-cooldown, and post-result points
- circuit breaker added:
  - threshold: 5 startup-failure matches
  - cooldown: 60s
- startup-failure counter resets on non-startup errors (true consecutive semantics)
- per-attempt guard prevents duplicate session resets
- timeout late-completion diagnostics added
- health-check redeploy skips when deployment is already in progress

Effect:

- reduces retry-loop amplification and improves resilience/observability during runtime instability

### 4) Apple Silicon local sandbox platform strategy

Files:

- `SandboxDockerfile`
- `scripts/setup.ts`
- `scripts/deploy.ts`

What changed:

- local Dockerfile base explicitly set to `--platform=linux/amd64`
- cloudflared architecture resolution moved to runtime detection (`dpkg --print-architecture` fallback `uname -m`)
- setup patching now only applies on Apple Silicon (`arm64` + `darwin`)
- setup rewrites legacy arm64 platform overrides to amd64 override
- deployment cleanup strips both arm64 and amd64 local overrides before deploy, then restores original content in `finally`

Effect:

- unblocks Apple Silicon local setup against amd64-only sandbox image manifests while keeping deploy path clean

### 5) Model inference configuration updates

File:

- `worker/agents/inferutils/config.ts`

What changed:

- removed unused `LiteModels` / `RegularModels` imports
- moved broad fallback usage to `GEMINI_3_FLASH_PREVIEW`
- default Gemini configuration moved to PRO-primary + FLASH-fallback mapping for major operations
- expanded constraints to `AllModels` for:
  - `projectSetup`
  - `conversationalResponse`
  - `templateSelection`

Effect:

- restores meaningful fallback behavior and broadens model routing flexibility

## File-Level Functional Delta (`7128322..HEAD`)

- `SandboxDockerfile`: +6 / -6
- `scripts/deploy.ts`: +19 / -22
- `scripts/setup.ts`: +32 / -17
- `src/routes/chat/hooks/use-chat.ts`: +20 / -2
- `src/routes/chat/utils/handle-websocket-message.ts`: +42 / -6
- `worker/agents/inferutils/config.ts`: +60 / -56
- `worker/agents/services/implementations/DeploymentManager.ts`: +168 / -44
- `worker/services/sandbox/sandboxSdkClient.ts`: +50 / -35

Total: 8 files, 397 insertions, 188 deletions

## Verification Snapshot

Executed on `main` at 2026-02-16 11:12 EST:

1. `npm run typecheck` -> pass
2. `npm run lint` -> pass
3. `npm run build` -> pass (warnings only)
4. `npm run test` -> pass (`9` test files, `213` passed, `1` skipped)

Observed non-blocking warnings:

- Vite/Rolldown warning for deprecated `optimizeDeps.esbuildOptions`
- chunk-size warnings during frontend build
- expected noisy stderr from parser fuzz/safety tests

## Known Follow-ups

1. `scripts/deploy.ts`: signal handlers still call `process.exit(1)` directly, which can bypass Dockerfile restoration on interrupted deploy flows.
2. `worker/agents/services/implementations/DeploymentManager.ts`: stale-loop catch-path state mutations can still happen before next staleness check in detached retry loops.

## Recompute Commands

```bash
# Confirm fork base
git merge-base main upstream/main

# All fork changes (includes formatting churn)
git diff --shortstat 6440eb5..HEAD

# Functional-only delta used above
git diff --shortstat 7128322..HEAD
git diff --numstat 7128322..HEAD
git log --reverse --no-merges --oneline 7128322..HEAD
```

