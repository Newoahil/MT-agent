import { describe, expect, it } from 'vitest';
import { buildAgentToolConfirmCard, parseAgentToolConfirmRequest } from '../src/agentRuntime/approvalCard.js';

describe('agent runtime approval card', () => {
  it('builds a generic Feishu confirmation card for registered agent tools', () => {
    const card = buildAgentToolConfirmCard({
      toolName: 'rental.operationConfirmRequest',
      arguments: { action: 'copy', productId: '875' },
      reason: '用户希望复制商品 875',
    });

    expect(JSON.stringify(card)).toContain('Agent 操作确认');
    expect(JSON.stringify(card)).toContain('agent_tool_confirm');
    expect(JSON.stringify(card)).toContain('rental.operationConfirmRequest');
    expect(JSON.stringify(card)).toContain('875');
  });

  it('parses only registered tools with schema-valid arguments', () => {
    expect(parseAgentToolConfirmRequest({
      request: {
        toolName: 'rental.operationConfirmRequest',
        arguments: { action: 'delist', productId: '761' },
        reason: '用户要求下架',
      },
    })).toEqual({
      toolName: 'rental.operationConfirmRequest',
      arguments: { action: 'delist', productId: '761' },
      reason: '用户要求下架',
    });

    expect(parseAgentToolConfirmRequest({
      request: {
        toolName: 'danger.deleteEverything',
        arguments: {},
        reason: 'bad',
      },
    })).toBeNull();

    expect(parseAgentToolConfirmRequest({
      request: {
        toolName: 'rental.operationConfirmRequest',
        arguments: { action: 'delist', productId: '761', script: 'evil' },
        reason: 'bad',
      },
    })).toBeNull();
  });
});
