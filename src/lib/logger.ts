import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';
import pc from 'picocolors';

// ==================== 类型定义 ====================
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export interface LoggerOptions {
  /** 日志级别，默认 'info'，若环境变量 DEBUG=1 则自动设为 'debug' */
  level?: LogLevel;
  /** CLI 命名空间前缀，如 'my-app' */
  prefix?: string;
  /** 是否启用文件日志，默认 true */
  fileLog?: boolean;
  /** 日志存储目录，默认 './logs' 或环境变量 LOG_DIR */
  logDir?: string;
  /** 日志文件名前缀，如 'app' -> 'app-2025-05-20.log' */
  filePrefix?: string;
  /** 日志最大保留天数，默认 15 天 */
  maxDays?: number;
  /** 缓冲队列达到此阈值立即异步落盘，默认 100 */
  bufferSize?: number;
  /** 缓冲队列硬上限，防高并发 OOM 内存溢出，默认 5000 */
  maxBufferSize?: number;
  /** 定时刷新间隔（毫秒），默认 200ms */
  flushInterval?: number;
  /** 是否始终输出 Error 的完整堆栈，默认 true */
  alwaysShowStack?: boolean;
}

// 过滤 ANSI 颜色控制字符
const ANSI_REGEX = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g;

/** 正则特殊字符转义工具 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ==================== Logger 核心类 ====================
class Logger {
  // ---------- 配置属性 ----------
  private level: LogLevel;
  private prefix: string;
  private fileLog: boolean;
  private logDir: string;
  private filePrefix: string;
  private maxDays: number;
  private bufferSize: number;
  private maxBufferSize: number;
  private flushInterval: number;
  private alwaysShowStack: boolean;

  // ---------- 运行状态 ----------
  private currentStream: fs.WriteStream | null = null;
  private currentDateStr: string = '';
  private currentFilePath: string = '';
  private buffer: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isDegraded: boolean = false; // 是否降级到仅控制台
  private isExiting: boolean = false;  // 防止退出钩子重复执行
  private isWriting: boolean = false;  // 写入锁，避免并发乱序

  constructor(options?: LoggerOptions) {
    this.level = options?.level ?? (process.env.DEBUG ? 'debug' : 'info');
    this.prefix = options?.prefix ?? '';
    this.fileLog = options?.fileLog ?? true;
    this.logDir = options?.logDir ?? process.env.LOG_DIR ?? path.resolve(process.cwd(), 'logs');
    this.filePrefix = options?.filePrefix ?? 'open-cli';
    this.maxDays = options?.maxDays ?? 15;
    this.bufferSize = options?.bufferSize ?? 100;
    this.maxBufferSize = options?.maxBufferSize ?? 5000;
    this.flushInterval = options?.flushInterval ?? 200;
    this.alwaysShowStack = options?.alwaysShowStack ?? true;

    if (this.fileLog) {
      this.initFileLogger();
    }
  }

  // ---------- 公开 API ----------
  public setLevel(level: LogLevel) {
    this.level = level;
  }

  public info(...args: any[]) {
    if (!this.canLog('info')) return;
    const msg = this.formatArgs(args);
    console.log(this.formatConsolePrefix() + pc.cyan('ℹ'), msg);
    this.writeToFile('INFO', msg);
  }

  public success(...args: any[]) {
    if (!this.canLog('info')) return;
    const msg = this.formatArgs(args);
    console.log(this.formatConsolePrefix() + pc.green('✔'), msg);
    this.writeToFile('SUCCESS', msg);
  }

  public warn(...args: any[]) {
    if (!this.canLog('warn')) return;
    const msg = this.formatArgs(args);
    console.warn(this.formatConsolePrefix() + pc.yellow('⚠'), msg);
    this.writeToFile('WARN', msg);
  }

  public error(...args: any[]) {
    if (!this.canLog('error')) return;
    const msg = this.formatArgs(args);
    console.error(this.formatConsolePrefix() + pc.red('✖'), msg);
    this.writeToFile('ERROR', msg);
  }

  public debug(...args: any[]) {
    if (!this.canLog('debug')) return;
    const msg = this.formatArgs(args);
    console.debug(this.formatConsolePrefix() + pc.magenta('⚙ [DEBUG]'), msg);
    this.writeToFile('DEBUG', msg);
  }

  // ---------- 私有核心方法 ----------
  private initFileLogger() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      this.rotateStreamIfNeeded();
      this.startFlushTimer();
      this.registerExitHooks();
      // 启动时异步清理过期日志
      this.cleanOldLogs().catch(() => {});
    } catch (err: any) {
      this.handleStreamError(new Error(`Failed to init logger directory: ${err.message}`));
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
   * 检查日期，若跨天则平滑切换文件流
   */
  private rotateStreamIfNeeded() {
    if (this.isDegraded) return;

    const today = this.getTodayDateString();
    if (this.currentDateStr === today && this.currentStream) {
      return;
    }

    // 跨天：同步刷出旧日志并关闭旧流
    this.flushBufferSync();
    if (this.currentStream) {
      try {
        this.currentStream.end();
      } catch {}
      this.currentStream = null;
    }

    this.currentDateStr = today;
    this.currentFilePath = path.join(this.logDir, `${this.filePrefix}-${today}.log`);

    try {
      this.currentStream = fs.createWriteStream(this.currentFilePath, {
        flags: 'a',
        encoding: 'utf8',
      });
      this.currentStream.on('error', (err) => this.handleStreamError(err));
      
      // 跨天时触发过期日志清理
      this.cleanOldLogs().catch(() => {});
    } catch (err: any) {
      this.handleStreamError(err);
    }
  }

  /**
   * 降级处理：文件写失败时仅控制台输出，防止进程挂掉
   */
  private handleStreamError(err: Error) {
    if (this.isDegraded) return;
    this.isDegraded = true;
    this.fileLog = false;

    process.stderr.write(
      pc.red(`\n[Logger System Error] File logging degraded to console only. Cause: ${err.message}\n`)
    );

    if (this.currentStream) {
      try { this.currentStream.destroy(); } catch {}
      this.currentStream = null;
    }
  }

  // ---------- 缓冲与落盘 ----------
  private writeToFile(level: string, message: string) {
    if (!this.fileLog || this.isDegraded) return;

    const cleanMsg = message.replace(ANSI_REGEX, '');
    const logLine = `[${this.getTimestamp()}] [${level.toUpperCase()}] ${this.prefix ? `[${this.prefix}] ` : ''}${cleanMsg}\n`;

    // 内存硬上限防护：防突发流量导致 OOM
    if (this.buffer.length >= this.maxBufferSize) {
      this.buffer.shift(); // 丢弃最老的一条
    }

    this.buffer.push(logLine);

    if (this.buffer.length >= this.bufferSize) {
      this.flushBufferAsync();
    }
  }

  /**
   * 异步安全刷新缓冲区（带并发锁）
   */
  private flushBufferAsync() {
    if (this.buffer.length === 0 || !this.currentStream || this.isDegraded || this.isWriting) {
      return;
    }

    this.rotateStreamIfNeeded();
    const chunk = this.buffer.join('');
    this.buffer = [];
    this.isWriting = true;

    if (this.currentStream && this.currentStream.writable) {
      this.currentStream.write(chunk, (err) => {
        this.isWriting = false;
        if (err) {
          this.handleStreamError(err);
        }
      });
    } else {
      this.isWriting = false;
    }
  }

  /**
   * 进程退出时的同步阻塞写入
   */
  public flushBufferSync() {
    if (this.buffer.length === 0) return;

    const chunk = this.buffer.join('');
    this.buffer = [];

    if (!this.isDegraded && this.currentFilePath) {
      try {
        fs.appendFileSync(this.currentFilePath, chunk, 'utf8');
      } catch (err: any) {
        process.stderr.write(`[Logger Exit Flush Error]: ${err.message}\n`);
      }
    }
  }

  private startFlushTimer() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => {
      this.flushBufferAsync();
    }, this.flushInterval);
    this.flushTimer.unref(); // 保证定时器不阻塞事件循环退出
  }

  // ---------- 自动清理（修复正则注入与时区偏差） ----------
  private async cleanOldLogs(): Promise<void> {
    if (this.maxDays <= 0) return;

    try {
      const files = await fs.promises.readdir(this.logDir);
      // 安全转义前缀，防止正则注入
      const safePrefix = escapeRegExp(this.filePrefix);
      const pattern = new RegExp(`^${safePrefix}-(\\d{4})-(\\d{2})-(\\d{2})\\.log$`);
      
      const now = new Date();
      // 获取今天 00:00:00 的本地时间毫秒数
      const todayStartMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const maxAgeMs = this.maxDays * 24 * 60 * 60 * 1000;

      for (const file of files) {
        const match = file.match(pattern);
        if (match) {
          const year = parseInt(match[1], 10);
          const month = parseInt(match[2], 10) - 1;
          const day = parseInt(match[3], 10);
          
          // 基于本地年月日构建时间戳（避免 UTC 偏差）
          const fileDateMs = new Date(year, month, day).getTime();

          if (!isNaN(fileDateMs) && (todayStartMs - fileDateMs) >= maxAgeMs) {
            await fs.promises.unlink(path.join(this.logDir, file)).catch(() => {});
          }
        }
      }
    } catch (err: any) {
      if (this.level === 'debug') {
        process.stderr.write(`[Logger Cleanup Warn]: ${err.message}\n`);
      }
    }
  }

  // ---------- 生命周期钩子 ----------
  private registerExitHooks() {
    const handleExit = () => {
      if (this.isExiting) return;
      this.isExiting = true;

      this.flushBufferSync();
      if (this.currentStream) {
        try {
          this.currentStream.end();
        } catch {}
      }
    };

    // 绑定退出事件
    process.once('exit', handleExit);
    process.once('beforeExit', handleExit);
    
    // 监听系统中断信号（刷盘后恢复默认退出码）
    process.once('SIGINT', () => {
      handleExit();
      process.exit(130);
    });
    process.once('SIGTERM', () => {
      handleExit();
      process.exit(143);
    });
  }

  // ---------- 辅助格式化工具 ----------
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
          if (this.alwaysShowStack) {
            return arg.stack || `${arg.name}: ${arg.message}`;
          }
          return arg.message;
        }
        if (typeof arg === 'object' && arg !== null) {
          return util.inspect(arg, { colors: false, depth: 5, breakLength: 80 });
        }
        return String(arg);
      })
      .join(' ');
  }
}

// ==================== 导出默认单例 ====================
export const logger = new Logger({
  filePrefix: 'open-cli',
  maxDays: 15,
  bufferSize: 100,
  maxBufferSize: 5000,
  flushInterval: 200,
  alwaysShowStack: true,
});

export { Logger };