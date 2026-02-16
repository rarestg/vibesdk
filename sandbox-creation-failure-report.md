# Bug Report: Sandbox Container Instance Creation Fails Repeatedly

## Symptom

Every deployment attempt fails with an opaque error:

```
Deployment attempt N failed: Failed to create sandbox instance: Failed to create instance: internal error; reference = <random-id>
```

The system retries indefinitely (observed up to attempt 13+), with 30s delays between retries. The generated code is fine, but the preview never launches. No containers ever appear in Docker Desktop.

## Call Chain

```
DeploymentManager.executeDeploymentWithRetry()
  -> DeploymentManager.deploy()
    -> DeploymentManager.ensureInstance()
      -> DeploymentManager.createNewInstance()           [DeploymentManager.ts:724]
        -> SandboxSdkClient.createInstance()             [sandboxSdkClient.ts:1033-1137]
          -> this.sandbox.exec('mkdir -p /workspace/..') [sandboxSdkClient.ts:1090]
            -> Sandbox DO (from @cloudflare/sandbox)
              -> containerFetch() -> startAndWaitForPorts()
                -> ctx.container.start(startConfig)      [workerd native binary]
                  -> Docker Engine API via socket
                  ** FAILS HERE **
```

The `ctx.container.start()` call is the workerd runtime's native Docker integration. The "internal error; reference = ..." is an opaque error from workerd that does not surface the underlying Docker API error.

## Root Cause: Wrangler Docker Socket Auto-Detection Bug

### The Problem

Wrangler's `resolveDockerHost()` function (line 34959 of `node_modules/wrangler/wrangler-dist/cli.js`) resolves the Docker socket path through this priority chain:

```
1. WRANGLER_DOCKER_HOST env var
2. DOCKER_HOST env var
3. getDockerSocketFromContext()  <-- auto-detection
4. Hardcoded fallback: unix:///var/run/docker.sock
```

The auto-detection in step 3 fails due to a parsing bug, so it falls through to the hardcoded `/var/run/docker.sock` -- which does not exist on macOS Docker Desktop.

### The Parsing Bug in `getDockerSocketFromContext()`

Location: line 34941-34957 of `node_modules/wrangler/wrangler-dist/cli.js`

```javascript
function getDockerSocketFromContext(dockerPath) {
  try {
    const output = runDockerCmdWithOutput(dockerPath, [
      "context", "ls", "--format", "json"
    ]);
    const lines = output.trim().split("\n");
    const contexts = lines.map((line) => JSON.parse(line));
    const currentContext = contexts.find((ctx) => ctx.Current === true);
    if (currentContext && currentContext.DockerEndpoint) {
      return currentContext.DockerEndpoint;
    }
  } catch {}
  return null;
}
```

This code expects `docker context ls --format json` to output **NDJSON** (one JSON object per line). But Docker CLI v24+ outputs a **single-line JSON array** instead:

```json
[{"Current":false,...},{"Current":true,"DockerEndpoint":"unix:///Users/rares/.docker/run/docker.sock",...}]
```

What happens:
1. `lines` = `['[{...},{...}]']` (one element -- the entire array as a string)
2. `JSON.parse(lines[0])` = `[{...},{...}]` (parsed as a JS array)
3. `contexts` = `[[{...},{...}]]` (array containing an array, not array of objects)
4. `contexts.find(ctx => ctx.Current === true)` -- the element is an array, not an object with `.Current`, so `find` returns `undefined`
5. Function returns `null`

### The Fallback Path

After `getDockerSocketFromContext()` returns `null`, `resolveDockerHost()` falls through to:

```javascript
return process.platform === "win32"
  ? "//./pipe/docker_engine"
  : "unix:///var/run/docker.sock";
```

This path is passed via miniflare's `getContainerEngine()` (line 52687 of `node_modules/miniflare/dist/src/index.js`) into workerd's Cap'n Proto config. Workerd's native container runtime then tries to connect to `/var/run/docker.sock`, which does not exist, and returns the generic "internal error; reference = ..." message.

### Environment State

```
$ docker context ls
NAME              TYPE   DESCRIPTION                                DOCKER ENDPOINT
default           moby   Current DOCKER_HOST based configuration    unix:///var/run/docker.sock
desktop-linux *   moby   Docker Desktop                             unix:///Users/rares/.docker/run/docker.sock

$ ls /var/run/docker.sock
ls: /var/run/docker.sock: No such file or directory

$ ls /Users/rares/.docker/run/docker.sock
srwxr-xr-x  1 rares  staff  0 Feb 16 11:56 /Users/rares/.docker/run/docker.sock
```

