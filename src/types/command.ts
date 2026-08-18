// src/types/command.ts
export interface ScriptCommand {
  /** 命令名称（可选，默认使用文件名，如 hello.ts -> hello） */
  name?: string;
  /** 命令别名（可选，如 ['h']） */
  aliases?: string[];
  /** 命令功能描述，用于 help 列表 */
  description: string;
  /** 使用方法示例，如 'greet <name> [-e]' */
  usage?: string;
  /** 具体执行逻辑 */
  run: (args: string[]) => Promise<void> | void;
}