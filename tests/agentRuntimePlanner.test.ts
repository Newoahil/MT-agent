import { describe, expect, it } from 'vitest';
import { validateAgentMultiStepPlannerProposal, validateAgentPlannerClarificationProposal, validateAgentPlannerProposal } from '../src/agentRuntime/planner.js';

describe('agent runtime planner proposal validation', () => {
  it('validates a read-tool proposal and applies allow policy', () => {
    expect(validateAgentPlannerProposal('{"goal":"查询商品表现","selectedTool":"product.query","arguments":{"keyword":"565"},"confidence":0.88,"reason":"用户询问商品 565"}')).toEqual({
      ok: true,
      proposal: {
        goal: '查询商品表现',
        selectedTool: 'product.query',
        arguments: { keyword: '565' },
        confidence: 0.88,
        reason: '用户询问商品 565',
      },
      policy: { decision: 'allow', toolName: 'product.query', risk: 'read' },
    });
  });

  it('validates explicit report date arguments for read tools', () => {
    expect(validateAgentPlannerProposal('{"goal":"查询指定日期商品表现","selectedTool":"product.query","arguments":{"keyword":"733","date":"2026-06-10"},"confidence":0.91,"reason":"用户指定日期和商品"}')).toMatchObject({
      ok: true,
      proposal: {
        selectedTool: 'product.query',
        arguments: { keyword: '733', date: '2026-06-10' },
      },
      policy: { decision: 'allow', toolName: 'product.query', risk: 'read' },
    });
  });

  it('rejects malformed JSON and unknown tools', () => {
    expect(validateAgentPlannerProposal('不是 JSON')).toEqual({ ok: false, reason: 'invalid_json' });
    expect(validateAgentPlannerProposal('{"goal":"删除全部","selectedTool":"danger.deleteAll","arguments":{},"confidence":0.99,"reason":"bad"}')).toEqual({ ok: false, reason: 'unknown_tool' });
  });

  it('rejects arguments that do not satisfy tool metadata schema', () => {
    expect(validateAgentPlannerProposal('{"goal":"查询商品表现","selectedTool":"product.query","arguments":{},"confidence":0.88,"reason":"缺少 keyword"}')).toEqual({ ok: false, reason: 'invalid_arguments' });
    expect(validateAgentPlannerProposal('{"goal":"查询商品表现","selectedTool":"product.query","arguments":{"keyword":"565","extra":true},"confidence":0.88,"reason":"多余字段"}')).toEqual({ ok: false, reason: 'invalid_arguments' });
  });

  it('gates dashboard refresh write proposals behind confirmation and does not execute tools', () => {
    expect(validateAgentPlannerProposal('{"goal":"补抓访问页数据","selectedTool":"publicTraffic.refreshDashboard","arguments":{},"confidence":0.91,"reason":"用户要求抓取访问页数据","requiresConfirmation":false}')).toEqual({
      ok: true,
      proposal: {
        goal: '补抓访问页数据',
        selectedTool: 'publicTraffic.refreshDashboard',
        arguments: {},
        confidence: 0.91,
        reason: '用户要求抓取访问页数据',
        requiresConfirmation: false,
      },
      policy: {
        decision: 'confirmation_required',
        toolName: 'publicTraffic.refreshDashboard',
        risk: 'write',
        proposal: { toolName: 'publicTraffic.refreshDashboard', input: {}, reason: '用户要求抓取访问页数据' },
      },
    });
  });

  it('validates multi-step plans and keeps write steps gated by policy', () => {
    expect(validateAgentMultiStepPlannerProposal(JSON.stringify({
      goal: '先看日报再推送到群',
      steps: [
        { toolName: 'publicTraffic.latestSummary', arguments: {}, reason: '先读取最新日报概况' },
        { toolName: 'publicTraffic.pushLatestReportToGroup', arguments: {}, reason: '再推送日报到群' },
      ],
      confidence: 0.86,
      reason: '用户要求先查询再执行推送',
    }))).toEqual({
      ok: true,
      proposal: {
        goal: '先看日报再推送到群',
        steps: [
          { toolName: 'publicTraffic.latestSummary', arguments: {}, reason: '先读取最新日报概况' },
          { toolName: 'publicTraffic.pushLatestReportToGroup', arguments: {}, reason: '再推送日报到群' },
        ],
        confidence: 0.86,
        reason: '用户要求先查询再执行推送',
      },
      policies: [
        { decision: 'allow', toolName: 'publicTraffic.latestSummary', risk: 'read' },
        {
          decision: 'confirmation_required',
          toolName: 'publicTraffic.pushLatestReportToGroup',
          risk: 'write',
          proposal: { toolName: 'publicTraffic.pushLatestReportToGroup', input: {}, reason: '再推送日报到群' },
        },
      ],
    });
  });

  it('rejects invalid multi-step plans', () => {
    expect(validateAgentMultiStepPlannerProposal('{"goal":"bad","steps":[{"toolName":"product.query","arguments":{},"reason":"missing keyword"},{"toolName":"system.help","arguments":{},"reason":"help"}],"confidence":0.7,"reason":"bad"}')).toEqual({ ok: false, reason: 'invalid_arguments' });
    expect(validateAgentMultiStepPlannerProposal('{"goal":"bad","steps":[{"toolName":"missing.tool","arguments":{},"reason":"bad"},{"toolName":"system.help","arguments":{},"reason":"help"}],"confidence":0.7,"reason":"bad"}')).toEqual({ ok: false, reason: 'unknown_tool' });
  });

  it('validates clarification proposals for ambiguous goals', () => {
    expect(validateAgentPlannerClarificationProposal(JSON.stringify({
      goal: '澄清 pocket3 操作',
      needsClarification: true,
      originalMessage: '帮我处理一下 pocket3',
      question: '你想怎么处理 pocket3？',
      options: [
        { label: '查询数据', message: '查询 pocket3 的公域数据', description: '只读查询' },
        { label: '铺新链', message: '帮我铺十条 pocket3 的新链', description: '需要确认后复制' },
      ],
      confidence: 0.42,
      reason: '处理动作不明确',
    }))).toEqual({
      ok: true,
      proposal: {
        goal: '澄清 pocket3 操作',
        originalMessage: '帮我处理一下 pocket3',
        question: '你想怎么处理 pocket3？',
        options: [
          { label: '查询数据', message: '查询 pocket3 的公域数据', description: '只读查询' },
          { label: '铺新链', message: '帮我铺十条 pocket3 的新链', description: '需要确认后复制' },
        ],
        confidence: 0.42,
        reason: '处理动作不明确',
      },
    });
  });

  it('rejects malformed clarification proposals', () => {
    expect(validateAgentPlannerClarificationProposal('{"goal":"bad","needsClarification":true,"originalMessage":"x","question":"q","options":[{"label":"only","message":"x"}],"confidence":0.5,"reason":"bad"}')).toEqual({ ok: false, reason: 'invalid_options' });
    expect(validateAgentPlannerClarificationProposal('{"goal":"bad","needsClarification":false,"originalMessage":"x","question":"q","options":[],"confidence":0.5,"reason":"bad"}')).toEqual({ ok: false, reason: 'invalid_shape' });
  });
});
