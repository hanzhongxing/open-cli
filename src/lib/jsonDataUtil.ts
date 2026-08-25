// src/lib/jsonDataUtil.ts

import { logger } from './logger.js';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const DATA_DIR = path.join(process.cwd(), 'data');

async function readModelConfig(fileName: string): Promise<[]> {
  try {
    const content = await fs.readFile(path.join(DATA_DIR, fileName), 'utf-8');
    if(!content){
      return [];
    }
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    logger.error(`读取数据失败: ${error.message}`);
    return [];
  }
}

export async function readJsonData(fileName: string): Promise<[]> {
  return readModelConfig(fileName);
}

export async function writeJsonData(fileName: string, data: any): Promise<void> {
  const dataPath = path.join(DATA_DIR, fileName);
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error: any) {
    logger.error(`保存数据失败: ${error.message}`);
  }
}