The active Docker context (`desktop-linux`) points to the correct socket, but wrangler cannot parse it.

### Verification

The container image itself is fine:

```
$ docker run --rm cloudflare-dev/userappsandboxservice:54410b38 echo "works"
WARNING: The requested image's platform (linux/amd64) does not match...
works
```

Docker Desktop memory (11.68 GiB) is sufficient for the 8 GiB container request. The issue is purely that workerd never reaches Docker because it's using the wrong socket path.

## Complication: `@cloudflare/vite-plugin` Overwrites `container_engine`

### Discovery

The initial fix was adding `container_engine` to `wrangler.jsonc`. This did not work -- the error persisted after restarting the dev server.

### Why `wrangler.jsonc` Config Is Ignored

This project runs `vite` (not `wrangler dev`) for local development. The `@cloudflare/vite-plugin` handles container setup and has its **own copy** of the same buggy code.

At lines 15555-15557 of `node_modules/@cloudflare/vite-plugin/dist/index.mjs`:

```javascript
if (worker.config.containers?.length && worker.config.dev.enable_containers) {
    const dockerPath = getDockerPath();
    worker.config.dev.container_engine = resolveDockerHost(dockerPath);
    // ...
}
```

The plugin **unconditionally overwrites** `config.dev.container_engine` with the result of its own `resolveDockerHost()`. Whatever value was set in `wrangler.jsonc` is thrown away before it reaches miniflare/workerd.

The plugin's `resolveDockerHost()` (line 15266) has the same priority chain and the same `getDockerSocketFromContext()` parsing bug as wrangler's copy. It falls through to the same hardcoded `/var/run/docker.sock` default.

### Why the Env Var Works

The plugin's `resolveDockerHost()` checks env vars **before** running the broken auto-detection:

```javascript
function resolveDockerHost(dockerPath) {
    if (process.env.WRANGLER_DOCKER_HOST) return process.env.WRANGLER_DOCKER_HOST;
    if (process.env.DOCKER_HOST) return process.env.DOCKER_HOST;
    const contextSocket = getDockerSocketFromContext(dockerPath);  // <-- broken
    if (contextSocket) return contextSocket;
    return "unix:///var/run/docker.sock";  // <-- wrong fallback
}
```

Setting `DOCKER_HOST` short-circuits the entire resolution chain, bypassing both the parsing bug and the hardcoded fallback.

## Root-Causing Process

1. **Initial hypothesis**: Docker Desktop memory (5.8 GiB) was below the container's 8 GiB request. Bumped to 11.68 GiB. Issue persisted.
2. **Ruled out image issues**: `docker run --rm <image> echo "works"` succeeded. The container starts fine when Docker CLI talks to Docker directly.
3. **Ruled out container creation**: `docker ps -a` showed zero sandbox containers ever created. Workerd never successfully communicated with Docker.
4. **Identified socket mismatch**: `/var/run/docker.sock` does not exist; real socket is at `/Users/rares/.docker/run/docker.sock`.
5. **Traced wrangler resolution**: Found `resolveDockerHost()` -> `getDockerSocketFromContext()` parsing bug with Docker CLI v24+ JSON array output format.
6. **First fix attempt**: Added `container_engine` to `wrangler.jsonc`. Issue persisted.
7. **Traced Vite plugin code path**: Found `@cloudflare/vite-plugin` overwrites `container_engine` unconditionally at line 15557, ignoring the config value.
8. **Second fix attempt**: Added `DOCKER_HOST` env var to the dev script. This broke `docker build` -- it changed the Docker builder context from `desktop-linux` to `default`, whose VM had broken DNS resolution.
9. **Confirmed fix**: Switched to `WRANGLER_DOCKER_HOST` env var, which is only consumed by wrangler/vite-plugin's `resolveDockerHost()` and does not affect `docker build` or other Docker CLI commands.

## Fix Applied

The primary fix was to force wrangler/vite-plugin to use `WRANGLER_DOCKER_HOST` (not `DOCKER_HOST`) so Docker socket resolution bypasses the broken auto-detection path.

Current implementation in `package.json`:

```json
"dev": "tsx scripts/dev.ts",
```

`scripts/dev.ts` now:

- sets `DEV_MODE=true`
- preserves any existing `WRANGLER_DOCKER_HOST`
- auto-detects a local socket path (`~/.docker/run/docker.sock` or `/var/run/docker.sock`) when the env var is unset
- starts Vite with that scoped env var

