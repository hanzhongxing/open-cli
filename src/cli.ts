#!/usr/bin/env node

import { Command } from 'commander';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import packageJson from '../package.json' with { type: 'json' };

import { home } from './commands/home.js';

// Node.js 版本检查
const nodeVersion = process.version.replace('v', '');
const [major] = nodeVersion.split('.').map(Number);
if (major < 20) {
  console.error(`错误: open-cli 需要 Node.js >= 20，当前版本: ${process.version}`);
  console.error('请使用 nvm 升级: nvm use 20 或 nvm install 20');
  process.exit(1);
}

const program = new Command();

program
  .name('open-cli')
  .description('TypeScript CLI 工具 open cli')
  .version(packageJson.version)
  .action(async () => {
     await (home as any)._actionHandler([]);
  });
program.parse();