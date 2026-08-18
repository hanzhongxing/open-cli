// src/commands/custom.ts
import { Command } from 'commander';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadScriptCommands } from '../lib/loader.js';
import type { ScriptCommand } from '../types/command.js';
import pc from 'picocolors';

export async function customAction(): Promise<void> {
  const commands = await loadScriptCommands();

  console.log(pc.cyan(`\n进入自定义命令环境 (已加载 ${commands.size} 个命令)，输入 help 查看可用命令，输入 exit 退出。\n`));

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
        console.log(pc.yellow('返回主菜单...'));
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
          console.error(pc.red(`命令执行出错: ${err.message}`));
        }
      } else {
        console.log(pc.red(`未知命令: "${commandName}"，输入 help 查看帮助。`));
      }
    }
  } finally {
    // 确保释放终端控制权
    rl.close();
  }
}

// 帮助信息打印函数保持不变...
function printHelp(commands: Map<string, ScriptCommand>) {
  console.log(pc.bold('\n可用命令列表:'));
  const uniqueCmds = Array.from(new Set(commands.values()));
  const maxLen = uniqueCmds.reduce((max, c) => Math.max(max, (c.usage || c.name || '').length), 10);

  for (const cmd of uniqueCmds) {
    const trigger = (cmd.usage || cmd.name || '').padEnd(maxLen + 4);
    const aliasInfo = cmd.aliases?.length ? pc.gray(` [别名: ${cmd.aliases.join(', ')}]`) : '';
    console.log(`  ${pc.cyan(trigger)} ${cmd.description}${aliasInfo}`);
  }
  console.log(`  ${pc.cyan('exit / quit'.padEnd(maxLen + 4))} 返回主菜单\n`);
}

export const custom = new Command('custom')
  .description('进入交互式命令执行环境')
  .action(customAction);