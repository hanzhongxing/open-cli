import { defaultConfig, AppConfig } from './default.js';

// 深度合并工具函数（避免依赖第三方库）
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const output = { ...target };
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
        output[key] = sourceVal as any;
      }
    }
  }
  return output;
}
    
function loadConfig(): AppConfig {
  const env = process.env.NODE_ENV || 'dev';
  let envConfig = {};

  try {
    // 动态加载当前环境对应的配置文件
    // 注意：如果是 ESM 项目，此处使用 require 或 dynamic import
    envConfig = require(`./${env}`).default || require(`./${env}`);
  } catch (err: any) {
    if (env !== 'dev') {
      console.warn(`[Config] No specific config file found for NODE_ENV="${env}", using default.`);
    }
  }

  return deepMerge(defaultConfig, envConfig);
}

export const config = loadConfig();