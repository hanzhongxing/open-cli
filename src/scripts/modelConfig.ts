// src/scripts/modelConfig.ts

import type { ScriptCommand } from '../types/command.js';
import { logger } from '../lib/logger.js';
import pc from 'picocolors';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const MODEL_CONFIG_PATH = path.join(DATA_DIR, 'model.json');

interface ModelConfig {
  model: string;
  url: string;
  apikey: string;
  alias: string;
}

async function readModelConfig(): Promise<ModelConfig[]> {
  try {
    const content = await fs.readFile(MODEL_CONFIG_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // 文件不存在，返回空数组
      return [];
    }
    logger.error(`读取模型配置失败: ${error.message}`);
    return [];
  }
}

async function writeModelConfig(config: ModelConfig[]) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(MODEL_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    logger.success('模型配置已保存。');
  } catch (error: any) {
    logger.error(`保存模型配置失败: ${error.message}`);
  }
}

async function addModel(args: string[]) {
  if (args.length < 4) {
    logger.warn('用法: model add <model> <url> <apikey> <alias>');
    return;
  }

  const [model, url, apikey, alias] = args;
  const config = await readModelConfig();

  const existingModelIndex = config.findIndex(c => c.alias === alias);
  if (existingModelIndex !== -1) {
    logger.warn(`别名为 "${alias}" 的模型已存在，请使用 "model modify" 命令进行修改。`);
    return;
  }

  config.push({ model, url, apikey, alias });
  await writeModelConfig(config);
  logger.success(`模型 "${alias}" 添加成功。`);
}

async function viewModels() {
  const config = await readModelConfig();

  if (config.length === 0) {
    logger.info('当前没有配置模型。使用 "model add" 命令添加一个。');
    return;
  }

  logger.info(pc.bold('已配置的模型:'));
  config.forEach((model, index) => {
    logger.info(`  ${index + 1}. 别名: ${pc.green(model.alias)}`);
    logger.info(`     模型: ${model.model}`);
    logger.info(`     URL: ${model.url}`);
    logger.info(`     API Key: ${model.apikey ? '********' : '无'}`); // 隐藏 API Key
  });
}

async function modifyModel(args: string[]) {
  if (args.length < 2) {
    logger.warn('用法: model modify <alias> <property> <newValue>');
    logger.info('可用属性: model, url, apikey');
    return;
  }

  const [alias, property, newValue] = args;
  const config = await readModelConfig();
  const modelIndex = config.findIndex(c => c.alias === alias);

  if (modelIndex === -1) {
    logger.error(`未找到别名为 "${alias}" 的模型。`);
    return;
  }

  const modelToModify = config[modelIndex];

  if (property === 'model' || property === 'url' || property === 'apikey') {
    (modelToModify as any)[property] = newValue; // Using 'any' for direct property assignment
    await writeModelConfig(config);
    logger.success(`模型 "${alias}" 的 "${property}" 已更新。`);
  } else {
    logger.error(`无效属性: ${property}。可用属性: model, url, apikey。`);
  }
}

const command: ScriptCommand = {
  name:'model',
  description: '配置模型',
  usage: 'model <command> [args], 可用命令: add, ls/list/view, modify/update, help ; 退出  exit/quit',
  aliases: ['model', 'set model','model set'],
  async run(args) {
    const subcommand = args[0];

    switch (subcommand) {
      case 'add':
        await addModel(args.slice(1));
        break;
      case 'ls':
      case 'list':
      case 'view':
        await viewModels();
        break;
      case 'update':
      case 'modify':
        await modifyModel(args.slice(1));
        break;
      case 'help':
        logger.info(`用法: ${command.usage}`);
        break;
      default:
        logger.info(`用法: ${command.usage}`);
        break;
    }
  },
};

export default command;