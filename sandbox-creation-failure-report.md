# Bug Report: Sandbox Container Instance Creation Fails Repeatedly

## Symptom

Every deployment attempt fails with an opaque error:

```
Deployment attempt N failed: Failed to create sandbox instance: Failed to create instance: internal error; reference = <random-id>
```

The system retries indefinitely (observed up to attempt 13+), with 30s delays between retries. The generated code is fine, but the preview never launches.

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

## Root Cause: Docker Desktop Memory Limit Too Low

The most likely cause is a resource mismatch:

| Resource | Configured | Available |
|----------|-----------|-----------|
| Container `memory_mib` (wrangler.jsonc) | **8192 MiB (8 GB)** | Docker Desktop total: **~5.8 GiB** |
| Container `vcpu` (wrangler.jsonc) | 4 | Docker Desktop CPUs: 4 |
| Container `disk_mb` (wrangler.jsonc) | 10240 | -- |

The wrangler.jsonc container configuration (`durable_objects.classes[].container`) specifies:

```json
{
  "class_name": "UserAppSandboxService",
  "image": "./SandboxDockerfile",
  "max_instances": 1400,
  "instance_type": {
    "vcpu": 4,
    "memory_mib": 8192,
    "disk_mb": 10240
  }
}
```

Docker Desktop (confirmed via `docker info`) is configured with ~5.8 GiB total memory. If workerd passes the `memory_mib: 8192` limit to `docker create --memory=8192m`, Docker refuses because the requested amount exceeds the total available memory.

## Contributing Factor: Architecture Mismatch

- **Host machine**: `arm64` (Apple Silicon)
- **SandboxDockerfile**: `FROM --platform=linux/amd64 cloudflare/sandbox:0.5.6`

Docker Desktop runs this via QEMU emulation, which is significantly slower and may cause startup timeouts even when the memory issue is resolved. The `@cloudflare/containers` library has internal retry limits (6 retries at ~300ms) within `startContainerIfNotRunning()` that can be exceeded under emulation.

## Docker Socket Path

The Docker socket is at `unix:///Users/rares/.docker/run/docker.sock` (Docker Desktop on macOS), not the standard `/var/run/docker.sock`. Wrangler should auto-detect this via `docker context ls`, but if detection fails, workerd cannot communicate with Docker at all.

## Files Involved

| File | Lines | Role |
|------|-------|------|
| `worker/services/sandbox/sandboxSdkClient.ts` | 1033-1137, 1090 | `createInstance()` -- first container exec that triggers startup |
| `worker/agents/services/implementations/DeploymentManager.ts` | 463, 606, 675, 724, 732 | Retry loop, instance creation, error wrapping |
| `wrangler.jsonc` | container config | Instance type: 8192 MiB memory, 4 vCPU |
| `container/SandboxDockerfile` | line 1 | `FROM --platform=linux/amd64` forces x86 emulation |
| `node_modules/@cloudflare/containers/dist/lib/container.js` | 281-385 | `startContainerIfNotRunning()` with internal retries |
| `node_modules/@cloudflare/sandbox/src/sandbox.ts` | 1025-1028 | `exec()` triggers container startup |

## Suggested Fixes

### Fix 1: Increase Docker Desktop Memory (Quick Fix)

Docker Desktop -> Settings -> Resources -> Memory -> Set to at least **10 GB**.

### Fix 2: Reduce Container Memory for Local Dev

Override `SANDBOX_INSTANCE_TYPE` in `.dev.vars` or wrangler.jsonc dev section to use a smaller instance type (e.g., `standard-1` at 4 GiB or `lite` at 256 MiB) for local development.

### Fix 3: Verify with Manual Docker Run

To confirm the memory hypothesis, run:

```bash
docker run --memory=8192m cloudflare-dev/userappsandboxservice:8c583840
```

If this fails with a resource error, it confirms the diagnosis.

### Fix 4 (Optional): Remove `--platform=linux/amd64` for Local Dev

Building the Dockerfile for the native `arm64` platform would eliminate QEMU emulation overhead, significantly improving container startup time. This would require the base image `cloudflare/sandbox:0.5.6` to be available for `arm64`.

### Fix 5 (Optional): Explicit Docker Socket

If auto-detection is unreliable, set the socket explicitly in `wrangler.jsonc`:

```json
"dev": {
  "enable_containers": true,
  "container_engine": "unix:///Users/rares/.docker/run/docker.sock"
}
```

---

## Secondary Issue: Monaco Editor TypeScript Worker Error

### Symptom

```
Uncaught (in promise) Error: Could not find source file: 'inmemory://model/2'.
    at getValidSourceFile (ts.worker.js)
    at Object.getSuggestionDiagnostics (ts.worker.js)
```

### Root Cause

Known Monaco Editor race condition ([microsoft/monaco-editor#1840](https://github.com/microsoft/monaco-editor/issues/1840), [#1842](https://github.com/microsoft/monaco-editor/issues/1842)). During rapid file generation, the `activeFile` changes frequently. The TypeScript web worker asynchronously requests `getSuggestionDiagnostics` for a model URI, but by the time the request is processed, the model has already been replaced with a new one.

### Impact

**Cosmetic only.** No functional impact. TypeScript diagnostics are already disabled during code generation (`readOnly: true` sets `noSemanticValidation: true, noSyntaxValidation: true`), but `getSuggestionDiagnostics` is a separate async API that still fires.

### Files Involved

- `src/components/monaco-editor/monaco-editor.tsx` -- editor component, model lifecycle
- `src/routes/chat/chat.tsx` -- `activeFile` state computed from rapidly changing file states
- `src/routes/chat/utils/handle-websocket-message.ts` -- file streaming handlers (`file_generating`, `file_chunk_generated`, `file_generated`)

### Suggestion

No immediate action needed. If the console noise becomes annoying, debouncing `activeFile` updates during generation or upgrading Monaco (v0.52.2 currently) when Microsoft ships a fix would help.
