// src/lib/typewriter.ts

export class SmoothTypewriter {
  private queue: string[] = [];
  private isRunning = false;
  private resolveDone: (() => void) | null = null;
  private isEnded = false;

  /**
   * @param minDelay 队列空闲时的最小打字间隔 (ms)
   * @param maxDelay 队列完全放空时的最大节奏间隔 (ms)
   */
  constructor(
    private minDelay: number = 8,
    private maxDelay: number = 25
  ) {}

  /**
   * 写入文本（生产者）
   */
  public write(text: string): void {
    if (!text) return;
    // 按单个字符拆分入队（支持 emoji 和特殊字符）
    const chars = Array.from(text);
    this.queue.push(...chars);
    this.startLoop();
  }

  /**
   * 标记流结束，返回 Promise 直到所有字符平滑打印完毕
   */
  public async end(): Promise<void> {
    this.isEnded = true;
    if (!this.isRunning && this.queue.length === 0) {
      return;
    }
    return new Promise((resolve) => {
      this.resolveDone = resolve;
    });
  }

  /**
   * 立即强行排空队列（用于中断时秒出）
   */
  public flush(): void {
    if (this.queue.length > 0) {
      process.stdout.write(this.queue.join(''));
      this.queue = [];
    }
    this.finish();
  }

  private startLoop(): void {
    if (isRunningSafe(this.isRunning)) return;
    this.isRunning = true;
    this.tick();
  }

  private tick = (): void => {
    if (this.queue.length === 0) {
      this.isRunning = false;
      if (this.isEnded) {
        this.finish();
      }
      return;
    }

    // 核心算法：自适应调速
    // 队列堆积越多（比如网络突发给了一大串），delay 越小，甚至一次吐多个字符
    const queueLen = this.queue.length;
    let takeCount = 1;
    let currentDelay = this.maxDelay;

    if (queueLen > 50) {
      takeCount = 4; // 严重堆积，每次吐4字
      currentDelay = this.minDelay;
    } else if (queueLen > 20) {
      takeCount = 2; // 中度堆积，每次吐2字
      currentDelay = this.minDelay;
    } else {
      // 线性平滑插值：队列越短，速度越慢，越有打字机质感
      const ratio = queueLen / 20;
      currentDelay = Math.max(
        this.minDelay,
        Math.floor(this.maxDelay - ratio * (this.maxDelay - this.minDelay))
      );
    }

    const charsToPrint = this.queue.splice(0, takeCount).join('');
    process.stdout.write(charsToPrint);

    setTimeout(this.tick, currentDelay);
  };

  private finish(): void {
    if (this.resolveDone) {
      this.resolveDone();
      this.resolveDone = null;
    }
  }
}

function isRunningSafe(status: boolean): boolean {
  return status;
}