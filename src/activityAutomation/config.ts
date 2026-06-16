import { join } from 'node:path';
import type { AgentConfig } from '../domain/types.js';

export const ALIPAY_ACTIVITY_APP_ID = '2021005181665859';
export const ALIPAY_ACTIVITY_PRODUCT_CODE = 'PROMO_ZHIMA_REDUCTION';
export const ALIPAY_ACTIVITY_FORM_URL = `https://b.alipay.com/page/commodity-operation/activity/activityForm?appId=${ALIPAY_ACTIVITY_APP_ID}&productCode=${ALIPAY_ACTIVITY_PRODUCT_CODE}`;

export interface ActivityAutomationConfig {
  targetUrl: string;
  outputDir: string;
  browserProfileDir: string;
  headless: boolean;
  keepBrowserOnFailure: boolean;
}

export interface ActivityAutomationCliOptions {
  headless?: boolean;
  keepBrowserOnFailure?: boolean;
}

export function activityAutomationOutputDir(config: Pick<ActivityAutomationConfig, 'outputDir'>): string {
  return join(config.outputDir, 'latest', 'activity-automation');
}

export function activityAutomationConfigFromAgentConfig(agentConfig: AgentConfig, options: ActivityAutomationCliOptions = {}): ActivityAutomationConfig {
  return {
    targetUrl: ALIPAY_ACTIVITY_FORM_URL,
    outputDir: agentConfig.outputDir,
    browserProfileDir: agentConfig.browserProfileDir,
    headless: options.headless ?? false,
    keepBrowserOnFailure: options.keepBrowserOnFailure ?? true,
  };
}
