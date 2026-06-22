import type { LlmProvider } from '../llm/provider.js';
import { listAgentPlannerTools, type AgentPlannerProvider, type AgentPlannerRequest } from './planner.js';
import { listAgentWorkflows } from './workflowRegistry.js';

export type AgentPlanInput = Omit<AgentPlannerRequest, 'tools' | 'workflows'>;

export function createAgentPlannerProvider(provider: LlmProvider): AgentPlannerProvider {
  return {
    async proposePlan(request: AgentPlanInput) {
      const plannerRequest: AgentPlannerRequest = {
        ...request,
        tools: listAgentPlannerTools(),
        workflows: listAgentWorkflows(),
      };
      const result = await provider.generateJson({
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: [
              'You are an operations agent planner. Select exactly one registered tool for the user message.',
              'Never invent tool names or arguments. Return only a bare JSON object with goal, selectedTool, arguments, confidence, reason, and optional requiresConfirmation.',
              'Use workflows only as composition hints; workflows are not executable tools.',
              'For write or high-risk tools, set requiresConfirmation to true. Do not claim execution has happened.',
            ].join(' '),
          },
          { role: 'user', content: JSON.stringify(plannerRequest) },
        ],
      });
      return result.text;
    },
  };
}
