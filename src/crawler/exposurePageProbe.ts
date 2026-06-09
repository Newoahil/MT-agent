import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';
import type { AgentConfig } from '../domain/types.js';
import { clearBrowserProfileLocks, prepareDashboardPage } from './browserProfile.js';
import { selectSubAccountIfNeeded } from './dashboardCrawler.js';
import { shouldKeepBrowserOpenOnFailure } from './failureHandling.js';
import { waitForSettledLoginState } from './loginState.js';

export interface ExposureProbeSummary {
  url?: string;
  controls: string[];
  tables?: Array<{ headers: string[]; sampleRows: string[][] }>;
}

export function summarizeExposureProbeText(texts: string[]): ExposureProbeSummary {
  return { controls: texts.map((text) => text.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 200) };
}

async function ensureExposurePage(config: AgentConfig, page: Page): Promise<void> {
  const url = config.exposureUrl ?? 'https://b.alipay.com/page/self-operation-center/custody?custodyChannel=public';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const state = await waitForSettledLoginState(page, { timeoutMs: 60000, intervalMs: 1000 });
  if (state === 'login-page') {
    console.log('检测到支付宝登录页，请扫码登录；登录成功后程序会继续探测曝光页面。');
    await page.waitForURL((currentUrl) => !/auth\.alipay\.com|login/i.test(currentUrl.toString()), { timeout: 300000 });
  }
  if (page.url().includes('select-identity')) {
    await selectSubAccountIfNeeded(page);
  }
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
}

export async function probeExposurePage(config: AgentConfig, outputPath = 'output/latest/exposure-page-probe.json'): Promise<void> {
  await mkdir('output/latest', { recursive: true });
  await clearBrowserProfileLocks(config.browserProfileDir);
  const browser = await chromium.launchPersistentContext(config.browserProfileDir, { headless: false });
  const page = await prepareDashboardPage(browser.pages(), () => browser.newPage());
  let completed = false;

  try {
    await ensureExposurePage(config, page);
    const controls = await page.locator('button, .ant-tabs-tab, .ant-select-selection-item, .ant-radio-button-wrapper, label, .ant-btn').evaluateAll((nodes) => nodes.map((node) => String(node.textContent ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean));
    const tables = await page.locator('table').evaluateAll((tables) => tables.map((table) => {
      const headers = Array.from(table.querySelectorAll('thead th')).map((cell) => String(cell.textContent ?? '').replace(/\s+/g, ' ').trim());
      const sampleRows = Array.from(table.querySelectorAll('tbody tr')).slice(0, 5).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => String(cell.textContent ?? '').replace(/\s+/g, ' ').trim()));
      return { headers, sampleRows };
    }));
    await writeFile(outputPath, JSON.stringify({ url: page.url(), controls: summarizeExposureProbeText(controls).controls, tables }, null, 2), 'utf8');
    completed = true;
  } finally {
    if (completed || !shouldKeepBrowserOpenOnFailure(process.env.MT_AGENT_KEEP_BROWSER_ON_FAILURE)) {
      await browser.close();
    } else {
      console.error('Exposure probe failed; keeping browser open for inspection.');
    }
  }
}
