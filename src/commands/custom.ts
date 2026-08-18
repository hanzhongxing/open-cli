// src/commands/custom.ts
import { Command } from 'commander';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadScriptCommands } from '../lib/loader.js';
import type { ScriptCommand } from '../commands/types/command.js';
import pc from 'picocolors';

export async function customAction(): Promise<void> {
  // 1. 批量加载 scripts 下的所有命令
  const commands = await loadScriptCommands();

  console.log(pc.cyan(`\n进入自定义命令环境 (已加载 ${commands.size} 个命令)，输入 help 查看可用命令，输入 exit 退出。\n`));

  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      const line = await rl.question(pc.green('> '));
      const trimmed = line.trim();
      if (!trimmed) continue;

      const parts = trimmed.split(/\s+/);
      const commandName = parts[0].toLowerCase();
      const args = parts.slice(1);

      // 内置退出命令
      if (commandName === 'exit' || commandName === 'quit') {
        console.log(pc.yellow('返回主菜单...'));
        break;
      }

      // 内置自动生成帮助文档
      if (commandName === 'help') {
        printHelp(commands);
        continue;
      }

      // 2. 匹配并执行命令
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
    rl.close();
  }
}

// 自动格式化对齐打印帮助列表
function printHelp(commands: Map<string, ScriptCommand>) {
  console.log(pc.bold('\n可用命令列表:'));
  
  // 去重（排除别名导致的重复打印）
  const uniqueCmds = Array.from(new Set(commands.values()));
  
  // 计算最长命令名以进行漂亮对齐
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
  .argument('[args...]')
  .action(customAction);