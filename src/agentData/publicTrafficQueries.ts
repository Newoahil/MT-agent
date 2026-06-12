import type { PeriodKey } from '../domain/types.js';
import type { PublicTrafficDataReportContext, PublicTrafficPeriodMetrics, PublicTrafficReportSectionItem } from '../publicTraffic/types.js';
import type {
  AgentNewProductPoolItem,
  AgentOverviewAnswer,
  AgentOverviewMetric,
  AgentProblemProduct,
  AgentProblemType,
  AgentProductAnswer,
  AgentProductPeriodMetric,
} from './types.js';

type ContextWithNewProductPool = PublicTrafficDataReportContext & {
  newProductPoolItems?: Array<{ productId: string; productName: string; maintenanceStatus?: string }>;
  newProductPoolIds?: string[];
};

const PERIODS: PeriodKey[] = ['1d', '7d', '30d'];

function toOverviewMetric(period: PeriodKey, metric: PublicTrafficDataReportContext['summary'][PeriodKey]): AgentOverviewMetric {
  return {
    period,
    exposure: metric.exposure,
    publicVisits: metric.publicVisits,
    createdOrders: metric.createdOrders,
    shippedOrders: metric.shippedOrders,
    amount: metric.amount,
    exposureVisitRate: metric.exposureVisitRate,
    visitShipmentRate: metric.visitShipmentRate,
  };
}

function toProductMetric(period: PeriodKey, metric: PublicTrafficPeriodMetrics): AgentProductPeriodMetric {
  return {
    period,
    exposure: metric.exposure,
    publicVisits: metric.publicVisits,
    createdOrders: metric.createdOrders,
    shippedOrders: metric.shippedOrders,
    amount: metric.amount,
    exposureVisitRate: metric.exposureVisitRate,
    visitShipmentRate: metric.visitShipmentRate,
  };
}

function sectionItems(type: AgentProblemType, rows: PublicTrafficReportSectionItem[]): AgentProblemProduct[] {
  return rows.map((row) => ({ type, productId: row.identifier, action: row.action, reason: row.reason }));
}

export function getLatestOverview(context: PublicTrafficDataReportContext): AgentOverviewAnswer {
  return {
    date: context.date,
    metrics: PERIODS.map((period) => toOverviewMetric(period, context.summary[period])),
    dataQualityNotes: context.dataQualityNotes ?? [],
  };
}

export function getProductPerformance(context: PublicTrafficDataReportContext, keyword: string): AgentProductAnswer | null {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return null;

  const row = context.rows.find(
    (item) =>
      item.displayProductId.toLowerCase() === normalized ||
      item.platformProductId.toLowerCase() === normalized ||
      item.productName.toLowerCase().includes(normalized),
  );
  if (!row) return null;

  return {
    productId: row.displayProductId,
    productName: row.productName,
    platformProductId: row.platformProductId,
    custodyDays: row.custodyDays,
    periods: PERIODS.map((period) => toProductMetric(period, row.periods[period])),
  };
}

export function getProblemProducts(context: PublicTrafficDataReportContext, type: AgentProblemType): AgentProblemProduct[] {
  if (type === 'low_exposure') return sectionItems(type, context.lowExposure);
  if (type === 'weak_conversion') return sectionItems(type, context.weakConversion);
  if (type === 'high_potential') return sectionItems(type, context.highPotential);
  if (type === 'recommended_action') return sectionItems(type, context.recommendedActions);
  return getNewProductPool(context).map((item) => ({ type: 'new_product_pool', productId: item.productId, action: item.maintenanceStatus, reason: item.productName }));
}

export function getNewProductPool(context: PublicTrafficDataReportContext): AgentNewProductPoolItem[] {
  const extended = context as ContextWithNewProductPool;
  if (extended.newProductPoolItems?.length) {
    return extended.newProductPoolItems.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      maintenanceStatus: item.maintenanceStatus ?? '待维护',
    }));
  }

  return (extended.newProductPoolIds ?? []).map((productId) => ({ productId, productName: '', maintenanceStatus: '待维护' }));
}
