import type { AppConfig } from './default.js';

// 仅需声明要覆盖的字段（利用 Partial<AppConfig>）
const config: Partial<AppConfig> = {
  env: 'offline',
};

export default config;