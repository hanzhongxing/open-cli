import { Command } from 'commander';
import { intro, text, select, confirm, outro, isCancel } from '@clack/prompts';
import { logger } from '../lib/logger.js';
import pc from 'picocolors';

import { customAction } from './custom.js';

const todos: string[] = [];

export const home = new Command('home')
  .description('cli 工具的主界面')
  .action(async () => {
    intro(pc.bgCyan('  CLI Manager Home '));
    logger.info('欢迎使用 CLI Manager！');
    let exit = false;

    while (!exit) {
      // 1. 选择操作
      const action = await select({
        message: '请选择一个操作:',
        options: [
          { value: 'custom', label: '自定义命令' },
          { value: 'exit', label: '拜拜' },
        ],
      });
 
      if (isCancel(action)) {
        outro('操作已取消');
        return;
      }
      switch (action) {
        case 'custom':
          await customAction();
          break;
        case 'exit':
          exit = true;
          break;
        default:
          logger.error('未知操作');
      
      }
    }
    outro('再见！');
  });