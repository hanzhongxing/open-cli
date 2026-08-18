import type { AppConfig } from './default.js';

// 仅需声明要覆盖的字段（利用 Partial<AppConfig>）
const config: Partial<AppConfig> = {
  server: {
    port: Number(process.env.PORT) || 8088,
    host: '0.0.0.0',
  },
  db: {
    host: process.env.DB_HOST || 'prod-db.internal',
    port: 3306,
    user: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD || '',
    database: 'app_production',
  },
  log: {
    level: 'warn',
    dir: '/var/log/app',
  },
};

export default config;