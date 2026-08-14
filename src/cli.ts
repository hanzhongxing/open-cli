#!/usr/bin/env node

import { Command } from 'commander';
import { greet } from './commands/greet.js';
import { todo } from './commands/todo.js';   // 恢复导入
const packageJson = require('../package.json');

const program = new Command();

program
  .name('open-cli')
  .description('TypeScript CLI 工具 open cli')
  .version(packageJson.version);

program.addCommand(greet);
program.addCommand(todo);  

if (!process.argv.slice(2).length) {
  program.outputHelp();
} else {
  program.parse(process.argv);
}