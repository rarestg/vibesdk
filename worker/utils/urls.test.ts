import { describe, expect, it } from 'vitest';
import { buildGitCloneUrl, migratePreviewUrl } from './urls';

function createEnv(overrides: Partial<Env> = {}): Env {
  return {
    CUSTOM_DOMAIN: 'new-preview.example.com',
    CUSTOM_PREVIEW_DOMAIN: '',
    ...overrides,
  } as Env;
}

describe('migratePreviewUrl', () => {
  it('returns undefined when input is undefined', () => {
    const env = createEnv();
    expect(migratePreviewUrl(undefined, env)).toBeUndefined();
  });

  it('keeps trycloudflare tunnel URLs unchanged', () => {
    const env = createEnv();
    const original = 'https://abc123.trycloudflare.com';
    expect(migratePreviewUrl(original, env)).toBe(original);
  });

  it('keeps localhost URLs unchanged', () => {
    const env = createEnv();
    const original = 'http://localhost:3000';
    expect(migratePreviewUrl(original, env)).toBe(original);
  });

  it('migrates custom preview URLs to current domain', () => {
    const env = createEnv();
    const original = 'https://preview-run-1.old-preview.example.net/path';
    expect(migratePreviewUrl(original, env)).toBe('https://preview-run-1.new-preview.example.com/path');
  });
});

describe('buildGitCloneUrl', () => {
  it('uses request host in local development', () => {
    const env = createEnv({
      CUSTOM_DOMAIN: 'vibe-sdk.net',
    });
    const request = new Request('http://localhost:5173/api/apps/app-123/git/token');

    expect(buildGitCloneUrl(env, 'app-123', 'token-abc', request)).toBe(
      'http://oauth2:token-abc@localhost:5173/apps/app-123.git',
    );
  });

  it('falls back to custom domain when request is not provided', () => {
    const env = createEnv({
      CUSTOM_DOMAIN: 'vibe-sdk.net',
    });

    expect(buildGitCloneUrl(env, 'app-123', 'token-abc')).toBe('https://oauth2:token-abc@vibe-sdk.net/apps/app-123.git');
  });

  it('uses http for bracketed localhost IPv6 hosts', () => {
    const env = createEnv({
      CUSTOM_DOMAIN: 'vibe-sdk.net',
    });
    const request = new Request('http://[::1]:5173/api/apps/app-123/git/token');

    expect(buildGitCloneUrl(env, 'app-123', 'token-abc', request)).toBe(
      'http://oauth2:token-abc@[::1]:5173/apps/app-123.git',
    );
  });
});
