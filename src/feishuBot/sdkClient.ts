import * as lark from '@larksuiteoapi/node-sdk';
import { createFeishuMessageDispatcher } from './dispatcher.js';
import type { FeishuBotDispatchResult, FeishuBotIncomingTextMessage } from './types.js';

interface SdkMessageData {
  message?: {
    message_id?: unknown;
    chat_id?: unknown;
    message_type?: unknown;
    content?: unknown;
  };
  sender?: {
    sender_id?: { open_id?: unknown };
  };
}

interface FeishuSdkReplyRequest {
  path: { message_id: string };
  data: { content: string; msg_type: 'text' };
}

interface FeishuSdkClient {
  im: { v1: { message: { reply(request: FeishuSdkReplyRequest): Promise<unknown> | unknown } } };
}

interface FeishuSdkEventDispatcher {
  register(handlers: Record<string, (data: unknown) => Promise<void>>): FeishuSdkEventDispatcher;
}

interface FeishuSdkWsClient {
  start(config: { eventDispatcher: FeishuSdkEventDispatcher }): Promise<void> | void;
}

interface FeishuSdkModule {
  Client: new (params: { appId: string; appSecret: string }) => FeishuSdkClient;
  WSClient: new (params: { appId: string; appSecret: string }) => FeishuSdkWsClient;
  EventDispatcher: new (params: Record<string, never>) => FeishuSdkEventDispatcher;
}

export interface FeishuSdkBotConfig {
  appId: string;
  appSecret: string;
  outputDir?: string;
  dispatchMessage?: (message: FeishuBotIncomingTextMessage) => Promise<FeishuBotDispatchResult>;
  sdk?: FeishuSdkModule;
}

export interface FeishuSdkBot {
  start(): Promise<void> | void;
}

function isSdkMessageData(data: unknown): data is SdkMessageData {
  return typeof data === 'object' && data !== null;
}

export function extractSdkTextMessage(data: unknown): FeishuBotIncomingTextMessage | null {
  if (!isSdkMessageData(data)) return null;

  const message = data.message;
  if (message?.message_type !== 'text') return null;
  if (typeof message.message_id !== 'string' || typeof message.content !== 'string') return null;

  try {
    const content = JSON.parse(message.content) as { text?: unknown };
    if (typeof content.text !== 'string') return null;

    return {
      messageId: message.message_id,
      text: content.text,
      source: 'sdk',
      chatId: typeof message.chat_id === 'string' ? message.chat_id : undefined,
      senderOpenId: typeof data.sender?.sender_id?.open_id === 'string' ? data.sender.sender_id.open_id : undefined,
    };
  } catch {
    return null;
  }
}

export function createFeishuSdkBot(config: FeishuSdkBotConfig): FeishuSdkBot {
  const sdk = config.sdk ?? (lark as unknown as FeishuSdkModule);
  const client = new sdk.Client({ appId: config.appId, appSecret: config.appSecret });
  const wsClient = new sdk.WSClient({ appId: config.appId, appSecret: config.appSecret });
  const eventDispatcher = new sdk.EventDispatcher({});
  const dispatchMessage = config.dispatchMessage ?? createFeishuMessageDispatcher({ outputDir: config.outputDir }).dispatch;

  eventDispatcher.register({
    'im.message.receive_v1': async (data: unknown) => {
      const message = extractSdkTextMessage(data);
      if (!message) return;

      const response = await dispatchMessage(message);
      if (response.skipped) return;

      await client.im.v1.message.reply({
        path: { message_id: message.messageId },
        data: { content: JSON.stringify({ text: response.text }), msg_type: 'text' },
      });
    },
  });

  return {
    start() {
      return wsClient.start({ eventDispatcher });
    },
  };
}
