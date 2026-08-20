// src/scripts/chat.ts

import type { ScriptCommand } from '../types/command.js';
import { logger } from '../lib/logger.js';
import pc from 'picocolors';

const command: ScriptCommand = {
  name:'chat',
  description: '对话',
  usage: 'chat <message>',
  aliases: ['chat'],
  async run(args) {
    if (!args.length) {
      logger.warn(pc.red('请输入你的问题，例如: chat 你好'));
      return;
    }
    logger.info(`你说了: ${args.join(' ')}`);
    const question = args.join(' ');
    logger.info(`正在思考你的问题: ${question}`);
  }
};


export async function chatAction(args: string[]): Promise<void> {
  if (!args.length) {
    logger.warn(pc.red('请输入你的问题，例如: chat 你好'));
    return;
  }
  logger.info(`你说了: ${args.join(' ')}`);
  const question = args.join(' ');
  logger.info(`正在思考你的问题: ${question}`);
}

export default command;