"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.greet = void 0;
const commander_1 = require("commander");
const zod_1 = require("zod");
const logger_js_1 = require("../lib/logger.js");
// 定义参数和选项的 Zod schema（用于校验）
const GreetSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, '名字不能为空'),
    excited: zod_1.z.boolean().default(false),
    repeat: zod_1.z.number().int().min(1).max(10).default(1),
});
exports.greet = new commander_1.Command('greet')
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
            logger_js_1.logger.success(message);
        }
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            logger_js_1.logger.error('参数校验失败:');
            console.error(error.message); // 简单输出错误摘要
        }
        else {
            logger_js_1.logger.error('未知错误');
        }
        process.exit(1);
    }
});
//# sourceMappingURL=greet.js.map