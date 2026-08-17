// src/commands/custom.ts
import { Command } from 'commander';
import * as readline from 'readline';
import { logger } from '../lib/logger.js';
import { greetAction } from './greet.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 导出核心函数，供 home 菜单调用
export async function customAction() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  // 保存并恢复 stdin 状态，避免与 @clack/prompts 冲突
  const wasRawMode = process.stdin.isTTY ? process.stdin.isRaw : false;
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }

  // 捕获 SIGINT (Ctrl+C)，优雅返回
  const sigintHandler = () => {
    console.log('\n已中断，输入 exit 退出自定义环境。');
    rl.prompt();
  };
  process.on('SIGINT', sigintHandler);

  console.log('进入自定义命令环境，输入 help 查看可用命令，输入 exit 退出。');
  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }
    const parts = input.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    try {
      switch (command) {
        case 'help':
          console.log(`
            可用命令:
              greet <name> [-e|--excited] [-r|--repeat <number>]  - 打招呼
              exec <command>                                       - 执行系统命令（谨慎使用）
              exit / quit                                          - 退出交互环境
            `);
          break;

        case 'greet': {
          let name = args[0];
          if (!name) {
            console.log('用法: greet <name> [-e] [-r <number>]');
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
                repeat = parseInt(args[++i]) || 1;
              }
            }
          }
          await greetAction(name, { excited, repeat });
          break;
        }

        case 'exec': {
          const cmd = args.join(' ');
          if (!cmd) {
            console.log('请指定要执行的系统命令，例如: exec ls');
            break;
          }
          try {
            const { stdout, stderr } = await execAsync(cmd);
            if (stdout) console.log(stdout);
            if (stderr) console.error(stderr);
          } catch (error: any) {
            console.error(`执行失败: ${error.message}`);
          }
          break;
        }
        case 'hello':
          console.log('hello! ' + args[0]);
          break;
        case 'exit':
        case 'quit':
          console.log('退出交互环境');
          rl.close();
          return;

        default:
          console.log(`未知命令: ${command}，输入 help 查看帮助。`);
      }
    } catch (error) {
      console.error('执行命令时出错:', error);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    // 移除信号监听
    process.off('SIGINT', sigintHandler);
    // 恢复 stdin 原始模式，确保 @clack/prompts 能正常工作
    if (process.stdin.isTTY && wasRawMode) {
      process.stdin.setRawMode(true);
    }
    process.exit(0);
  });
}

// 保留原 Commander 命令，以便直接通过命令行调用
export const custom = new Command('custom')
  .description('进入交互式命令执行环境')
  .action(customAction);