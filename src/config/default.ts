export const defaultConfig = {
  env: 'online',
  server: {
    port: 8088,
    host: '0.0.0.0',
  }
};

export type AppConfig = typeof defaultConfig;