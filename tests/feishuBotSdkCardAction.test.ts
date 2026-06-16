import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFeishuSdkBot } from '../src/feishuBot/sdkClient.js';

const metric = {
  exposure: 10,
  publicVisits: 2,
  dashboardVisits: 2,
  createdOrders: 0,
  signedOrders: 0,
  reviewedOrders: 0,
  shippedOrders: 0,
  amount: 0,
  exposureVisitRate: 0.2,
  visitCreatedOrderRate: 0,
  visitShipmentRate: 0,
  hasExposureData: true,
  hasDashboardData: true,
};

function fakeSdk(sent: unknown[], registered: Record<string, (data: unknown) => Promise<unknown>>) {
  class FakeClient {
    im = { v1: { message: { reply: async (request: unknown) => sent.push({ kind: 'reply', request }), patch: async (request: unknown) => sent.push({ kind: 'patch', request }) } } };
  }
  class FakeWSClient {
    start() {
      return undefined;
    }
  }
  class FakeEventDispatcher {
    register(handlers: Record<string, (data: unknown) => Promise<unknown>>) {
      Object.assign(registered, handlers);
      return this;
    }
  }
  return { Client: FakeClient, WSClient: FakeWSClient, EventDispatcher: FakeEventDispatcher };
}

async function writeContext(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'mt-agent-card-action-'));
  await mkdir(join(dir, '2026-06-11'), { recursive: true });
  await writeFile(join(dir, '2026-06-11', 'report-context.json'), JSON.stringify({
    date: '2026-06-11',
    summary: { '1d': metric, '7d': metric, '30d': metric },
    conclusions: [],
    rows: [{ productName: 'iPhone 15', platformProductId: '2000000000000000000001', displayProductId: '端内ID 565', custodyDays: 10, periods: { '1d': metric, '7d': metric, '30d': metric } }],
    lowExposure: [],
    weakClick: [],
    weakConversion: [],
    highPotential: [],
    newProductObservation: [],
    lifecycleGovernance: [],
    recommendedActions: [],
    emptySectionNotes: {},
    orderAnalysis: { runDate: '2026-06-11', pages: {} },
    agentData: { removedLinks: [] },
  }));
  return dir;
}

async function writeLearningContext(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'mt-agent-learning-card-action-'));
  await mkdir(join(dir, '2026-06-11'), { recursive: true });
  const rows = [629, 630].map((id) => ({ productName: `商品${id}`, platformProductId: `p${id}`, displayProductId: `端内ID ${id}`, custodyDays: 10, periods: { '1d': metric, '7d': metric, '30d': metric } }));
  await writeFile(join(dir, '2026-06-11', 'report-context.json'), JSON.stringify({
    date: '2026-06-11',
    summary: { '1d': metric, '7d': metric, '30d': metric },
    conclusions: [],
    rows,
    lowExposure: [],
    weakClick: [],
    weakConversion: [],
    highPotential: [],
    newProductObservation: [],
    lifecycleGovernance: [],
    recommendedActions: [
      { identifier: '端内ID 629', action: '检查价格', reason: '建议操作池', priority: 'high' },
      { identifier: '端内ID 630', action: '继续放量', reason: '建议操作池', priority: 'medium' },
    ],
    emptySectionNotes: {},
    orderAnalysis: { runDate: '2026-06-11', pages: {} },
    agentData: { removedLinks: [] },
  }));
  return dir;
}

