# 飞书推送 .env 加载 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `test-feishu`、`public-traffic-report` 和 `daily-report` 自动从本地 `.env` 读取飞书凭据，打通本机飞书推送验证。

**Architecture:** 新增一个无依赖的 `.env` loader，启动 CLI 时先调用它把 `.env` 中不存在于当前环境的变量写入 `process.env`。`.env.example` 只提交示例变量名，真实 `.env` 由用户本地保存且不提交。

**Tech Stack:** Node.js, TypeScript, Vitest, existing Feishu App API/Webhook notification modules.

---

## File Structure

- Create `src/config/loadEnv.ts`: 读取 `.env`，解析简单 `KEY=VALUE` 行，不覆盖已有环境变量。
- Create `tests/loadEnv.test.ts`: 覆盖加载、保留已有变量、忽略注释/无效行、缺文件不报错。
- Create `.env.example`: 飞书 App API 示例变量，不含真实 secret。
- Modify `src/cli/testFeishu.ts`: 在发送测试消息前调用 `loadEnv()`。
- Modify `src/cli/publicTrafficReport.ts`: 在任何使用 `process.env` 的飞书发送前调用 `loadEnv()`。
- Modify `src/cli/dailyReport.ts`: 在发送日报飞书消息前调用 `loadEnv()`。
- Create `tests/cliLoadEnvSource.test.ts`: 确认三个 CLI 都导入并调用 `loadEnv()`。

## Task 1: Env Loader

**Files:**
- Create: `src/config/loadEnv.ts`
- Create: `tests/loadEnv.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/loadEnv.test.ts`:

```ts
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/loadEnv.js';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'mt-env-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('loadEnv', () => {
  it('loads variables from env file', async () => {
    await withTempDir(async (dir) => {
      const env: Record<string, string | undefined> = {};
      const path = join(dir, '.env');
      await writeFile(path, 'FEISHU_APP_ID=cli_test\nFEISHU_RECEIVE_ID_TYPE=open_id\n', 'utf8');

      await loadEnv(path, env);

      expect(env.FEISHU_APP_ID).toBe('cli_test');
      expect(env.FEISHU_RECEIVE_ID_TYPE).toBe('open_id');
    });
  });

  it('does not override existing variables', async () => {
    await withTempDir(async (dir) => {
      const env: Record<string, string | undefined> = { FEISHU_APP_ID: 'from-shell' };
      const path = join(dir, '.env');
      await writeFile(path, 'FEISHU_APP_ID=from-file\n', 'utf8');

      await loadEnv(path, env);

      expect(env.FEISHU_APP_ID).toBe('from-shell');
    });
  });

  it('ignores comments blank lines and invalid lines, and strips simple quotes', async () => {
    await withTempDir(async (dir) => {
      const env: Record<string, string | undefined> = {};
      const path = join(dir, '.env');
      await writeFile(path, '# comment\n\nINVALID_LINE\nFEISHU_APP_SECRET="secret value"\nFEISHU_RECEIVE_ID=\'ou_test\'\n', 'utf8');

      await loadEnv(path, env);

      expect(env.INVALID_LINE).toBeUndefined();
      expect(env.FEISHU_APP_SECRET).toBe('secret value');
      expect(env.FEISHU_RECEIVE_ID).toBe('ou_test');
    });
  });

  it('does not fail when env file is missing', async () => {
    await withTempDir(async (dir) => {
      const env: Record<string, string | undefined> = {};
      await expect(loadEnv(join(dir, '.env'), env)).resolves.toBeUndefined();
      expect(env).toEqual({});
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/loadEnv.test.ts`

Expected: FAIL because `../src/config/loadEnv.js` does not exist.

- [ ] **Step 3: Implement env loader**

Create `src/config/loadEnv.ts`:

```ts
import { readFile } from 'node:fs/promises';

export type MutableEnv = Record<string, string | undefined>;

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const equalsIndex = trimmed.indexOf('=');
  if (equalsIndex <= 0) return null;

  const key = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

export async function loadEnv(path = '.env', env: MutableEnv = process.env): Promise<void> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  for (const line of text.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (env[key] === undefined) {
      env[key] = value;
    }
  }
}
```

- [ ] **Step 4: Run tests and build**

Run: `npm test -- tests/loadEnv.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/loadEnv.ts tests/loadEnv.test.ts
git commit -m "功能：新增本地环境变量加载"
```

## Task 2: CLI Wiring And Example Env

**Files:**
- Create: `.env.example`
- Modify: `src/cli/testFeishu.ts`
- Modify: `src/cli/publicTrafficReport.ts`
- Modify: `src/cli/dailyReport.ts`
- Create: `tests/cliLoadEnvSource.test.ts`

- [ ] **Step 1: Write failing source test**

