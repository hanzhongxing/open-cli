#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import packageJson from '../package.json' with { type: 'json' };

import { logger } from './lib/logger.js';
import { home } from './commands/home.js';
import { BANNER } from './constant/banner.js';


// 1. Node.js 版本前置检查
const nodeVersion = process.version.replace('v', '');
const [major] = nodeVersion.split('.').map(Number);
if (major < 20) {
  logger.error(`错误: open-cli 需要 Node.js >= 20，当前版本: ${process.version}`);
  logger.error('请使用 nvm 升级: nvm use 20 或 nvm install 20');
  process.exit(1);
}

// 2. Banner 展示函数
function showBanner() {
  if (process.stdout.isTTY) {
    console.clear();
    console.log(chalk.cyan(BANNER));
    console.log();
  }
}

// 3. 配置 Commander
const program = new Command();

program
  .name('open-cli')
  .description('TypeScript CLI 工具 open-cli')
  // 当用户执行 -v / --version 时，Commander 会打印版本后直接安全退出，不会执行下面的 action
  .version(packageJson.version, '-v, --version', '查看当前版本号')
  // 帮助信息
  .helpOption('-h, --help', '显示帮助信息')
  // 用户直接运行 `open-cli` 时触发此 action
  .action(async () => {
    // 仅在进入主交互界面时清屏并打印 Banner
    showBanner();
    
    const handler = (home as any)._actionHandler;
    if (typeof handler === 'function') {
      await handler.call(home, []);
    } else if (typeof (home as any)._actionHandler === 'function') {
      await (home as any)._actionHandler([]);
    }
  });

// 4. 解析命令行参数
program.parse(process.argv);