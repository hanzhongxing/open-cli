import { Command } from 'commander';
import { intro, text, select, confirm, outro, isCancel } from '@clack/prompts';
import { logger } from '../lib/logger.js';
import pc from 'picocolors';

import { greetAction } from './greet.js';
import { todoAction } from './todo.js';
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
          { value: 'todo', label: '待办' },
          { value: 'greet', label: '生成' },
          { value: 'exit', label: '拜拜' },
        ],
      });
 
      if (isCancel(action)) {
        outro('操作已取消');
        return;
      }
      console.log();
      if (action === 'custom') {
        await customAction();
      } 
      if (action === 'todo') {
         await todoAction();
      } 
      if (action === 'greet') {
        const name = await text({ message: '请输入名字:' });
        if (isCancel(name)) { logger.warn('已取消'); continue; }
        const excited = await confirm({ message: '是否添加感叹号?' });
        if (isCancel(excited)) { logger.warn('已取消'); continue; }
        const repeat = await text({ message: '重复次数 (默认1):', initialValue: '1' });
        if (isCancel(repeat)) { logger.warn('已取消'); continue; }
        await greetAction(name, { excited: Boolean(excited), repeat: parseInt(repeat) || 1 });
      }
      if (action === 'exit') {
        exit = true;
      }

    }

    outro('再见！');
  });