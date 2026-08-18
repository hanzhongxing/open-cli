// src/lib/loader.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ScriptCommand } from '../commands/types/command.js';

export async function loadScriptCommands(): Promise<Map<string, ScriptCommand>> {
  const commands = new Map<string, ScriptCommand>();

  // 使用 __dirname 兼容 CommonJS 编译；如果 __dirname 不存在则回退到 process.cwd()
  const baseDir = typeof __dirname !== 'undefined' 
    ? path.resolve(__dirname, '../scripts') 
    : path.resolve(process.cwd(), 'src/scripts');

  try {
    const files = await fs.readdir(baseDir);

    for (const file of files) {
      if (
        (!file.endsWith('.ts') && !file.endsWith('.js') && !file.endsWith('.mjs')) ||
        file.endsWith('.d.ts') ||
        file.includes('.test.')
      ) {
        continue;
      }

      const filePath = path.join(baseDir, file);
      // 转成 file:// URL 协议，兼容 Windows 路径与动态 import
      const fileUrl = pathToFileURL(filePath).href;
      
      const mod = await import(fileUrl);
      const cmdConfig: ScriptCommand = mod.default || mod.command;

      if (!cmdConfig || typeof cmdConfig.run !== 'function') {
        continue;
      }

      const defaultName = path.basename(file, path.extname(file));
      const commandName = (cmdConfig.name || defaultName).toLowerCase();

      commands.set(commandName, cmdConfig);

      if (cmdConfig.aliases) {
        for (const alias of cmdConfig.aliases) {
          commands.set(alias.toLowerCase(), cmdConfig);
        }
      }
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn(`[Loader] 未找到脚本目录: ${baseDir}`);
    } else {
      console.error('[Loader] 加载脚本命令失败:', error);
    }
  }

  return commands;
}