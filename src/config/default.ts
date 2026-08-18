export const defaultConfig = {
  server: {
    port: 8088,
    host: '0.0.0.0',
  },
  db: {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: process.env.DB_PASSWORD || '', // 敏感数据仍从环境变量取
    database: 'app_dev',
  },
  log: {
    level: 'info',
    dir: './logs',
  },
};

export type AppConfig = typeof defaultConfig;