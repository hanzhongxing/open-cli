// src/commands/custom.ts
import { Command } from 'commander';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { chatAction } from '../scripts/chat.js';
import { logger } from '../lib/logger.js';
import pc from 'picocolors';

export async function userChatAction(): Promise<void> {
  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      let line = '';
      
      try {
        // 等待输入
        line = await rl.question(pc.green('> '));
      } catch (err: any) {
        // ✨ 关键：拦截 Ctrl+C 导致的 AbortError
        if (err.name === 'AbortError' || err.code === 'ABORT_ERR') {
          process.exit(0);
        }
        throw err;
      }

      const trimmed = line.trim();
      if (!trimmed) continue;

      const parts = trimmed.split(/\s+/);
      const commandName = parts[0].toLowerCase();

      if (commandName === 'exit' || commandName === 'quit') {
        logger.info(pc.yellow('返回主菜单...'));
        break;
      }

      await chatAction([line]);

    }
  } finally {
    // 确保释放终端控制权
    rl.close();
  }
}

export const userChat = new Command('userChat')
  .description('进入交互式对话环境')
  .action(userChatAction);