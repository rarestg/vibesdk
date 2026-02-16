export function isProd(env: Env) {
  return env.ENVIRONMENT === 'prod' || env.ENVIRONMENT === 'production';
}

export function isDev(env: Env) {
  return env.ENVIRONMENT === 'dev' || env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'local';
}

export function isEnabledEnvFlag(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}
