import { pathToFileURL } from 'node:url';
import { loadConfig } from '../config/loadConfig.js';
import { probeExposurePage } from '../crawler/exposurePageProbe.js';

export async function runProbeExposurePageCli(): Promise<void> {
  const config = await loadConfig();
  await probeExposurePage(config);
  console.log('Wrote exposure page probe to output/latest/exposure-page-probe.json');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProbeExposurePageCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
