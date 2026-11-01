// Central place for environment variables. Getters so missing optional values don't crash at import time.
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const env = {
  get DATABASE_URL() {
    return required("DATABASE_URL");
  },
  get APP_URL() {
    return (process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")).replace(/\/$/, "");
  },
  get TELEGRAM_BOT_TOKEN() {
    return required("TELEGRAM_BOT_TOKEN");
  },
  get TELEGRAM_WEBHOOK_SECRET() {
    return required("TELEGRAM_WEBHOOK_SECRET");
  },
  get TELEGRAM_BOT_USERNAME() {
    return process.env.TELEGRAM_BOT_USERNAME ?? "";
  },
  get VOYAGE_API_KEY() {
    return process.env.VOYAGE_API_KEY ?? "";
  },
  get CRON_SECRET() {
    return process.env.CRON_SECRET ?? "";
  },
};
