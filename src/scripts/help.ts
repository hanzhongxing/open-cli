// src/scripts/hello.ts

import { loadScriptCommands } from '../lib/loader.js';
import type { ScriptCommand } from '../types/command.js';
import { logger } from '../lib/logger.js';
import pc from 'picocolors';

const command: ScriptCommand = {
  name:'help',
  description: '显示帮助信息',
  usage: 'help/h/-h/--help/-help',
  aliases: ['help','h','-h','--help','-help'],
  async run(args) {
    logger.info('帮助信息:');
    const commands = await loadScriptCommands();
     printHelp(commands);
  },
};

// 帮助信息打印函数保持不变...
function printHelp(commands: Map<string, ScriptCommand>) {
  logger.info(pc.bold('\n可用命令列表:'));
  const uniqueCmds = Array.from(new Set(commands.values()));
  const maxLen = uniqueCmds.reduce((max, c) => Math.max(max, (c.usage || c.name || '').length), 10);

  for (const cmd of uniqueCmds) {
    const trigger = (cmd.usage || cmd.name || '').padEnd(maxLen + 4);
    const aliasInfo = cmd.aliases?.length ? pc.gray(` [别名: ${cmd.aliases.join(', ')}]`) : '';
    logger.info(`${pc.cyan(trigger)} ${cmd.description}${aliasInfo}`);
  }
  logger.info(`${pc.cyan('-v, --version'.padEnd(maxLen + 4))} 查看当前版本号`);
  logger.info(`${pc.cyan('exit / quit'.padEnd(maxLen + 4))} 返回主菜单`);
}

export default command;