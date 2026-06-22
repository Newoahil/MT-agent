import { describe, expect, it } from 'vitest';
import { findAgentTool } from '../src/agentRuntime/toolRegistry.js';
import { findAgentWorkflow, listAgentWorkflows } from '../src/agentRuntime/workflowRegistry.js';

describe('agent runtime workflow registry', () => {
  it('describes composite workflows without registering them as executable tools', () => {
    expect(listAgentWorkflows().map((workflow) => workflow.name)).toContain('rental.newLinkBatch');
    expect(findAgentWorkflow('rental.newLinkBatch')).toMatchObject({
      risk: 'high',
      requiresConfirmation: true,
      requiredCapabilities: expect.arrayContaining([
        'llm.intentUnderstanding',
        'linkRegistry.classificationLookup',
        'publicTraffic.performanceRanking',
        'rental.copyProduct',
      ]),
    });
    expect(findAgentTool('rental.newLinkBatch')).toBeUndefined();
    expect(findAgentTool('rental.newLinkBatchPlan')).toBeUndefined();
  });
});
