#!/usr/bin/env node

// Node.js 版本检查
const nodeVersion = process.version.replace('v', '');
const [major] = nodeVersion.split('.').map(Number);
if (major < 20) {
  console.error(`错误: open-cli 需要 Node.js >= 20，当前版本: ${process.version}`);
  console.error('请使用 nvm 升级: nvm use 20 或 nvm install 20');
  process.exit(1);
}

import { Command } from 'commander';
import { greet } from './commands/greet.js';
import { todo } from './commands/todo.js';
import { home } from './commands/home.js';
import { custom } from './commands/custom.js';
const packageJson = require('../package.json');

const program = new Command();

program
  .name('open-cli')
  .description('TypeScript CLI 工具 open cli')
  .version(packageJson.version);

program.addCommand(home);
program.addCommand(greet);
program.addCommand(todo);
program.addCommand(custom);


if (!process.argv.slice(2).length) {
  program.parse(['node', 'cli.js', 'home']);
} else {
  program.parse(process.argv);
}