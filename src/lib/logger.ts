import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';
import pc from 'picocolors';

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export interface LoggerOptions {
  /** 日志级别，默认 'info' */
  level?: LogLevel;
  /** CLI 命名空间前缀，如 'open-cli' */
  prefix?: string;
  /** 是否开启文件日志，默认 true */
  fileLog?: boolean;
  /** 日志存储目录，默认 './logs' 或 process.env.LOG_DIR */
  logDir?: string;
  /** 日志文件前缀，例如 'app' -> 'app-2025-05-20.log' */
  filePrefix?: string;
}

// 去除 picocolors / ANSI 颜色控制字符的正则
const ANSI_REGEX = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g;

class Logger {
  private level: LogLevel = 'info';
  private prefix: string = '';
  private fileLog: boolean = true;
  private logDir: string;
  private filePrefix: string;

  constructor(options?: LoggerOptions) {
    this.level = options?.level || (process.env.DEBUG ? 'debug' : 'info');
    this.prefix = options?.prefix || '';
    this.fileLog = options?.fileLog ?? true;
    this.logDir = options?.logDir || process.env.LOG_DIR || path.resolve(process.cwd(), 'logs');
    this.filePrefix = options?.filePrefix || 'open-cli';

    if (this.fileLog) {
      this.ensureLogDir();
    }
  }

  /**
   * 动态设置全局日志级别
   */
  public setLevel(level: LogLevel) {
    this.level = level;
  }

  /**
   * 确保日志输出目录存在
   */
  private ensureLogDir() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err) {
      console.error(pc.red('Failed to create log directory:'), err);
      this.fileLog = false; // 降级关闭文件日志
    }
  }

  /**
   * 获取当前日期字符串 (YYYY-MM-DD)，实现按天动态切割
   */
  private getTodayDateString(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * 获取精确时间戳 (YYYY-MM-DD HH:mm:ss.SSS)
   */
  private getTimestamp(): string {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0];
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${this.getTodayDateString()} ${time}.${ms}`;
  }

  private canLog(targetLevel: LogLevel): boolean {
    return LOG_LEVELS[this.level] >= LOG_LEVELS[targetLevel];
  }

  /**
   * 格式化参数并展开 Error 的堆栈
   */
  private formatArgs(args: any[]): string {
    return args
      .map((arg) => {
        if (arg instanceof Error) {
          return this.level === 'debug' ? arg.stack || arg.message : arg.message;
        }
        if (typeof arg === 'object' && arg !== null) {
          return util.inspect(arg, { colors: false, depth: 4 });
        }
        return String(arg);
      })
      .join(' ');
  }

  /**
   * 核心方法：异步安全写入按天分割的文件
   */
  private writeToFile(level: string, message: string) {
    if (!this.fileLog) return;

    // 清洗掉 ANSI 终端颜色代码
    const cleanMsg = message.replace(ANSI_REGEX, '');
    const logLine = `[${this.getTimestamp()}] [${level.toUpperCase()}] ${this.prefix ? `[${this.prefix}] ` : ''}${cleanMsg}\n`;

    // 动态生成当天文件名：如 ./logs/open-cli-2025-05-20.log
    const fileName = `${this.filePrefix}-${this.getTodayDateString()}.log`;
    const filePath = path.join(this.logDir, fileName);

    // 异步追加写入，避免阻塞 CLI 主进程执行
    fs.appendFile(filePath, logLine, 'utf8', (err) => {
      if (err) {
        // 防止递归调用，直接走标准错误
        process.stderr.write(`[Logger File Error]: ${err.message}\n`);
      }
    });
  }

  private formatConsolePrefix(): string {
    return this.prefix ? pc.dim(`[${this.prefix}] `) : '';
  }

  // ℹ 普通信息
  info(...args: any[]) {
    if (!this.canLog('info')) return;
    const msg = this.formatArgs(args);
    console.log(this.formatConsolePrefix() + pc.cyan('ℹ'), msg);
    this.writeToFile('INFO', msg);
  }

  // ✔ 成功提示
  success(...args: any[]) {
    if (!this.canLog('info')) return;
    const msg = this.formatArgs(args);
    console.log(this.formatConsolePrefix() + pc.green('✔'), msg);
    this.writeToFile('SUCCESS', msg);
  }

  // ⚠ 警告（标准错误流）
  warn(...args: any[]) {
    if (!this.canLog('warn')) return;
    const msg = this.formatArgs(args);
    console.warn(this.formatConsolePrefix() + pc.yellow('⚠'), msg);
    this.writeToFile('WARN', msg);
  }

  // ✖ 错误（标准错误流）
  error(...args: any[]) {
    if (!this.canLog('error')) return;
    const msg = this.formatArgs(args);
    console.error(this.formatConsolePrefix() + pc.red('✖'), msg);
    this.writeToFile('ERROR', msg);
  }

  // ⚙ 调试（仅在 debug 开启时触发）
  debug(...args: any[]) {
    if (!this.canLog('debug')) return;
    const msg = this.formatArgs(args);
    console.debug(this.formatConsolePrefix() + pc.magenta('⚙ [DEBUG]'), msg);
    this.writeToFile('DEBUG', msg);
  }
}

// 导出单例实例
export const logger = new Logger({
  fileLog: true,
  // 也可根据企业需求存放在用户主目录下，如: path.join(os.homedir(), '.open-cli/logs')
  logDir: path.resolve(process.cwd(), 'logs'),
  filePrefix: 'open-cli',
});

// 支持自定义实例
export { Logger };