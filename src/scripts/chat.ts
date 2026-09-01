// src/scripts/chat.ts

import type { ScriptCommand } from '../types/command.js';
import { logger } from '../lib/logger.js';
import pc from 'picocolors';
import { readJsonData, writeJsonData } from '../lib/jsonDataUtil.js';
import { chatFetch } from '../lib/aiHttp.js';
import { SmoothTypewriter } from '../lib/typewriter.js';

// --- 类型定义 ---
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelConfig {
  url: string;
  apikey: string;
  model: string;
  enable: boolean;
  temperature?: number;
  max_tokens?: number;
}

const MODEL_CONFIG_FILE = 'model.json';
const HISTORY_MESSAGE_FILE = 'messages.json';
const MAX_HISTORY_LENGTH = 100;

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
  if (!modelConfig){
    logger.error(pc.red('❌ 模型配置无效，请先使用 model 命令进行配置'));
    return;
  };

  // 2. 读取并管理历史上下文
  const history = await loadChatHistory();
  const currentMessages: ChatMessage[] = [...history, { role: 'user', content: question }];

    // 初始化平滑打字机 (自然节奏 25ms，高速 8ms)
  const typewriter = new SmoothTypewriter(8, 25);

  // 3. 设置中止控制器（用于 Ctrl+C 优雅取消）
  const abortController = new AbortController();
  const sigintHandler = () => {
    logger.info(pc.yellow('\n\n[操作已取消] 正在中断输出...'));
    abortController.abort();
    typewriter.flush(); // 用户按 Ctrl+C 时立即倒出剩余文字
  };
  process.once('SIGINT', sigintHandler);

  process.stdout.write(pc.cyan('🤖: '));

  let fullResponse = '';

  try {
    const response = await chatFetch(modelConfig.url, modelConfig.model, modelConfig.apikey, currentMessages,abortController.signal, 30000); // 10秒超时
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status} ${response.statusText} - ${errorText}`);
    }

    if (!response.body) {
      logger.error(pc.red('❌ 响应体为空，无法读取流数据。'));
      throw new Error('响应体为空，无法读取流数据。');
    }

    const fetchPromise = processStream(response.body, (token) => {
      typewriter.write(token); // 立即推入平滑队列
    });

    fullResponse = await fetchPromise;

    await typewriter.end();

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
 * 高性能实时流式解析器 (SSE 状态机)
 * 只要网络层有可用 token 数据，立即实时触发输出，残缺包自动缓存至下一轮
 */
async function processStream(
  stream: ReadableStream<Uint8Array>,
  onToken: (text: string) => void
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulatedText = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 1. 解码当前数据块并拼入缓冲区
      buffer += decoder.decode(value, { stream: true });

      // 2. 循环快速扫描缓冲区中所有完整的 SSE 行 (以 \n 结尾)
      let lineEndIndex: number;
      while ((lineEndIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, lineEndIndex).trim();
        // 截断已读取的部分，保留剩余未完成的数据
        buffer = buffer.slice(lineEndIndex + 1);

        // 3. 快速过滤无效行或心跳注释
        if (!line || line.startsWith(':')) continue;

        if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim(); // 剔除 'data:' 前缀

          // 遇到结束标识立即退出
          if (dataStr === '[DONE]') {
            return accumulatedText;
          }

          try {
            const json = JSON.parse(dataStr);
            const deltaContent = json.choices?.[0]?.delta?.content;
            
            // 4. 核心：一旦提取到文字，毫秒级立即回调输出
            if (deltaContent) {
              accumulatedText += deltaContent;
              onToken(deltaContent);
            }
          } catch {
            // 如果 JSON 格式异常则直接忽略该帧，不阻塞主流程
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
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

    const config = configs.find(c => c.enable) || configs[0];
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