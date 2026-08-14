import { Command } from 'commander';
import { z } from 'zod';
import { logger } from '../lib/logger.js';

// 定义参数和选项的 Zod schema（用于校验）
const GreetSchema = z.object({
  name: z.string().min(1, '名字不能为空'),
  excited: z.boolean().default(false),
  repeat: z.number().int().min(1).max(10).default(1),
});

export const greet = new Command('greet')
  .description('向某人打招呼')
  .argument('<name>', '要打招呼的人的名字')
  .option('-e, --excited', '是否添加感叹号')
  .option('-r, --repeat <number>', '重复次数', '1')
  .action((name, options) => {
    // 1. 手动解析和校验
    try {
      const validated = GreetSchema.parse({
        name,
        excited: options.excited || false,
        repeat: parseInt(options.repeat, 10) || 1,
      });

      const { name: validatedName, excited, repeat } = validated;

      const message = `Hello, ${validatedName}${excited ? '!' : '.'}`;
      for (let i = 0; i < repeat; i++) {
        logger.success(message);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('参数校验失败:');
        console.error(error.message);   // 简单输出错误摘要
      } else {
        logger.error('未知错误');
      }
      process.exit(1);
    }
  });