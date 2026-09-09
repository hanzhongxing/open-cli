// src/scripts/hello.ts

import type { ScriptCommand } from '../types/command.js';
import { logger } from '../lib/logger.js';
import pc from 'picocolors';

const command: ScriptCommand = {
  name:'help',
  description: '显示帮助信息',
  usage: 'help',
  aliases: ['help','h','-h','--help','-help'],
  async run(args) {
    logger.info('帮助信息:');
    logger.info('help - 显示帮助信息');
  },
};

export default command;