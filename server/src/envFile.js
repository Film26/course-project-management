// Which env file the server reads. Each environment has its own database:
//   development → .env (cpms_dev) · test (Vitest) → .env.test (cpms_test) · e2e (Playwright) → .env.e2e (cpms_e2e)
export function envFileFor(nodeEnv) {
  if (nodeEnv === 'test') return '.env.test';
  if (nodeEnv === 'e2e') return '.env.e2e';
  return '.env';
}
