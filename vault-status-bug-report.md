# Bug Report: `/api/vault/status` Returns HTML Instead of JSON

## Symptom

In the browser console on local dev, the following errors appear on page load:

```
SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON
Failed to fetch vault status: ApiError: Unexpected token '<', "<!doctype "... is not valid JSON
```

The `GET /api/vault/status` endpoint returns the Vite SPA `index.html` instead of a JSON response.

## Root Cause

The vault routes are **commented out** in the route registration file. Both the import and the setup call are disabled:

**File:** `worker/api/routes/index.ts`

- **Line 6** -- import commented out:
  ```ts
  // import { setupUserSecretsRoutes } from './userSecretsRoutes';
  ```

- **Lines 58-59** -- setup call commented out:
  ```ts
  // // User secrets vault routes
  // setupUserSecretsRoutes(app);
  ```

## Request Flow (Why HTML Is Returned)

1. Frontend `VaultProvider` (`src/contexts/vault-context.tsx:191`) calls `apiClient.getVaultStatus()` (`src/lib/api-client.ts:801-802`).
2. Request hits the main fetch handler in `worker/index.ts:142`. Since the host is `localhost`, it's treated as a main domain request.
3. The pathname starts with `/api/`, so it's forwarded to the Hono app via `worker/app.ts:93` -> `setupRoutes(app)`.
4. Because `setupUserSecretsRoutes(app)` is commented out, **no route matches** `/api/vault/status`.
5. Hono's `notFound` handler (`worker/app.ts:96-98`) catches the unmatched request and forwards it to `env.ASSETS.fetch()`, which serves `index.html` (the SPA fallback).
6. The frontend JSON parser receives `<!doctype html>...` and throws `SyntaxError`.

## Impact

- **Non-blocking.** The vault (user secrets / BYOK key storage) is not required for core app generation functionality.
- The `VaultProvider` catches the error gracefully -- the app continues to work normally.
- Users cannot store or manage their own API keys through the vault UI.

## Files Involved

| File | Lines | Role |
|------|-------|------|
| `worker/api/routes/index.ts` | 6, 58-59 | Root cause -- import and setup call both commented out |
| `worker/api/routes/userSecretsRoutes.ts` | 25-29, 49 | Route definition -- mounts `vaultRouter` at `/api/vault`, including `GET /status` |
| `worker/api/controllers/user-secrets/controller.ts` | 98-112 | Handler -- `getVaultStatus()` method |
| `worker/app.ts` | 93, 96-98 | Route registration and `notFound` SPA fallback |
| `worker/index.ts` | 170, 199-200 | Main fetch handler routing API requests to Hono |
| `src/lib/api-client.ts` | 801-802 | Frontend API call `getVaultStatus()` |
| `src/contexts/vault-context.tsx` | 191 | Frontend code that triggers the call on mount |

## Suggested Fix

Uncomment two lines in `worker/api/routes/index.ts`:

**Line 6** -- restore the import:
```ts
import { setupUserSecretsRoutes } from './userSecretsRoutes';
```

**Line 59** -- restore the setup call:
```ts
setupUserSecretsRoutes(app);
```

The route definition, controller, and handler all exist and are correctly wired. No other changes are needed -- they just need to be registered.

## Notes

- The legacy D1-based secrets routes (line 55-56) are a separate, older system and should remain commented out.
- The vault system uses a Durable Object per user with XChaCha20-Poly1305 encryption (documented in `CLAUDE.md`). Verify the `USER_SECRETS_STORE` DO binding exists in `wrangler.jsonc` before enabling.
