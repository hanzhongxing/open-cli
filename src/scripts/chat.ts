// src/scripts/chat.ts

import type { ScriptCommand } from '../types/command.js';
import { logger } from '../lib/logger.js';
import pc from 'picocolors';
import { readJsonData,writeJsonData } from '../lib/jsonDataUtil.js';

const model_config_file = 'model.json';
const history_message_file = 'messages.json';

const command: ScriptCommand = {
  name:'chat',
  description: '对话',
  usage: 'chat <message>',
  aliases: ['chat'],
  async run(args) {
    if (!args.length) {
      logger.warn(pc.red('请输入你的问题，例如: hello'));
      return;
    }
    await chatAction(args);
  }
};

export async function chatAction(args: string[]): Promise<void> {
  if (!args.length) {
    logger.warn(pc.red('请输入你的问题，例如: hello'));
    return;
  }
  logger.info(`你说了: ${args.join(' ')}`);
  const question = args.join(' ');
  logger.info(`正在思考你的问题: ${question}`);
  const modelConfigs: { url: string; apikey: string; model: string }[] = await readJsonData(model_config_file);
  if(modelConfigs.length === 0) {
    logger.warn(pc.red('请先配置模型信息'));
    return;
  } 
  const modelConfig = modelConfigs.at(0);
  if(!modelConfig){
    logger.warn(pc.red('模型配置信息异常'));
    return;
  }
  var messages: { role: string; content: string }[] = await readJsonData(history_message_file);
  if(!messages || !Array.isArray(messages)) {
    messages = [];
  } 
  messages.push({ role: 'user', content: question });
  const response = await fetch(modelConfig.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${modelConfig.apikey}`,
    },
    body: JSON.stringify({
      model: modelConfig.model,
      messages: messages,
    }),
  });

  if (!response.ok) {
    logger.error(pc.red(`请求失败，状态码: ${response.status}`));
    return;
  }

  const data = await response.json();
  const answer = data.choices[0].message.content;
  logger.info(`${answer}`);
  messages.push({ role: 'assistant', content: answer });
  await writeJsonData(history_message_file, messages);
}

export default command;