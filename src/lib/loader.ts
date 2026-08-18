// src/lib/loader.ts
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ScriptCommand } from '../commands/types/command.js';

// 获取当前文件所在目录
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadScriptCommands(): Promise<Map<string, ScriptCommand>> {
  const commands = new Map<string, ScriptCommand>();

  // 智能寻找 scripts 目录（开发环境找 src/scripts，打包后找 dist/scripts）
  const candidateDirs = [
    path.resolve(__dirname, '../commands/scripts'),
    path.resolve(process.cwd(), 'src/commands/scripts'),
    path.resolve(process.cwd(), 'dist/commands/scripts'),
  ];

  const scriptsDir = candidateDirs.find((dir) => existsSync(dir));

  if (!scriptsDir) {
    console.warn('[Loader] ⚠️ 未找到 scripts 目录，请确保 src/commands/scripts 文件夹存在！');
    return commands;
  }

  try {
    const files = await fs.readdir(scriptsDir);

    for (const file of files) {
      // 仅处理 .ts / .js / .mjs，忽略声明文件和测试文件
      if (
        (!file.endsWith('.ts') && !file.endsWith('.js') && !file.endsWith('.mjs')) ||
        file.endsWith('.d.ts') ||
        file.includes('.test.')
      ) {
        continue;
      }

      const filePath = path.resolve(scriptsDir, file);
      const fileUrl = pathToFileURL(filePath).href;

      try {
        const mod = await import(fileUrl);
        // 兼容不同的导出包装层级
        const cmdConfig: ScriptCommand = mod.default?.default || mod.default || mod.command;

        if (!cmdConfig || typeof cmdConfig.run !== 'function') {
          console.warn(`[Loader] ⚠️ 文件 ${file} 没有导出包含 run 方法的 ScriptCommand 对象。`);
          continue;
        }

        const defaultName = path.basename(file, path.extname(file));
        const commandName = (cmdConfig.name || defaultName).toLowerCase();

        // 注册主命令
        commands.set(commandName, cmdConfig);

        // 注册别名
        if (Array.isArray(cmdConfig.aliases)) {
          for (const alias of cmdConfig.aliases) {
            commands.set(alias.toLowerCase(), cmdConfig);
          }
        }
      } catch (importErr) {
        console.error(`[Loader] ❌ 加载命令脚本 ${file} 失败:`, importErr);
      }
    }
  } catch (error: any) {
    console.error('[Loader] 扫描 scripts 目录出错:', error);
  }

  return commands;
}