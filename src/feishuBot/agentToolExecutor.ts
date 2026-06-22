import { runPublicTrafficReportCli } from '../cli/publicTrafficReport.js';
import type { AgentToolConfirmRequest } from '../agentRuntime/approvalCard.js';
import { startOperationsLearningSession } from '../operationsLearningLoop/session.js';
import type { BotResponse } from './types.js';
import { formatIdLookupResult, lookupProductId } from './idLookup.js';
import {
  createRentalPriceSkillClient,
  executeRentalOperationConfirmRequest,
  parseRentalOperationConfirmRequest,
  type RentalPriceSkillClient,
} from './rentalPrice.js';
import { findLatestReportContext, formatLatestSummary, formatProductRows, queryProductRows } from './reportStore.js';

export interface AgentToolExecutionOptions {
  rentalPriceClient?: RentalPriceSkillClient;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requireString(value: unknown, fieldName: string): string {
  const parsed = readString(value);
  if (!parsed) throw new Error(`${fieldName} is required`);
  return parsed;
}

export async function executeAgentToolRequest(
  request: AgentToolConfirmRequest,
  outputDir = 'output',
  options: AgentToolExecutionOptions = {},
): Promise<BotResponse> {
  switch (request.toolName) {
    case 'publicTraffic.latestSummary': {
      const latest = await findLatestReportContext(outputDir);
      return { text: latest ? formatLatestSummary(latest.context) : '还没有找到公域日报上下文。' };
    }
    case 'product.query': {
      const latest = await findLatestReportContext(outputDir);
      const keyword = requireString(request.arguments.keyword, 'keyword');
      return { text: latest ? formatProductRows(queryProductRows(latest.context, keyword)) : '还没有找到公域日报上下文。' };
    }
    case 'productId.lookup': {
      const latest = await findLatestReportContext(outputDir);
      const query = requireString(request.arguments.keyword, 'keyword');
      return { text: latest ? formatIdLookupResult(lookupProductId(latest.context, query)) : '还没有找到公域日报上下文。' };
    }
    case 'operationsLearning.startQuiz': {
      const latest = await findLatestReportContext(outputDir);
      return latest ? startOperationsLearningSession(outputDir, latest.context) : { text: '还没有找到公域日报上下文。' };
    }
    case 'publicTraffic.runReport':
      await runPublicTrafficReportCli();
      return { text: '公域日报已生成并发送。' };
    case 'rental.operationConfirmRequest': {
      const rentalRequest = parseRentalOperationConfirmRequest({ request: request.arguments });
      if (!rentalRequest) throw new Error('租赁商品操作参数无效，请重新发起。');
      const result = await executeRentalOperationConfirmRequest(options.rentalPriceClient ?? createRentalPriceSkillClient(), rentalRequest);
      return { text: result.text };
    }
    case 'publicTraffic.crawlSources':
      throw new Error('publicTraffic.crawlSources 当前需要 CLI AgentConfig，尚未接入飞书审批执行。');
    case 'rental.pricePreview':
      throw new Error('rental.pricePreview 当前仍使用专用改价预览卡流程。');
    default:
      throw new Error(`Unsupported agent tool: ${request.toolName}`);
  }
}
