// src/scripts/modelConfig.ts

import type { ScriptCommand } from '../types/command.js';
import { logger } from '../lib/logger.js';
import pc from 'picocolors';

const command: ScriptCommand = {
  name:'model',
  description: '配置模型',
  usage: 'model set <name>',
  aliases: ['model', 'set'],
  async run(args) {
    if (!args.length) {
      logger.warn(pc.red('模型名称: qianwen-7b, qianwen-13b, qianwen-14b, qianwen-14b-v2, qianwen-14b-v3, qianwen-14b-v4, qianwen-14b-v5, qianwen-14b-v6, qianwen-14b-v7, qianwen-14b-v8, qianwen-14b-v9'));
      return;
    }
    logger.info(`model set, ${args[0]}!`);
  },
};

export default command;