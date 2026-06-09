import type { GoodsSnapshotItem, NewProductObservationItem } from './types.js';

function validInternalId(item: GoodsSnapshotItem): string | null {
  const trimmed = item.internalProductId.trim();
  return /^[0-9]+$/.test(trimmed) ? trimmed : null;
}

function internalIdNumber(item: GoodsSnapshotItem): number {
  const internalId = validInternalId(item);
  return internalId === null ? -1 : Number(internalId);
}

export function detectNewGoods(date: string, previous: GoodsSnapshotItem[], current: GoodsSnapshotItem[]): NewProductObservationItem[] {
  const previousIds = new Set(previous.map(validInternalId).filter((internalId) => internalId !== null));
  const emittedIds = new Set<string>();
  const observations: NewProductObservationItem[] = [];

  for (const item of current) {
    const internalId = validInternalId(item);
    if (internalId === null || previousIds.has(internalId) || emittedIds.has(internalId)) {
      continue;
    }

    emittedIds.add(internalId);
    observations.push({ ...item, internalProductId: internalId, date, source: 'goods_diff' });
  }

  return observations;
}

export function latestInternalIds(items: GoodsSnapshotItem[], limit: number): GoodsSnapshotItem[] {
  if (limit <= 0) {
    return [];
  }

  return [...items]
    .filter((item) => validInternalId(item) !== null)
    .sort((left, right) => internalIdNumber(right) - internalIdNumber(left))
    .slice(0, limit);
}
