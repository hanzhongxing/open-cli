// src/commands/custom.ts
import { Command } from 'commander';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { greetAction } from './greet.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import pc from 'picocolors';

const execAsync = promisify(exec);

export async function customAction(): Promise<void> {
  console.log(pc.cyan('\n进入自定义命令环境，输入 help 查看可用命令，输入 exit 返回主菜单。\n'));

  // 创建独立的 readline 交互实例
  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      // 阻塞等待用户输入一行命令
      const line = await rl.question(pc.green('> '));
      const trimmed = line.trim();

      if (!trimmed) continue;

      const parts = trimmed.split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);

      if (command === 'exit' || command === 'quit') {
        console.log(pc.yellow('返回主菜单...'));
        break;
      }

      switch (command) {
        case 'help':
          console.log([
            '',
            '  可用命令:',
            '    greet <name> [-e|--excited] [-r|--repeat <n>]  - 打招呼',
            '    exec <command>                                 - 执行系统命令',
            '    hello <name>                                   - 打印 hello',
            '    exit / quit                                    - 返回主菜单',
            '',
          ].join('\n'));
          break;

        case 'greet': {
          if (!args[0]) {
            console.log(pc.red('用法: greet <name> [-e] [-r <number>]'));
            break;
          }
          let excited = false;
          let repeat = 1;
          for (let i = 1; i < args.length; i++) {
            const arg = args[i];
            if (arg === '-e' || arg === '--excited') {
              excited = true;
            } else if (arg === '-r' || arg === '--repeat') {
              if (i + 1 < args.length) {
                repeat = parseInt(args[++i], 10) || 1;
              }
            }
          }
          await greetAction(args[0], { excited, repeat });
          break;
        }

        case 'exec': {
          if (!args.length) {
            console.log(pc.red('请指定要执行的系统命令，例如: exec ls'));
            break;
          }
          try {
            const { stdout, stderr } = await execAsync(args.join(' '));
            if (stdout) console.log(stdout.trimEnd());
            if (stderr) console.error(pc.red(stderr.trimEnd()));
          } catch (err: any) {
            console.error(pc.red(`执行失败: ${err.message}`));
          }
          break;
        }

        case 'hello':
          console.log('hello ' + args.join(' '));
          break;

        default:
          console.log(pc.red(`未知命令: ${command}，输入 help 查看帮助。`));
      }
    }
  } finally {
    // 退出前务必关闭 readline 实例，归还 stdin 控制权给 @clack/prompts
    rl.close();
  }
}

export const custom = new Command('custom')
  .description('进入交互式命令执行环境')
  .action(customAction);