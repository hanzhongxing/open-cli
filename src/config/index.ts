import { defaultConfig, AppConfig } from './default.js';
import devConfig from './dev.js';
import testConfig from './offline.js';
import prodConfig from './online.js';

// 1. 环境配置映射表
const configMap: Record<string, Partial<AppConfig>> = {
  dev: devConfig,
  development: devConfig,

  offline: testConfig,
  test: testConfig,

  online: prodConfig,
  production: prodConfig,
};

// 2. 深度合并函数（已修复 TS2862 类型报错）
function deepMerge<T extends Record<string, any>>(target: T, source: Record<string, any>): T {
  // 使用 Record<string, any> 接收解构对象，允许索引写入
  const output: Record<string, any> = { ...target };

  if (!source || typeof source !== 'object') {
    return output as T;
  }

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceVal = source[key];
      const targetVal = target[key];

      if (
        typeof sourceVal === 'object' &&
        sourceVal !== null &&
        !Array.isArray(sourceVal) &&
        typeof targetVal === 'object' &&
        targetVal !== null &&
        !Array.isArray(targetVal)
      ) {
        output[key] = deepMerge(targetVal, sourceVal);
      } else if (sourceVal !== undefined) {
        output[key] = sourceVal;
      }
    }
  }

  return output as T;
}

// 3. 执行分层合并
function loadConfig(): AppConfig {
  const env = (process.env.NODE_ENV || 'online').toLowerCase();
  const targetEnvConfig = configMap[env];

  if (!targetEnvConfig) {
    console.warn(`[Config Warn] 未找到环境 "${env}" 对应的配置，将仅使用 default 配置。`);
    return defaultConfig;
  }

  return deepMerge(defaultConfig, targetEnvConfig);
}

export const config = loadConfig();
export * from './default.js';