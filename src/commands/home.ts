import { Command } from 'commander';
import { select, outro, isCancel } from '@clack/prompts';
import { logger } from '../lib/logger.js';
import * as consts from '../constant/constant.js'; 

import { customAction } from './custom.js';
import { userChatAction } from './userChat.js';

const todos: string[] = [];

export const home = new Command('home')
  .description('cli 工具的主界面')
  .action(async () => {
    logger.info(consts.home_desc);
    let exit = false;

    while (!exit) {
      // 1. 选择操作
      const action = await select({
        message: '---请选择操作---',
        options: [
          { value: 'custom', label: '命令行' },
          { value: 'chat', label: '对话' },
          { value: 'exit', label: '退出' },
        ],
      });
 
      if (isCancel(action)) {
        return;
      }
      switch (action) {
        case 'custom':
          await customAction();
          break;
        case 'exit':
          exit = true;
          break;
        case 'chat':
          await userChatAction();
          break; 
        default:
          logger.error('未知操作');
      }
    }
    outro('再见！');
  });