import { Command } from 'commander';
import { intro, text, select, confirm, outro, isCancel } from '@clack/prompts';
import { logger } from '../lib/logger.js';
import pc from 'picocolors';

// 模拟待办数据存储
const todos: string[] = [];

export const todo = new Command('todo')
  .description('管理你的待办事项')
  .action(async () => {
    intro(pc.bgCyan('  Todo Manager '));

    let exit = false;

    while (!exit) {
      // 1. 选择操作
      const action = await select({
        message: '你想做什么？',
        options: [
          { value: 'add', label: '添加待办' },
          { value: 'list', label: '列出所有待办' },
          { value: 'remove', label: '移除待办' },
          { value: 'exit', label: '退出' },
        ],
      });

      // 处理用户取消（Ctrl+C）
      if (isCancel(action)) {
        outro('操作已取消');
        return;
      }

      // 2. 执行对应操作
      if (action === 'add') {
        const newTodo = await text({ message: '请输入待办内容:' });
        if (isCancel(newTodo)) {
          logger.warn('已取消输入');
          continue;
        }
        // 确保 newTodo 是字符串类型（因为已经处理了 isCancel）
        if (newTodo && typeof newTodo === 'string') {
          todos.push(newTodo);
          logger.success(`已添加: "${newTodo}"`);
        }
      } else if (action === 'list') {
        if (todos.length === 0) {
          logger.info('暂无待办事项');
        } else {
          todos.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
        }
      } else if (action === 'remove') {
        if (todos.length === 0) {
          logger.warn('没有待办可以移除');
        } else {
          const index = await select({
            message: '选择要移除的待办:',
            options: todos.map((t, i) => ({ value: i, label: t })),
          });
          if (isCancel(index)) {
            logger.warn('已取消移除');
            continue;
          }
          // 确保 index 是数字类型
          if (typeof index === 'number') {
            const removed = todos.splice(index, 1);
            logger.success(`已移除: "${removed[0]}"`);
          }
        }
      } else if (action === 'exit') {
        exit = true;
      }
    }

    outro('再见！');
  });