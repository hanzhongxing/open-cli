// src/commands/custom.ts
import { Command } from 'commander';
import { greetAction } from './greet.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function customAction() {
  // raw mode: 直接读取所有原始字节，终端驱动不做任何处理
  // 这样退格键(\x7F)和方向键(\x1B[A等)都能被我们直接捕获和处理
  const wasRawMode = process.stdin.isRaw;
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  console.log('进入自定义命令环境，输入 help 查看可用命令，输入 exit 退出。');

  const prompt = '\x1B[32m> \x1B[0m';
  process.stdout.write(prompt);

  let currentLine = '';
  const onData = (chunk: Buffer) => {
    for (const byte of chunk) {
      if (byte === 0x0D || byte === 0x0A) {
        // 回车
        process.stdout.write('\r\x1B[K');
        const input = currentLine.trim();
        currentLine = '';
        if (input) {
          process.stdin.pause();
          handleCommand(input).finally(() => {
            process.stdout.write(prompt);
            process.stdin.resume();
          });
        } else {
          process.stdout.write(prompt);
        }
      } else if (byte === 0x7F || byte === 0x08) {
        // 退格键（删除）
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          process.stdout.write('\x1B[D \x1B[D');
        }
      } else if (byte === 0x03) {
        // Ctrl+C
        process.stdout.write('\r\x1B[K^C\r\n');
        currentLine = '';
        process.stdout.write(prompt);
      } else if (byte === 0x1B) {
        // ESC 序列开头：方向键等，跳过整个序列
        // 先消费掉接下来的字符（最多3个：[ + 数字/; + 字母）
        let seqLen = 0;
        const restoreListener = () => {
          process.stdin.off('data', skipSeq);
        };
        const skipSeq = (skipChunk: Buffer) => {
          const s = skipChunk.toString('utf8');
          for (let i = 0; i < s.length; i++) {
            seqLen++;
            const ch = s.charCodeAt(i);
            // 方向键序列以字母结尾 A/B/C/D，或数字键以 ~ 结尾，或 m 结尾（颜色码）
            if ((ch >= 65 && ch <= 90) || ch === 126 || ch === 109) {
              restoreListener();
              return;
            }
          }
          // 没匹配到结束符，继续消费（处理超长序列）
        };
        process.stdin.once('data', skipSeq);
      } else if (byte >= 0x20) {
        // 可打印字符
        currentLine += String.fromCodePoint(byte);
        process.stdout.write(String.fromCodePoint(byte));
      }
      // 其他控制字符忽略
    }
  };

  process.stdin.on('data', onData);

  async function handleCommand(input: string) {
    const parts = input.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    console.log();

    try {
      switch (command) {
        case 'help':
          console.log([
            '',
            '  可用命令:',
            '    greet <name> [-e|--excited] [-r|--repeat <n>]  - 打招呼',
            '    exec <command>                                 - 执行系统命令',
            '    exit / quit                                    - 退出交互环境',
            '',
          ].join('\n'));
          break;

        case 'greet': {
          if (!args[0]) {
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
          await greetAction(args[0], { excited, repeat });
          break;
        }

        case 'exec': {
          if (!args.length) {
            console.log('请指定要执行的系统命令，例如: exec ls');
            break;
          }
          try {
            const { stdout, stderr } = await execAsync(args.join(' '));
            if (stdout) console.log(stdout);
            if (stderr) console.error(stderr);
          } catch (err: any) {
            console.error(`执行失败: ${err.message}`);
          }
          break;
        }
        case 'hello':
          console.log('hello '+args.join(' '));
        break;
        case 'exit':
        case 'quit':
          console.log('退出交互环境');
          process.exit(0);

        default:
          console.log(`未知命令: ${command}，输入 help 查看帮助。`);
      }
    } catch (error) {
      console.error('执行命令时出错:', error);
    }
  }

  const cleanup = () => {
    process.stdin.off('data', onData);
    // 恢复原始 raw mode 状态
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(wasRawMode);
    }
  };

  process.once('exit', cleanup);
  process.stdin.on('end', cleanup);
}

export const custom = new Command('custom')
  .description('进入交互式命令执行环境')
  .action(customAction);