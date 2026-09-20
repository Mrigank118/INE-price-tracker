import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 10000),
  supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, ''),
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  storeBaseUrl: (process.env.STORE_BASE_URL || 'https://demo.inelabteamdev.com').replace(/\/$/, ''),
  cronSecret: process.env.CRON_SECRET,
  timeoutMs: Number(process.env.SCRAPER_TIMEOUT_MS || 30000),
  maxAttempts: Math.max(1, Number(process.env.SCRAPER_MAX_ATTEMPTS || 3)),
  concurrency: Math.max(1, Number(process.env.SCRAPER_CONCURRENCY || 2))
};

for (const key of ['supabaseUrl', 'supabaseKey', 'cronSecret']) {
  if (!config[key]) console.warn(`Missing environment variable for ${key}`);
}
