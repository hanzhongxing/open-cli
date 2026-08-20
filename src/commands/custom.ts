// src/commands/custom.ts
import { Command } from 'commander';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadScriptCommands } from '../lib/loader.js';
import type { ScriptCommand } from '../types/command.js';
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

      if (commandName === 'help') {
        printHelp(commands);
        continue;
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

// 帮助信息打印函数保持不变...
function printHelp(commands: Map<string, ScriptCommand>) {
  logger.info(pc.bold('\n可用命令列表:'));
  const uniqueCmds = Array.from(new Set(commands.values()));
  const maxLen = uniqueCmds.reduce((max, c) => Math.max(max, (c.usage || c.name || '').length), 10);

  for (const cmd of uniqueCmds) {
    const trigger = (cmd.usage || cmd.name || '').padEnd(maxLen + 4);
    const aliasInfo = cmd.aliases?.length ? pc.gray(` [别名: ${cmd.aliases.join(', ')}]`) : '';
    logger.info(`  ${pc.cyan(trigger)} ${cmd.description}${aliasInfo}`);
  }
  logger.info(`  ${pc.cyan('exit / quit'.padEnd(maxLen + 4))} 返回主菜单\n`);
}

export const custom = new Command('custom')
  .description('进入交互式命令执行环境')
  .action(customAction);