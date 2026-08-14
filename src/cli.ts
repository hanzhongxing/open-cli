#!/usr/bin/env node

import { Command } from 'commander';
import { greet } from './commands/greet.js';
import { todo } from './commands/todo.js';
import { home } from './commands/home.js';
const packageJson = require('../package.json');

const program = new Command();

program
  .name('open-cli')
  .description('TypeScript CLI 工具 open cli')
  .version(packageJson.version);

program.addCommand(greet);
program.addCommand(todo);  
program.addCommand(home);

if (!process.argv.slice(2).length) {
  // program.outputHelp();
  program.parse(['node', 'cli.js', 'home']);
} else {
  program.parse(process.argv);
}