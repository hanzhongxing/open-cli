// src/scripts/exec.ts
import type { ScriptCommand } from '../types/command.js';
import { spawn } from 'child_process';
import { logger } from '../lib/logger.js';
import pc from 'picocolors';

const command: ScriptCommand = {
  name: 'exec',
  description: '执行系统 Shell 命令',
  usage: 'exec <command>',
  aliases: ['run', '$'],
  async run(args) {
    if (!args.length) {
      logger.warn(pc.red('用法: ' + this.usage));
      return;
    }

    const fullCommand = args.join(' ');

    return new Promise<void>((resolve) => {
      // 使用 spawn 并开启 stdio: 'inherit'，实现交互与流式输出
      const child = spawn(fullCommand, {
        shell: true,
        stdio: 'inherit',
      });

      child.on('error', (err) => {
        logger.error(pc.red(`执行失败: ${err.message}`));
        resolve();
      });

      child.on('close', (code) => {
        if (code !== 0 && code !== null) {
          logger.warn(pc.yellow(`进程退出，退出码: ${code}`));
        }
        resolve();
      });
    });
  },
};

export default command;