This keeps the fix while removing machine-specific hardcoded paths from `package.json`. The `wrangler.jsonc` `container_engine` config remains reverted because the Vite plugin ignores it.

### Why `WRANGLER_DOCKER_HOST` and Not `DOCKER_HOST`

`DOCKER_HOST` is too broad. Setting it changes the Docker context used by **all** Docker commands, including `docker build`. When the Vite plugin builds the container image at startup, `DOCKER_HOST` causes it to use the `default` Docker builder context instead of `desktop-linux`. The `default` context's builder VM has broken DNS resolution, causing the build to fail:

```
ERROR: failed to solve: docker.io/cloudflare/sandbox:0.5.6: failed to do request:
  proxyconnect tcp: dial tcp: lookup http.docker.internal: connection refused
```

`WRANGLER_DOCKER_HOST` is only checked by wrangler/vite-plugin's `resolveDockerHost()` function. It does not affect `docker build`, `docker run`, or any other Docker CLI commands. This makes it the correct choice.

### Alternative Fixes

| Fix | Method | Pros | Cons |
|-----|--------|------|------|
| `WRANGLER_DOCKER_HOST` via dev launcher (applied) | `tsx scripts/dev.ts` auto-detects socket and sets `WRANGLER_DOCKER_HOST` | Persistent, scoped to wrangler only, portable across local setups | Requires keeping `scripts/dev.ts` in sync |
| `WRANGLER_DOCKER_HOST` env var (shell) | `export WRANGLER_DOCKER_HOST="unix:///..."` | No file changes | Must be set in every shell session |
| `DOCKER_HOST` env var | `export DOCKER_HOST="unix:///..."` | No file changes | **Breaks `docker build`** -- changes Docker context for all commands |
| `wrangler.jsonc` config | `"container_engine": "unix:///..."` | Self-documenting config | **Does not work** -- Vite plugin overwrites it |
| Symlink | `sudo ln -s ~/.docker/run/docker.sock /var/run/docker.sock` | System-wide, no app changes | Fragile, requires sudo |

## Upstream Bugs

Two bugs should be reported to Cloudflare:

1. **`cloudflare/workers-sdk`** (wrangler): `getDockerSocketFromContext()` cannot parse Docker CLI v24+ JSON array output from `docker context ls --format json`.

2. **`cloudflare/workers-sdk`** (vite-plugin): `@cloudflare/vite-plugin` unconditionally overwrites `config.dev.container_engine` with `resolveDockerHost()` instead of respecting the user's config value. The fix should be:
   ```javascript
   worker.config.dev.container_engine = worker.config.dev.container_engine ?? resolveDockerHost(dockerPath);
   ```

## Files Involved

| File | Lines | Role |
|------|-------|------|
| `package.json` | dev script | Fix location -- added `WRANGLER_DOCKER_HOST` env var |
| `node_modules/@cloudflare/vite-plugin/dist/index.mjs` | 15247-15271, 15557, 15705 | Vite plugin's buggy `getDockerSocketFromContext()` + unconditional overwrite |
| `node_modules/wrangler/wrangler-dist/cli.js` | 34941-34971 | Wrangler's copy of the same bug |
| `node_modules/miniflare/dist/src/index.js` | 52687-52695 | `getContainerEngine()` -- passes socket path to workerd |
| `worker/services/sandbox/sandboxSdkClient.ts` | 1033-1137, 1090 | `createInstance()` -- first container exec that triggers startup |
| `worker/agents/services/implementations/DeploymentManager.ts` | 463, 606, 675, 724, 732 | Retry loop, instance creation, error wrapping |
| `container/SandboxDockerfile` | line 1 | `FROM --platform=linux/amd64` forces x86 emulation |

## Additional Note: Docker Desktop Memory

Docker Desktop memory was initially 5.8 GiB, below the 8 GiB container config in wrangler.jsonc. This was bumped to 11.68 GiB as a precaution. While this was not the root cause of the "internal error" (the socket issue was), insufficient memory would cause a separate failure once the socket issue is resolved. Keeping Docker Desktop at 10+ GiB is recommended.

## Additional Note: Architecture Mismatch

- **Host**: `arm64` (Apple Silicon)
- **SandboxDockerfile**: `FROM --platform=linux/amd64 cloudflare/sandbox:0.5.6`

Docker Desktop runs amd64 images via QEMU emulation, which is slower and may cause startup timeouts. The `@cloudflare/containers` library has internal retry limits (6 retries at ~300ms) within `startContainerIfNotRunning()`. This is a known trade-off documented in PR #1 (Apple Silicon local sandbox platform strategy in `changes-versus-base.md`).
