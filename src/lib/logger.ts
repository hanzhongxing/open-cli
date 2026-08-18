import pc from 'picocolors';

// 1. 定义日志级别
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
}

class Logger {
  private level: LogLevel = 'info';
  private prefix: string = '';

  constructor(options?: LoggerOptions) {
    if (options?.level) this.level = options.level;
    if (options?.prefix) this.prefix = options.prefix;
  }

  /**
   * 动态设置全局日志级别 (方便 CLI 解析 --verbose 或 --silent 参数后设置)
   */
  public setLevel(level: LogLevel) {
    this.level = level;
  }

  public setPrefix(prefix: string) {
    this.prefix = prefix;
  }

  private canLog(targetLevel: LogLevel): boolean {
    return LOG_LEVELS[this.level] >= LOG_LEVELS[targetLevel];
  }

  private formatPrefix(): string {
    return this.prefix ? pc.dim(`[${this.prefix}] `) : '';
  }

  /**
   * 格式化多参数与 Error 对象
   */
  private formatArgs(args: any[]): any[] {
    return args.map((arg) => {
      if (arg instanceof Error) {
        // debug 模式打印完整堆栈，普通模式只打印友好 message
        return this.level === 'debug' ? arg.stack || arg.message : arg.message;
      }
      return arg;
    });
  }

  // ℹ 普通信息
  info(...args: any[]) {
    if (!this.canLog('info')) return;
    console.log(this.formatPrefix() + pc.cyan('ℹ'), ...this.formatArgs(args));
  }

  // ✔ 成功状态
  success(...args: any[]) {
    if (!this.canLog('info')) return;
    console.log(this.formatPrefix() + pc.green('✔'), ...this.formatArgs(args));
  }

  // ⚠ 警告信息（走 stderr）
  warn(...args: any[]) {
    if (!this.canLog('warn')) return;
    console.warn(this.formatPrefix() + pc.yellow('⚠'), ...this.formatArgs(args));
  }

  // ✖ 错误信息（走 stderr）
  error(...args: any[]) {
    if (!this.canLog('error')) return;
    console.error(this.formatPrefix() + pc.red('✖'), ...this.formatArgs(args));
  }

  // 🔍 调试信息（仅在 debug 开启时输出）
  debug(...args: any[]) {
    if (!this.canLog('debug')) return;
    console.debug(this.formatPrefix() + pc.magenta('⚙ [DEBUG]'), ...this.formatArgs(args));
  }
}

// 导出单例，也可根据需要 new Logger()
export const logger = new Logger({
  prefix: 'open-cli',
  // 支持从环境变量读取 DEBUG 标识
  level: process.env.DEBUG ? 'debug' : 'info',
});