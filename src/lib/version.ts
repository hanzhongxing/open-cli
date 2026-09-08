// src/lib/version.ts
import { createRequire } from 'node:module';

// 使用 Node 原生 createRequire 读取 JSON（避免 ESM import 断言兼容性问题）
const require = createRequire(import.meta.url);
const pkg = require('../../package.json'); // 根据实际目录层级调整相对路径

export const VERSION: string = pkg.version || '0.0.0';
export const CLI_NAME: string = pkg.name || 'open-cli';