Create `tests/cliLoadEnvSource.test.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

async function source(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

describe('CLI loadEnv wiring', () => {
  it('loads .env before Feishu test send', async () => {
    const text = await source('../src/cli/testFeishu.ts');
    expect(text).toContain("import { loadEnv } from '../config/loadEnv.js';");
    expect(text.indexOf('await loadEnv();')).toBeLessThan(text.indexOf('maybeSendFeishuTestMessage()'));
  });

  it('loads .env before public traffic Feishu send', async () => {
    const text = await source('../src/cli/publicTrafficReport.ts');
    expect(text).toContain("import { loadEnv } from '../config/loadEnv.js';");
    expect(text.indexOf('await loadEnv();')).toBeLessThan(text.indexOf('sendFeishuText(process.env, text)'));
  });

  it('loads .env before daily report Feishu send', async () => {
    const text = await source('../src/cli/dailyReport.ts');
    expect(text).toContain("import { loadEnv } from '../config/loadEnv.js';");
    expect(text.indexOf('await loadEnv();')).toBeLessThan(text.indexOf('maybeSendFeishuReport(report'));
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/cliLoadEnvSource.test.ts`

Expected: FAIL because CLIs do not import or call `loadEnv()`.

- [ ] **Step 3: Wire `testFeishu` CLI**

Modify `src/cli/testFeishu.ts`:

```ts
import { pathToFileURL } from 'node:url';
import { loadEnv } from '../config/loadEnv.js';
import { maybeSendFeishuTestMessage } from '../notify/feishu.js';

export async function runTestFeishuCli(): Promise<void> {
  await loadEnv();
  const result = await maybeSendFeishuTestMessage();
  if (!result.sent) {
    throw new Error(`Feishu test message was not sent: ${result.reason}`);
  }

  console.log(`Feishu test message sent via ${result.channel}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runTestFeishuCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 4: Wire `publicTrafficReport` CLI**

In `src/cli/publicTrafficReport.ts`, add import:

```ts
import { loadEnv } from '../config/loadEnv.js';
```

Then add `await loadEnv();` at the start of `runPublicTrafficReportCli`, before `loadConfig()`:

```ts
export async function runPublicTrafficReportCli(): Promise<void> {
  await loadEnv();
  const config = await loadConfig();
```

- [ ] **Step 5: Wire `dailyReport` CLI**

In `src/cli/dailyReport.ts`, add import:

```ts
import { loadEnv } from '../config/loadEnv.js';
```

Then add `await loadEnv();` at the start of `runDailyReportCli`, before `loadConfig()`:

```ts
export async function runDailyReportCli(): Promise<void> {
  await loadEnv();
  const config = await loadConfig();
```

- [ ] **Step 6: Add env example**

Create `.env.example`:

```text
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=replace-with-your-secret
FEISHU_RECEIVE_ID_TYPE=open_id
FEISHU_RECEIVE_ID=ou_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- [ ] **Step 7: Run tests and build**

Run: `npm test -- tests/cliLoadEnvSource.test.ts`

Expected: PASS.

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add .env.example src/cli/testFeishu.ts src/cli/publicTrafficReport.ts src/cli/dailyReport.ts tests/cliLoadEnvSource.test.ts
git commit -m "功能：接入飞书推送环境变量加载"
```

## Task 3: Local Feishu Verification

**Files:**
- Local only: `.env`
- No source changes unless verification reveals a bug.

- [ ] **Step 1: Create local `.env`**

Create `.env` in project root with real credentials. Do not commit it. The operator should enter the real `FEISHU_APP_SECRET` value locally; the plan deliberately does not include it.

```text
FEISHU_APP_ID=cli_aaac356831239cfa
FEISHU_APP_SECRET=replace-with-local-secret
FEISHU_RECEIVE_ID_TYPE=open_id
FEISHU_RECEIVE_ID=ou_219b68ec47f9740ef2c1234e197b87d1
```

The real secret must be entered locally by the user or operator. Do not print it in command output or commit it.

- [ ] **Step 2: Run Feishu test message**

Run: `npm run test-feishu`

Expected: PASS with console output `Feishu test message sent via app.` and a message received in Feishu.

- [ ] **Step 3: Run public traffic report with Feishu send**

Run: `npm run public-traffic-report`

Expected:

- Public traffic report still completes.
- `output/public-traffic/YYYY-MM-DD/run.log` contains `飞书通知已发送`.
- Feishu receives the public traffic report summary.

- [ ] **Step 4: Final verification**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit verification fixes if needed**

If source code changed during verification:

```bash
git add src/config/loadEnv.ts src/cli/testFeishu.ts src/cli/publicTrafficReport.ts src/cli/dailyReport.ts tests/loadEnv.test.ts tests/cliLoadEnvSource.test.ts .env.example
git commit -m "修复：完善飞书环境变量加载验证"
```

Do not add `.env`.

## Final Review

- [ ] Verify `git status --short` does not include `.env`.
- [ ] Run final `npm test`.
- [ ] Run final `npm run build`.
- [ ] Request final code review.

## Self-Review Notes

- Spec coverage: loader behavior, no override, CLI wiring, `.env.example`, test message, public traffic report send, `.env` not committed are covered.
- Out of scope remains excluded: real secret commit, secret reset, Feishu Q&A/events/cards, message format changes.
- Type consistency: `loadEnv(path?: string, env?: MutableEnv): Promise<void>` is used consistently by tests and CLIs.
