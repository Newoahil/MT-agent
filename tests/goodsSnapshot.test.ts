import { describe, expect, it } from 'vitest';
import { detectNewGoods, latestInternalIds } from '../src/publicTraffic/goodsSnapshot.js';

describe('goods snapshot', () => {
  it('detects new internal product ids from snapshots', () => {
    expect(
      detectNewGoods(
        '2026-06-09',
        [{ platformProductId: 'p1', internalProductId: '100', productName: 'Old' }],
        [
          { platformProductId: 'p1', internalProductId: '100', productName: 'Old' },
          { platformProductId: 'p2', internalProductId: '105', productName: 'New' },
        ],
      ),
    ).toEqual([{ date: '2026-06-09', platformProductId: 'p2', internalProductId: '105', productName: 'New', source: 'goods_diff' }]);
  });

  it('ignores invalid internal ids and de-duplicates current snapshot rows', () => {
    expect(
      detectNewGoods(
        '2026-06-09',
        [
          { platformProductId: 'old-1', internalProductId: '100', productName: 'Old' },
          { platformProductId: 'old-2', internalProductId: '100', productName: 'Old Duplicate' },
        ],
        [
          { platformProductId: 'existing', internalProductId: '100', productName: 'Existing' },
          { platformProductId: 'blank', internalProductId: '   ', productName: 'Blank' },
          { platformProductId: 'partial', internalProductId: '123abc', productName: 'Partial' },
          { platformProductId: 'new-1', internalProductId: '105', productName: 'New' },
          { platformProductId: 'new-2', internalProductId: '105', productName: 'New Duplicate' },
        ],
      ),
    ).toEqual([{ date: '2026-06-09', platformProductId: 'new-1', internalProductId: '105', productName: 'New', source: 'goods_diff' }]);
  });

  it('finds largest internal ids as recent candidates', () => {
    expect(
      latestInternalIds([
        { platformProductId: 'p1', internalProductId: '100', productName: 'A' },
        { platformProductId: 'p2', internalProductId: '120', productName: 'B' },
        { platformProductId: 'p3', internalProductId: '110', productName: 'C' },
      ], 2),
    ).toEqual([
      { platformProductId: 'p2', internalProductId: '120', productName: 'B' },
      { platformProductId: 'p3', internalProductId: '110', productName: 'C' },
    ]);
  });

  it('filters invalid internal ids when selecting recent candidates', () => {
    expect(
      latestInternalIds([
        { platformProductId: 'p1', internalProductId: '100', productName: 'A' },
        { platformProductId: 'p2', internalProductId: '123abc', productName: 'Partial' },
        { platformProductId: 'p3', internalProductId: '   ', productName: 'Blank' },
        { platformProductId: 'p4', internalProductId: '090', productName: 'B' },
      ], 10),
    ).toEqual([
      { platformProductId: 'p1', internalProductId: '100', productName: 'A' },
      { platformProductId: 'p4', internalProductId: '090', productName: 'B' },
    ]);
  });

  it('returns no recent candidates when limit is not positive', () => {
    expect(
      latestInternalIds([
        { platformProductId: 'p1', internalProductId: '100', productName: 'A' },
      ], 0),
    ).toEqual([]);
  });
});
