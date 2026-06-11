import type { PublicTrafficDataReportContext, PublicTrafficReportSectionItem } from './types.js';

export interface DiagnosticItem {
  type: string;
  item: PublicTrafficReportSectionItem;
}

export function flattenDiagnosticItems(context: PublicTrafficDataReportContext): DiagnosticItem[] {
  return [
    ...context.lowExposure.map((item) => ({ type: '曝光不足', item })),
    ...context.weakClick.map((item) => ({ type: '点击弱', item })),
    ...context.weakConversion.map((item) => ({ type: '转化弱', item })),
    ...context.highPotential.map((item) => ({ type: '高潜力', item })),
    ...context.lifecycleGovernance.map((item) => ({ type: '生命周期治理', item })),
  ];
}

export function sortedActions(items: PublicTrafficReportSectionItem[]): PublicTrafficReportSectionItem[] {
  return [...items].sort((a, b) => a.action.localeCompare(b.action, 'zh-CN') || a.identifier.localeCompare(b.identifier, 'zh-CN'));
}
