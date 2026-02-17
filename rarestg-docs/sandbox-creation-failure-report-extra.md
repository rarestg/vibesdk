<task>
Prompt:
The sandbox container creation fails with "internal error; reference = ..." in local dev even
though:
- Docker Desktop has 11.68 GiB memory (enough for the 8 GiB container request)
- The container image exists and runs fine manually (docker run --rm
cloudflare-dev/userappsandboxservice:54410b38 echo "works" succeeds)
- No sandbox containers have ever been created (none show in docker ps -a)

The Docker socket situation:

- Active context: desktop-linux pointing to unix://<USER_HOME>/.docker/run/docker.sock
- /var/run/docker.sock does NOT exist
- <USER_HOME>/.docker/run/docker.sock exists and works

(`<USER_HOME>` is a placeholder for a developer's home directory.)

The error comes from workerd's native container runtime calling ctx.container.start(). The
hypothesis is that workerd/miniflare is trying to use /var/run/docker.sock (which doesn't
exist) instead of the Docker Desktop socket.

Investigate:

1. Check wrangler.jsonc for any container engine / docker socket configuration
2. Search node_modules/@cloudflare/containers and node_modules/miniflare for how the docker
   socket path is resolved - look for docker.sock, container_engine, getContainerEngine,
   resolveDockerHost, DOCKER_HOST
3. Search node_modules/wrangler for container engine resolution logic
4. Check if there's a way to configure the container engine path in wrangler.jsonc dev config
5. Check if the DOCKER_HOST environment variable would help

I need to understand: how does workerd/wrangler determine which Docker socket to use for local
container development, and is there a config or env var to point it to the correct path?

Report the exact mechanism and what config change would fix this.
</task>

<response>
Response:
Now I have all the information needed. Let me compile the complete analysis.

---

Investigation Results: Docker Socket Resolution for Wrangler Containers

The Problem

When wrangler dev runs with enable_containers: true, it needs to tell workerd (via miniflare)
which Docker socket to use. The socket path resolution has a bug in the
getDockerSocketFromContext function that causes it to fail silently on Docker CLI v24+, falling
back to the hardcoded path /var/run/docker.sock -- which does not exist on your system.

The Full Resolution Chain

The containerEngine value is resolved through this priority chain (found at line 250472 of
<REPO_ROOT>/node_modules/wrangler/wrangler-dist/cli.js):

containerEngine: useContainers
? input.dev?.containerEngine // (1) Programmatic override
?? config.dev.container_engine // (2) wrangler.jsonc dev.container_engine
?? resolveDockerHost(...) // (3) Auto-detection
: void 0

Step 3: resolveDockerHost() (line 34959-34971)

function resolveDockerHost(dockerPath) {
if (process.env.WRANGLER_DOCKER_HOST) { // (3a) env var
return process.env.WRANGLER_DOCKER_HOST;
}
if (process.env.DOCKER_HOST) { // (3b) env var
return process.env.DOCKER_HOST;
}
const contextSocket = getDockerSocketFromContext(dockerPath); // (3c) docker context
if (contextSocket) {
return contextSocket;
}
// (3d) Hardcoded fallback
return process.platform === "win32"
? "//./pipe/docker_engine"
: "unix:///var/run/docker.sock"; // <--- THIS IS THE PROBLEM
}

The Bug in getDockerSocketFromContext() (line 34941-34957)

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

On Docker CLI 24.0.5, docker context ls --format json outputs a single-line JSON array:

[{"Current":false,...},{"Current":true,"DockerEndpoint":"unix://<USER_HOME>/.docker/run/docker.sock",...}]

The code expects NDJSON (one JSON object per line). Because the output is a single line
containing a JSON array:

1. lines = ['[{...},{...}]'] (one element)
2. JSON.parse(lines[0]) = [{...},{...}] (an array, not an object)
3. contexts = [[{...},{...}]] (array containing an array)
4. contexts.find(ctx => ctx.Current === true) -- the element is an array, not an object with
   .Current, so find returns undefined
5. Function returns null

This causes resolveDockerHost to fall through to the hardcoded default
unix:///var/run/docker.sock, which does not exist on your macOS Docker Desktop setup.

How miniflare consumes it (line 52687-52695 of
<REPO_ROOT>/node_modules/miniflare/dist/src/index.js)

function getContainerEngine(engineOrSocketPath) {
if (!engineOrSocketPath) {
engineOrSocketPath = process.platform === "win32"
? "//./pipe/docker_engine"
: "unix:///var/run/docker.sock"; // ANOTHER hardcoded fallback
}
if (typeof engineOrSocketPath === "string") {
return { localDocker: { socketPath: engineOrSocketPath } };
}
return engineOrSocketPath;
}

This value is then serialized via Cap'n Proto into the workerd configuration, telling workerd's
native container runtime which Unix socket to connect to. Since it gets
unix:///var/run/docker.sock, workerd tries to connect there, fails, and returns the generic
"internal error; reference = ..." message.

Three Fixes (Any One Will Work)

Fix 1: Environment Variable (Quickest)

Set DOCKER_HOST or WRANGLER_DOCKER_HOST before running wrangler dev:

export DOCKER_HOST="unix://<USER_HOME>/.docker/run/docker.sock"
wrangler dev

Or the wrangler-specific one:

export WRANGLER_DOCKER_HOST="unix://<USER_HOME>/.docker/run/docker.sock"

Fix 2: wrangler.jsonc Configuration (Persistent)

Add container_engine to the dev section. The config schema (in
<REPO_ROOT>/node_modules/wrangler/config-schema.json, lines 2962-2965
and 2969-3000) shows it accepts either a string or an object:

// In wrangler.jsonc
"dev": {
"enable_containers": true,
"container_engine": "unix://<USER_HOME>/.docker/run/docker.sock"
}

Or the object form:

"dev": {
"enable_containers": true,
"container_engine": {
"localDocker": {
"socketPath": "unix://<USER_HOME>/.docker/run/docker.sock"
}
}
}

Fix 3: Create a Symlink (System-Wide)

sudo ln -s <USER_HOME>/.docker/run/docker.sock /var/run/docker.sock

This is fragile and not recommended.

Recommendation

Fix 2 (adding container_engine to wrangler.jsonc) is the best option because:

- It is persistent and explicit
- It does not depend on environment state
- It is self-documenting in the config file
- Other environment variables (WRANGLER_DOCKER_BIN defaults to "docker" which works)

Additional Notes

- WRANGLER_DOCKER_BIN (line 39253-39258): Controls which Docker CLI binary to use (defaults to
  "docker"). This is separate from the socket path.
- The getDockerSocketFromContext bug is a known Docker CLI version compatibility issue -- older
  Docker versions output NDJSON, newer versions (24+) output a JSON array when --format json is
  used. This is a wrangler bug that should be reported upstream to the cloudflare/workers-sdk
  repository.
  </response>
