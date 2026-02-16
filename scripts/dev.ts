import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import process from 'node:process';

function resolveWranglerDockerHost(): string | null {
	if (process.platform === 'win32') {
		return '//./pipe/docker_engine';
	}

	const candidateSockets = [`${homedir()}/.docker/run/docker.sock`, '/var/run/docker.sock'];

	for (const socketPath of candidateSockets) {
		if (existsSync(socketPath)) {
			return `unix://${socketPath}`;
		}
	}

	return null;
}

const env = {
	...process.env,
	DEV_MODE: 'true',
};

if (!env.WRANGLER_DOCKER_HOST) {
	const resolvedDockerHost = resolveWranglerDockerHost();
	if (resolvedDockerHost) {
		env.WRANGLER_DOCKER_HOST = resolvedDockerHost;
		console.log(`[dev] Using WRANGLER_DOCKER_HOST=${resolvedDockerHost}`);
	} else {
		console.warn(
			'[dev] Could not auto-detect a Docker socket. Continuing without WRANGLER_DOCKER_HOST. If sandbox containers fail, set WRANGLER_DOCKER_HOST manually.',
		);
	}
}

const viteExecutable = process.platform === 'win32' ? 'vite.cmd' : 'vite';
const viteProcess = spawn(viteExecutable, [], {
	env,
	stdio: 'inherit',
});

viteProcess.on('error', (error) => {
	console.error('[dev] Failed to start vite:', error);
	process.exit(1);
});

viteProcess.on('close', (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}
	process.exit(code ?? 0);
});
