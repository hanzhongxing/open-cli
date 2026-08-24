// src/scripts/chat.ts

import type { ScriptCommand } from '../types/command.js';
import { logger } from '../lib/logger.js';
import pc from 'picocolors';
import { readJsonData, writeJsonData } from '../lib/jsonDataUtil.js';

// --- 类型定义 ---
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelConfig {
  url: string;
  apikey: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
}

const MODEL_CONFIG_FILE = 'model.json';
const HISTORY_MESSAGE_FILE = 'messages.json';
const MAX_HISTORY_LENGTH = 20; // 最多保留的历史消息条数（防止 token 溢出）

const command: ScriptCommand = {
  name: 'chat',
  description: '与 AI 进行实时流式对话',
  usage: 'chat <message>',
  aliases: ['c'],
  async run(args) {
    if (!args || args.length === 0) {
      logger.warn(pc.yellow('💡 请输入你的问题，例如: chat 你好，请介绍一下你自己'));
      return;
    }
    await chatAction(args);
  }
};

export async function chatAction(args: string[]): Promise<void> {
  const question = args.join(' ').trim();
  if (!question) {
    logger.warn(pc.yellow('💡 输入内容不能为空'));
    return;
  }

  // 1. 读取并校验模型配置
  const modelConfig = await loadModelConfig();
  if (!modelConfig) return;

  // 2. 读取并管理历史上下文
  const history = await loadChatHistory();
  const currentMessages: ChatMessage[] = [...history, { role: 'user', content: question }];

  // 3. 设置中止控制器（用于 Ctrl+C 优雅取消）
  const abortController = new AbortController();
  const sigintHandler = () => {
    logger.info(pc.yellow('\n\n[操作已取消] 正在中断输出...'));
    abortController.abort();
  };
  process.once('SIGINT', sigintHandler);

  process.stdout.write(pc.cyan('🤖 AI: '));

  let fullResponse = '';

  try {
    const response = await fetch(modelConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modelConfig.apikey}`,
      },
      body: JSON.stringify({
        model: modelConfig.model,
        messages: currentMessages,
        stream: true, // 开启流式响应
        temperature: modelConfig.temperature ?? 0.7,
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status} ${response.statusText} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('响应体为空，无法读取流数据。');
    }

    // 4. 解析流式数据并实现打字机效果
    fullResponse = await processStream(response.body, (chunk) => {
      process.stdout.write(chunk); // 实时输出字符
    });

    process.stdout.write('\n'); // 换行

    // 5. 保存成功对话到历史记录
    currentMessages.push({ role: 'assistant', content: fullResponse });
    await saveChatHistory(currentMessages);

  } catch (error: any) {
    if (error.name === 'AbortError') {
      // 用户主动取消，依然尝试保存已输出的部分回复
      if (fullResponse.trim()) {
        currentMessages.push({ role: 'assistant', content: fullResponse + ' [已中断]' });
        await saveChatHistory(currentMessages);
      }
    } else {
      process.stdout.write('\n');
      logger.error(pc.red(`\n❌ 对话请求异常: ${error.message}`));
    }
  } finally {
    // 移除事件监听，防止内存泄漏
    process.removeListener('SIGINT', sigintHandler);
  }
}

/**
 * 处理流式响应 (SSE: Server-Sent Events)
 */
async function processStream(
  stream: ReadableStream<Uint8Array>,
  onToken: (text: string) => void
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulatedText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // 保留未完成的行

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith(':')) continue; // 跳过空行或注释行

      if (trimmedLine.startsWith('data: ')) {
        const dataStr = trimmedLine.replace(/^data:\s*/, '');
        if (dataStr === '[DONE]') return accumulatedText;

        try {
          const json = JSON.parse(dataStr);
          const deltaContent = json.choices?.[0]?.delta?.content;
          if (deltaContent) {
            accumulatedText += deltaContent;
            onToken(deltaContent);
          }
        } catch {
          // 忽略半包导致的解析失败，等待下一块拼接
        }
      }
    }
  }

  return accumulatedText;
}

/**
 * 加载模型配置
 */
async function loadModelConfig(): Promise<ModelConfig | null> {
  try {
    const configs: ModelConfig[] = await readJsonData(MODEL_CONFIG_FILE);
    if (!Array.isArray(configs) || configs.length === 0) {
      logger.error(pc.red(`❌ 配置文件 ${MODEL_CONFIG_FILE} 为空或格式错误`));
      return null;
    }
    const config = configs[0];
    if (!config.url || !config.apikey || !config.model) {
      logger.error(pc.red(`❌ 缺少核心配置 (url / apikey / model)`));
      return null;
    }
    return config;
  } catch (error: any) {
    logger.error(pc.red(`❌ 读取模型配置文件失败: ${error.message}`));
    return null;
  }
}

/**
 * 加载对话历史并进行长度修剪
 */
async function loadChatHistory(): Promise<ChatMessage[]> {
  try {
    const history: ChatMessage[] = await readJsonData(HISTORY_MESSAGE_FILE);
    if (!Array.isArray(history)) return [];
    
    // 如果超出最大长度，只保留最近的消息（保留偶数条以维持问答对）
    if (history.length > MAX_HISTORY_LENGTH) {
      return history.slice(-MAX_HISTORY_LENGTH);
    }
    return history;
  } catch {
    return [];
  }
}

/**
 * 保存对话历史
 */
async function saveChatHistory(messages: ChatMessage[]): Promise<void> {
  try {
    // 同样在写入时进行数量保护
    const toSave = messages.length > MAX_HISTORY_LENGTH ? messages.slice(-MAX_HISTORY_LENGTH) : messages;
    await writeJsonData(HISTORY_MESSAGE_FILE, toSave);
  } catch (error: any) {
    logger.warn(pc.yellow(`⚠️ 历史记录持久化失败: ${error.message}`));
  }
}

export default command;