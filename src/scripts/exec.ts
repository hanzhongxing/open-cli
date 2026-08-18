// src/scripts/exec.ts
import type { ScriptCommand } from '../types/command.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../lib/logger.js';
import pc from 'picocolors';

const execAsync = promisify(exec);

const command: ScriptCommand = {
  name:'exec',
  description: '执行系统 Shell 命令',
  usage: 'exec <command>',
  aliases: ['run', '$'],
  async run(args) {
    if (!args.length) {
      console.log(pc.red('用法: ' + this.usage));
      return;
    }
    try {
      const { stdout, stderr } = await execAsync(args.join(' '));
      if (stdout) logger.info(stdout.trimEnd());
      if (stderr) logger.error(pc.red(stderr.trimEnd()));
    } catch (err: any) {
      logger.error(pc.red(`执行失败: ${err.message}`));
    }
  },
};

export default command;