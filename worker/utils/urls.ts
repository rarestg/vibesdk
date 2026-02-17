export const getProtocolForHost = (host: string): string => {
  if (
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1') ||
    host.startsWith('0.0.0.0') ||
    host.startsWith('::1')
  ) {
    return 'http';
  } else {
    return 'https';
  }
};
export function getPreviewDomain(env: Env): string {
  if (env.CUSTOM_PREVIEW_DOMAIN && env.CUSTOM_PREVIEW_DOMAIN.trim() !== '') {
    return env.CUSTOM_PREVIEW_DOMAIN;
  }
  return env.CUSTOM_DOMAIN;
}

export function buildUserWorkerUrl(env: Env, deploymentId: string): string {
  const domain = getPreviewDomain(env);
  const protocol = getProtocolForHost(domain);
  return `${protocol}://${deploymentId}.${domain}`;
}

/**
 * Migrate a stored preview URL to the current domain.
 * Extracts subdomain from old URL and rebuilds with current getPreviewDomain().
 * Used to handle domain changes without invalidating existing sandbox instances.
 */
export function migratePreviewUrl(storedUrl: string | undefined, env: Env): string | undefined {
  if (!storedUrl) return undefined;

  try {
    const url = new URL(storedUrl);
    const hostname = url.hostname;
    const currentDomain = getPreviewDomain(env);

    // Tunnel/local preview URLs should not be rewritten to custom domains.
    if (
      hostname.endsWith('.trycloudflare.com') ||
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1'
    ) {
      return storedUrl;
    }

    if (!currentDomain || currentDomain.trim() === '') {
      return storedUrl;
    }

    // Already using current domain
    if (hostname.endsWith(`.${currentDomain}`)) {
      return storedUrl;
    }

    // Extract subdomain by finding the first dot
    const firstDotIndex = hostname.indexOf('.');
    if (firstDotIndex === -1) return storedUrl;

    const subdomain = hostname.slice(0, firstDotIndex);

    // Rebuild with current domain
    return `${url.protocol}//${subdomain}.${currentDomain}${url.pathname}`;
  } catch {
    return storedUrl;
  }
}

export function buildGitCloneUrl(env: Env, appId: string, token?: string, request?: Request): string {
  let domain = env.CUSTOM_DOMAIN;

  if (request) {
    try {
      // In local dev, requests come from localhost:5173 and clone URLs must match that host.
      domain = new URL(request.url).host || domain;
    } catch {
      // Keep env.CUSTOM_DOMAIN fallback if request URL parsing fails.
    }
  }

  let hostForProtocol = domain;
  try {
    // Normalizes hosts like "[::1]:5173" to "::1" for local protocol detection.
    hostForProtocol = (new URL(`http://${domain}`).hostname || domain).replace(/^\[|\]$/g, '');
  } catch {
    hostForProtocol = domain;
  }

  const protocol = getProtocolForHost(hostForProtocol);
  // Git expects username:password format. Use 'oauth2' as username and token as password
  // This is a standard pattern for token-based git authentication
  const auth = token ? `oauth2:${token}@` : '';
  return `${protocol}://${auth}${domain}/apps/${appId}.git`;
}
