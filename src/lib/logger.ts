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
  /** 日志存储目录，默认 './logs' */
  logDir?: string;
  /** 日志文件名前缀，默认 'open-cli' -> 生成 'open-cli-2025-05-20.log' */
  filePrefix?: string;
  /** 日志最大保留天数，默认 15 天，超过自动清理 */
  maxDays?: number;
  /** 缓冲队列最大条数，达到阈值立即 flush，默认 100 */
  bufferSize?: number;
  /** 缓冲刷新间隔 (毫秒)，默认 200ms */
  flushInterval?: number;
}

// 过滤 ANSI 颜色控制字符
const ANSI_REGEX = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g;

class Logger {
  private level: LogLevel = 'info';
  private prefix: string = '';
  private fileLog: boolean = true;
  private logDir: string;
  private filePrefix: string;
  private maxDays: number;
  private bufferSize: number;
  private flushInterval: number;

  // 内部流与缓冲管理
  private currentStream: fs.WriteStream | null = null;
  private currentDateStr: string = '';
  private currentFilePath: string = '';
  private buffer: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isDegraded: boolean = false; // 是否降级为仅控制台

  constructor(options?: LoggerOptions) {
    this.level = options?.level || (process.env.DEBUG ? 'debug' : 'info');
    this.prefix = options?.prefix || '';
    this.fileLog = options?.fileLog ?? true;
    this.logDir = options?.logDir || process.env.LOG_DIR || path.resolve(process.cwd(), 'logs');
    this.filePrefix = options?.filePrefix || 'open-cli';
    this.maxDays = options?.maxDays ?? 15;
    this.bufferSize = options?.bufferSize ?? 100;
    this.flushInterval = options?.flushInterval ?? 200;

    if (this.fileLog) {
      this.initFileLogger();
    }
  }

  public setLevel(level: LogLevel) {
    this.level = level;
  }

