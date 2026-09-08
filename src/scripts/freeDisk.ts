// src/scripts/freeDisk.ts
import type { ScriptCommand } from '../types/command.js';
import { spawn } from 'child_process';
import { logger } from '../lib/logger.js';
import pc from 'picocolors';

const viewCacheCMD = 'find ~/Library/Caches -type f -atime +30 -print';
const cleanCacheCMD = 'find ~/Library/Caches -type f -atime +30 -delete';

const command: ScriptCommand = {
  name: 'disk',
  description: '清理磁盘空间',
  usage: 'disk <command> eq command: clean-cache/view/show-cache/view-cache-cmd/help',
  aliases: ['disk', 'fd'],
  async run(args) {
    if (!args.length) {
      logger.warn(pc.red('用法: ' + this.usage));
      return;
    }

    const commandName = args[0];

    switch (commandName) {
      case 'clean-cache':
        await cleanCache();
        break;
      case 'view':
        await viewDiskUsage();
        break;
      case 'show-cache':
        await showCacheCommand();
        break;
      case 'view-cache-cmd':
        await viewCacheCommand();
        break;
      case 'help':
        logger.info(pc.green('用法: disk <command>'));
        logger.info(pc.green('命令: clean-cache - 清理缓存'));
        logger.info(pc.green('命令: view - 查看磁盘使用情况'));
        logger.info(pc.green('命令: show-cache - 显示缓存信息'));
        logger.info(pc.green('命令: view-cache-cmd - 查看缓存命令'));
        logger.info(pc.green('命令: help - 显示帮助信息'));
        break;
      default:
        logger.warn(pc.red(`未知命令: ${commandName}`));
        break;
    }
  },
};

async function cleanCache(): Promise<void> {
  return new Promise<void>((resolve) => {
    // 使用 spawn 并开启 stdio: 'inherit'，实现交互与流式输出
    const child = spawn(cleanCacheCMD, {
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
};

async function showCacheCommand(): Promise<void> {
  return new Promise<void>((resolve) => {
    // 使用 spawn 并开启 stdio: 'inherit'，实现交互与流式输出
    const child = spawn(viewCacheCMD, {
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
};

async function viewCacheCommand(): Promise<void> {
  logger.info(pc.green(`查看缓存命令: ${viewCacheCMD}`));
};

async function viewDiskUsage(): Promise<void> {
  const fullCommand = 'df -h'; // 替换为实际的查看磁盘使用情况命令
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
};

export default command;