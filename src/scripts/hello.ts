// src/scripts/hello.ts

import type { ScriptCommand } from '../types/command.js';
import pc from 'picocolors';

const command: ScriptCommand = {
  name:'hi',
  description: '打招呼',
  usage: 'hello/hi <name>',
  aliases: ['hello', 'hi'],
  async run(args) {
    if (!args.length) {
      console.log(pc.red('请输入名字，例如: socket'));
      return;
    }
    console.log(`Hello, ${args[0]}! 来了老弟~~~`);
  },
};

export default command;