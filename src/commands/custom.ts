// src/commands/custom.ts
import { Command } from 'commander';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadScriptCommands } from '../lib/loader.js';
import { chatAction } from '../scripts/chat.js';
import { logger } from '../lib/logger.js';
import pc from 'picocolors';

export async function customAction(): Promise<void> {
  const commands = await loadScriptCommands();

  logger.info(`进入自定义命令环境 (已加载 ${commands.size} 个命令)，输入 help 查看可用命令，输入 exit 退出。`);

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
      const args = parts.slice(1);

      if (commandName === 'exit' || commandName === 'quit') {
        logger.info(pc.yellow('返回主菜单...'));
        break;
      }

      const cmd = commands.get(commandName);
      if (cmd) {
        try {
          await cmd.run(args);
        } catch (err: any) {
          logger.error(pc.red(`命令执行出错: ${err.message}`));
        }
      } else {
        await chatAction([line]);
      }
    }
  } finally {
    // 确保释放终端控制权
    rl.close();
  }
}

export const custom = new Command('custom')
  .description('进入交互式命令执行环境')
  .action(customAction);