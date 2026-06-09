import { describe, expect, it } from 'vitest';
import { summarizeExposureProbeText } from '../src/crawler/exposurePageProbe.js';

describe('summarizeExposureProbeText', () => {
  it('keeps useful visible controls and metrics', () => {
    expect(summarizeExposureProbeText(['曝光', '访问', '交易金额', '', '   ', '导出商品']).controls).toEqual(['曝光', '访问', '交易金额', '导出商品']);
  });
});
