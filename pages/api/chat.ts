import type { NextRequest } from 'next/server';
import { createParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser';

import { UiMessage } from '../../components/ChatMessage';


if (!process.env.OPENAI_API_KEY)
  console.warn('在此环境部署中未提供 OPENAI_API_KEY. ' +
    '将使用来自客户端的可选密钥, 这是不推荐的做法.');


// 定义 Open AI 通信数据类型

interface ChatMessage {
  role: 'assistant' | 'system' | 'user';
  content: string;
}

interface ChatCompletionsRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_tokens?: number;
  stream: boolean;
  n: number;
}

interface ChatCompletionsResponseChunked {
  id: string; // 分块的唯一标识
  object: 'chat.completion.chunk';
  created: number; // 创建时间戳
  model: string; // AI模型名称, e.g. 'gpt-4-0314'，可能与请求中指定的模型名称不同
  choices: {
    delta: Partial<ChatMessage>;
    index: number; // 始终=0，对于 n=1 时
    finish_reason: 'stop' | 'length' | null;
  }[];
}


async function OpenAIStream(apiKey: string, payload: Omit<ChatCompletionsRequest, 'stream' | 'n'>): Promise<ReadableStream> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const streamingPayload: ChatCompletionsRequest = {
    ...payload,
    stream: true,
    n: 1,
  };

  const fetch = require('node-fetch');
  const res = await fetch('https://api.openai-proxy.com/v1/chat/completions', {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    method: 'POST',
    body: JSON.stringify(streamingPayload),
  }).catch((error: any) => {
    // TODO：官方地址 https://api.openai.com 接口超时，换成代理的是可以的
    console.error('An error occurred:', error);
  });

  return new ReadableStream({
    async start(controller) {

      // 处理错误,
      if (!res.ok) {
        let errorPayload: object = {};
        try {
          errorPayload = await res.json();
        } catch (e) {
          // 忽略
        }
        // 尝试读取错误信息并将其加入到流中，并关闭流
        controller.enqueue(encoder.encode(`OpenAI API error: ${res.status} ${res.statusText} ${JSON.stringify(errorPayload)}`));
        controller.close();
        return;
      }

      // 是否已经发送了第一个数据包
      let sentFirstPacket = false;

      // 来自 OpenAI 的响应是通过 SSE（Server-Sent Events）流传输的，并且可能被分成多个片段（chunks）
      // 为了确保我们正确地读取这些片段并针对每个 SSE 事件流调用事件处理函数，我们使用了解析器来处理这些片段
      const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
        // 忽略重新连接间隔
        if (event.type !== 'event')
          return;

        // https://beta.openai.com/docs/api-reference/completions/create#completions/create-stream
        if (event.data === '[DONE]') {
          controller.close();
          return;
        }

        try {
          const json: ChatCompletionsResponseChunked = JSON.parse(event.data);

          // 忽略角色更新
          if (json.choices[0].delta?.role)
            return;

          // stringify and send the first packet as a JSON object
          if (!sentFirstPacket) {
            sentFirstPacket = true;
            const firstPacket: ChatApiOutputStart = {
              model: json.model,
            };
            controller.enqueue(encoder.encode(JSON.stringify(firstPacket)));
          }

          // transmit the text stream
          const text = json.choices[0].delta?.content || '';
          const queue = encoder.encode(text);
          controller.enqueue(queue);

        } catch (e) {
          // maybe parse error
          controller.error(e);
        }
      });

      // https://web.dev/streams/#asynchronous-iteration
      for await (const chunk of res.body as any)
        parser.feed(decoder.decode(chunk));

    },
  });
}


// Next.js API 路由

export interface ChatApiInput {
  apiKey?: string;
  messages: UiMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

/**
 * 客户端将会接收一串单词流，
 * 作为额外信息 (完全可选) ，我们会发送少量初始化变量的字符串化 JSON 对象. 
 */
export interface ChatApiOutputStart {
  model: string;
}

export default async function handler(req: NextRequest) {

  // 读取输入
  const { apiKey: userApiKey, messages, model = 'gpt-4', temperature = 0.5, max_tokens = 2048 }: ChatApiInput = await req.json();
  const chatGptInputMessages: ChatMessage[] = messages.map(({ role, text }) => ({
    role: role,
    content: text,
  }));

  // 选择密钥策略
  const apiKey = userApiKey || process.env.OPENAI_API_KEY || '';
  if (!apiKey)
    return new Response('Error: missing OpenAI API Key. Add it on the client side (Settings icon) or server side (your deployment).', { status: 400 });

  const stream: ReadableStream = await OpenAIStream(apiKey, {
    model,
    messages: chatGptInputMessages,
    temperature,
    max_tokens,
  });

  return new Response(stream);
};

//noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};