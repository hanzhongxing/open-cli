#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const greet_js_1 = require("./commands/greet.js");
const todo_js_1 = require("./commands/todo.js"); // 恢复导入
const packageJson = require('../package.json');
const program = new commander_1.Command();
program
    .name('my-cli')
    .description('一个现代的 TypeScript CLI 工具')
    .version(packageJson.version);
program.addCommand(greet_js_1.greet);
program.addCommand(todo_js_1.todo);
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
else {
    program.parse(process.argv);
}
//# sourceMappingURL=cli.js.map