describe('createFeishuSdkBot card.action.trigger', () => {
  it('handles id_lookup form submit and replies with converted ID text', async () => {
    const outputDir = await writeContext();
    const registered: Record<string, (data: unknown) => Promise<unknown>> = {};
    const sent: unknown[] = [];
    const bot = createFeishuSdkBot({ appId: 'app', appSecret: 'secret', outputDir, sdk: fakeSdk(sent, registered) });

    bot.start();
    await registered['card.action.trigger']({
      event: {
        context: { open_message_id: 'om-id-lookup' },
        action: { tag: 'button', value: { action: 'id_lookup' }, form_value: { lookup_query: '565' } },
      },
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: 'reply', request: { path: { message_id: 'om-id-lookup' }, data: { msg_type: 'interactive' } } });
    expect(JSON.stringify(sent[0])).toContain('查询结果');
    expect(JSON.stringify(sent[0])).toContain('端内ID 565 对应平台商品ID');
  });

  it('handles id_lookup submit when Feishu returns the callback value through behaviors', async () => {
    const outputDir = await writeContext();
    const registered: Record<string, (data: unknown) => Promise<unknown>> = {};
    const sent: unknown[] = [];
    const bot = createFeishuSdkBot({ appId: 'app', appSecret: 'secret', outputDir, sdk: fakeSdk(sent, registered) });

    bot.start();
    await registered['card.action.trigger']({
      event: {
        context: { open_message_id: 'om-id-lookup-behavior' },
        action: { tag: 'button', name: 'id_lookup_submit', behaviors: [{ type: 'callback', value: { action: 'id_lookup' } }], form_value: { lookup_query: '565' } },
      },
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: 'reply', request: { path: { message_id: 'om-id-lookup-behavior' }, data: { msg_type: 'interactive' } } });
    expect(JSON.stringify(sent[0])).toContain('端内ID 565 对应平台商品ID');
  });

  it('handles id_lookup form submit when SDK returns flattened card action data', async () => {
    const outputDir = await writeContext();
    const registered: Record<string, (data: unknown) => Promise<unknown>> = {};
    const sent: unknown[] = [];
    const bot = createFeishuSdkBot({ appId: 'app', appSecret: 'secret', outputDir, sdk: fakeSdk(sent, registered) });

    bot.start();
    await registered['card.action.trigger']({
      context: { open_message_id: 'om-id-lookup-flat' },
      action: { tag: 'button', name: 'id_lookup_submit', behaviors: [{ type: 'callback', value: { action: 'id_lookup' } }], form_value: { lookup_query: '565' } },
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: 'reply', request: { path: { message_id: 'om-id-lookup-flat' }, data: { msg_type: 'interactive' } } });
    expect(JSON.stringify(sent[0])).toContain('端内ID 565 对应平台商品ID');
  });

  it('acknowledges operations learning feedback without persisting it', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'mt-agent-empty-learning-'));
    const registered: Record<string, (data: unknown) => Promise<void>> = {};
    const sent: unknown[] = [];
    const bot = createFeishuSdkBot({ appId: 'app', appSecret: 'secret', outputDir, sdk: fakeSdk(sent, registered) });

    bot.start();
    await registered['card.action.trigger']({
      event: {
        context: { open_message_id: 'om-feedback' },
        action: { tag: 'button', input_value: '建议先看库存', value: { action: 'operations_learning_feedback', productId: '565', feedback: 'suggested_action', questionIndex: 1 } },
      },
    });

    expect(sent).toEqual([
      { kind: 'reply', request: { path: { message_id: 'om-feedback' }, data: { content: JSON.stringify({ text: '已收到运营学习反馈：565 suggested_action。建议：建议先看库存' }), msg_type: 'text' } } },
    ]);
  });

  it('replies with the next operations learning question after feedback', async () => {
    const outputDir = await writeLearningContext();
    const registered: Record<string, (data: unknown) => Promise<void>> = {};
    const sent: unknown[] = [];
    const bot = createFeishuSdkBot({ appId: 'app', appSecret: 'secret', outputDir, sdk: fakeSdk(sent, registered) });

    bot.start();
    await registered['card.action.trigger']({
      event: {
        context: { open_message_id: 'om-feedback-next' },
        action: { tag: 'button', value: { action: 'operations_learning_feedback', productId: '629', feedback: 'reasonable', questionIndex: 1 } },
      },
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: 'reply', request: { path: { message_id: 'om-feedback-next' }, data: { msg_type: 'interactive' } } });
    expect(JSON.stringify(sent[0])).toContain('运营学习 loop 测验 2/2');
    expect(JSON.stringify(sent[0])).toContain('端内ID 630');
  });

  it('acknowledges operations learning feedback when callback value is returned through behaviors', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'mt-agent-empty-learning-'));
    const registered: Record<string, (data: unknown) => Promise<void>> = {};
    const sent: unknown[] = [];
    const bot = createFeishuSdkBot({ appId: 'app', appSecret: 'secret', outputDir, sdk: fakeSdk(sent, registered) });

    bot.start();
    await registered['card.action.trigger']({
      event: {
        context: { open_message_id: 'om-feedback-behavior' },
        action: { tag: 'button', behaviors: [{ type: 'callback', value: { action: 'operations_learning_feedback', productId: '565', feedback: 'reasonable', questionIndex: 1 } }] },
      },
    });

    expect(sent).toEqual([
      { kind: 'reply', request: { path: { message_id: 'om-feedback-behavior' }, data: { content: JSON.stringify({ text: '已收到运营学习反馈：565 reasonable' }), msg_type: 'text' } } },
    ]);
  });

  it('acknowledges operations learning feedback when SDK returns flattened card action data', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'mt-agent-empty-learning-'));
    const registered: Record<string, (data: unknown) => Promise<void>> = {};
    const sent: unknown[] = [];
    const bot = createFeishuSdkBot({ appId: 'app', appSecret: 'secret', outputDir, sdk: fakeSdk(sent, registered) });

    bot.start();
    await registered['card.action.trigger']({
      context: { open_message_id: 'om-feedback-flat' },
      action: { tag: 'button', behaviors: [{ type: 'callback', value: { action: 'operations_learning_feedback', productId: '565', feedback: 'reasonable', questionIndex: 1 } }] },
    });

    expect(sent).toEqual([
      { kind: 'reply', request: { path: { message_id: 'om-feedback-flat' }, data: { content: JSON.stringify({ text: '已收到运营学习反馈：565 reasonable' }), msg_type: 'text' } } },
    ]);
  });
});