  /**
   * 初始化文件日志系统、退出钩子及清理任务
   */
  private initFileLogger() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      this.rotateStreamIfNeeded();
      this.startFlushTimer();
      this.registerExitHooks();
      // 启动时异步清理一次过期日志
      this.cleanOldLogs().catch(() => {});
    } catch (err: any) {
      this.handleStreamError(new Error(`Failed to initialize log directory: ${err.message}`));
    }
  }

  private getTodayDateString(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private getTimestamp(): string {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0];
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${this.getTodayDateString()} ${time}.${ms}`;
  }

  /**
   * 检查并执行跨天轮转流
   */
  private rotateStreamIfNeeded() {
    if (this.isDegraded) return;

    const today = this.getTodayDateString();
    if (this.currentDateStr === today && this.currentStream) {
      return;
    }

    // 跨天了：先 flush 旧缓冲并关闭旧流
    this.flushBufferSync();
    if (this.currentStream) {
      this.currentStream.end();
      this.currentStream = null;
    }

    this.currentDateStr = today;
    this.currentFilePath = path.join(this.logDir, `${this.filePrefix}-${today}.log`);

    try {
      this.currentStream = fs.createWriteStream(this.currentFilePath, {
        flags: 'a',
        encoding: 'utf8',
      });

      // 监听流异常：实现降级，防止进程因 IO 崩溃
      this.currentStream.on('error', (err) => {
        this.handleStreamError(err);
      });

      // 跨天时触发一次历史日志清理
      this.cleanOldLogs().catch(() => {});
    } catch (err: any) {
      this.handleStreamError(err);
    }
  }

  /**
   * 异常降级处理
   */
  private handleStreamError(err: Error) {
    if (this.isDegraded) return;
    this.isDegraded = true;
    this.fileLog = false;

    // 输出严重警告到标准错误
    process.stderr.write(
      pc.red(`\n[Logger Error] File logging failed, degrading to console only. Cause: ${err.message}\n`)
    );

    if (this.currentStream) {
      try {
        this.currentStream.destroy();
      } catch {}
      this.currentStream = null;
    }
  }

  /**
   * 开启定时刷新缓冲区
   */
  private startFlushTimer() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => {
      this.flushBufferAsync();
    }, this.flushInterval);

    // unref 允许 Node 进程在只有定时器时正常退出
    this.flushTimer.unref();
  }

  /**
   * 异步刷新内存日志缓冲区到流
   */
  private flushBufferAsync() {
    if (this.buffer.length === 0 || !this.currentStream || this.isDegraded) return;

    this.rotateStreamIfNeeded();
    const chunk = this.buffer.join('');
    this.buffer = [];

    if (this.currentStream && this.currentStream.writable) {
      this.currentStream.write(chunk, (err) => {
        if (err) this.handleStreamError(err);
      });
    }
  }

  /**
   * 进程退出时的同步阻塞写入（保证最后一条日志不丢）
   */
  public flushBufferSync() {
    if (this.buffer.length === 0) return;

    const chunk = this.buffer.join('');
    this.buffer = [];

    if (!this.isDegraded && this.currentFilePath) {
      try {
        // 使用同步写入确保退出前强制刷入磁盘
        fs.appendFileSync(this.currentFilePath, chunk, 'utf8');
      } catch (err: any) {
        process.stderr.write(`[Logger Exit Flush Error]: ${err.message}\n`);
      }
    }
  }

  /**
   * 写入内部缓冲
   */
  private writeToFile(level: string, message: string) {
    if (!this.fileLog || this.isDegraded) return;

    const cleanMsg = message.replace(ANSI_REGEX, '');
    const logLine = `[${this.getTimestamp()}] [${level.toUpperCase()}] ${this.prefix ? `[${this.prefix}] ` : ''}${cleanMsg}\n`;

    this.buffer.push(logLine);

    // 达到阈值立即触发刷新
    if (this.buffer.length >= this.bufferSize) {
      this.flushBufferAsync();
    }
  }

  /**
   * 自动清理过期日志文件（> maxDays）
   */
  private async cleanOldLogs(): Promise<void> {
    if (this.maxDays <= 0) return;

    try {
      const files = await fs.promises.readdir(this.logDir);
      const logFilePattern = new RegExp(`^${this.filePrefix}-(\\d{4}-\\d{2}-\\d{2})\\.log$`);
      const nowMs = Date.now();
      const maxAgeMs = this.maxDays * 24 * 60 * 60 * 1000;

      for (const file of files) {
        const match = file.match(logFilePattern);
        if (match) {
          const fileDateStr = match[1];
          const fileTime = new Date(fileDateStr).getTime();

          // 解析日期并对比
          if (!isNaN(fileTime) && nowMs - fileTime > maxAgeMs) {
            const targetPath = path.join(this.logDir, file);
            await fs.promises.unlink(targetPath).catch(() => {});
          }
        }
      }
    } catch (err: any) {
      // 清理日志失败不影响 CLI 运行，记录 debug 即可
      if (this.level === 'debug') {
        process.stderr.write(`[Logger Cleanup Warn]: ${err.message}\n`);
      }
    }
  }

  /**
   * 注册生命周期钩子，防止退出时丢日志
   */
  private registerExitHooks() {
    const onExit = () => {
      this.flushBufferSync();
      if (this.currentStream) {
        try {
          this.currentStream.end();
        } catch {}
      }
    };

    // 进程自然退出与异常捕获
    process.once('exit', onExit);
    process.once('beforeExit', onExit);
    process.once('SIGINT', () => {
      onExit();
      process.exit(130);
    });
    process.once('SIGTERM', () => {
      onExit();
      process.exit(143);
    });
    process.once('uncaughtException', (err) => {
      this.error('Uncaught Exception:', err);
      onExit();
      process.exit(1);
    });
  }

  private canLog(targetLevel: LogLevel): boolean {
    return LOG_LEVELS[this.level] >= LOG_LEVELS[targetLevel];
  }

  private formatConsolePrefix(): string {
    return this.prefix ? pc.dim(`[${this.prefix}] `) : '';
  }

  private formatArgs(args: any[]): string {
    return args
      .map((arg) => {
        if (arg instanceof Error) {
          return this.level === 'debug' ? arg.stack || arg.message : arg.message;
        }
        if (typeof arg === 'object' && arg !== null) {
          return util.inspect(arg, { colors: false, depth: 5 });
        }
        return String(arg);
      })
      .join(' ');
  }

  // --- 公共 API ---

  info(...args: any[]) {
    if (!this.canLog('info')) return;
    const msg = this.formatArgs(args);
    console.log(this.formatConsolePrefix() + pc.cyan('ℹ'), msg);
    this.writeToFile('INFO', msg);
  }

  success(...args: any[]) {
    if (!this.canLog('info')) return;
    const msg = this.formatArgs(args);
    console.log(this.formatConsolePrefix() + pc.green('✔'), msg);
    this.writeToFile('SUCCESS', msg);
  }

  warn(...args: any[]) {
    if (!this.canLog('warn')) return;
    const msg = this.formatArgs(args);
    console.warn(this.formatConsolePrefix() + pc.yellow('⚠'), msg);
    this.writeToFile('WARN', msg);
  }

  error(...args: any[]) {
    if (!this.canLog('error')) return;
    const msg = this.formatArgs(args);
    console.error(this.formatConsolePrefix() + pc.red('✖'), msg);
    this.writeToFile('ERROR', msg);
  }

  debug(...args: any[]) {
    if (!this.canLog('debug')) return;
    const msg = this.formatArgs(args);
    console.debug(this.formatConsolePrefix() + pc.magenta('⚙ [DEBUG]'), msg);
    this.writeToFile('DEBUG', msg);
  }
}

// 导出单例
export const logger = new Logger({
  fileLog: true,
  logDir: path.resolve(process.cwd(), 'logs'),
  filePrefix: 'open-cli',
  maxDays: 15,          // 超过 15 天自动清理
  bufferSize: 100,      // 缓冲 100 条批量写
  flushInterval: 200,   // 200ms 定时落盘
});

export { Logger };