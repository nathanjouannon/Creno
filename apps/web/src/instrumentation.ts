// Fails fast at server start when the configuration is invalid (environments.md, section 2).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getConfig } = await import('@/modules/shared');
    getConfig();
  }
}
