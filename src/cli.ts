#!/usr/bin/env node

import fs from 'node:fs';
import chalk from 'chalk';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config/index.js';
import { Command } from 'commander';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import packageJson from '../package.json' with { type: 'json' };
import { logger } from './lib/logger.js';
import { home } from './commands/home.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Node.js 版本检查
const nodeVersion = process.version.replace('v', '');
const [major] = nodeVersion.split('.').map(Number);
if (major < 20) {
  logger.error(`错误: open-cli 需要 Node.js >= 20，当前版本: ${process.version}`);
  logger.error('请使用 nvm 升级: nvm use 20 或 nvm install 20');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', env: config.env }));
});

logger.info(`当前环境: ${config.env}`);
// fixme 此处可能用不上
// server.listen(config.server.port, config.server.host, () => {
//   // logger.info(`[${config.env.toUpperCase()}] Server running at http://${config.server.host}:${config.server.port}`);
// });

function showBanner() {
  console.clear();
  const bannerPath = path.join(__dirname, 'constant/banner.txt');
  const bannerText = fs.readFileSync(bannerPath, 'utf-8');
  console.log(chalk.cyan(bannerText));
}
if (process.stdout.isTTY) {
    await showBanner();
}
console.log();
const program = new Command();

program
  .name('open-cli')
  .description('TypeScript CLI 工具 open cli')
  .version(packageJson.version)
  .action(async () => {
     await (home as any)._actionHandler([]);
  });
program.parse();