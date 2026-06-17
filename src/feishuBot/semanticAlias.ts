/**
 * Deterministic semantic alias routing for Feishu bot natural-language @ messages.
 *
 * This is the FIRST safe step before LLM-based intent resolution.
 * Natural phrases like "发个日报", "推送到群", "做个测验" are mapped to
 * the same BotIntent types as their explicit command counterparts.
 *
 * Design principles:
 * 1. Exact parser (parseExactBotIntent) wins first — semantic aliases only
 *    apply when the exact parser returns unknown.
 * 2. Rental write operations (下架, 复制, 改价 etc.) are NOT mapped here;
 *    they remain unknown until LLM-based routing is added.
 * 3. No external API calls — purely deterministic string matching.
 */

import type { BotIntent, FeishuSendTo } from './types.js';

// ---------------------------------------------------------------------------
// sendTo extraction — reused from intent.ts logic
// ---------------------------------------------------------------------------
function extractSendTo(text: string): FeishuSendTo | undefined {
  if (/发全部|发两边|both/i.test(text)) return 'both';
  if (/发群|群里|group/i.test(text)) return 'group';
  if (/发我|个人|personal/i.test(text)) return 'personal';
  return undefined;
}

// ---------------------------------------------------------------------------
// Semantic alias groups
// ---------------------------------------------------------------------------

/**
 * Group 1: Report generation — natural phrases for run_public_traffic_report.
 *
 * Patterns:
 *   发个日报, 发一下日报, 做个日报, 跑个日报
 *   + optional sendTo suffix: 发群, 发我, 发全部, 群里, 个人
 *
 * Also matches variants with 公域日报:
 *   发个公域日报, 做个公域日报, 跑个公域日报
 */
const REPORT_PATTERNS = [
  /^(?:发|做|跑)(?:个|一下|一)?(?:公域)?日报/,       // 发个日报, 做一下日报, 跑个公域日报
  /^(?:发|做|跑)(?:个|一下|一)?日报/,                  // same, already covered but explicit
];

function tryReportAlias(text: string): BotIntent | undefined {
  for (const pattern of REPORT_PATTERNS) {
    if (pattern.test(text)) {
      return { type: 'run_public_traffic_report', sendTo: extractSendTo(text) };
    }
  }
  return undefined;
}

/**
 * Group 2: Push to group — natural phrases for push_latest_report_to_group.
 *
 * Patterns:
 *   推送到群, 发到群里, 日报推到群里
 *   推送日报, 日报推送到群
 */
const PUSH_PATTERNS = [
  /^推送(?:日报|公域日报)?到群/,                        // 推送到群, 推送日报到群
  /^发到群里/,                                          // 发到群里
  /^日报推到群里/,                                      // 日报推到群里
  /^日报推送到群/,                                      // 日报推送到群
];

function tryPushAlias(text: string): BotIntent | undefined {
  for (const pattern of PUSH_PATTERNS) {
    if (pattern.test(text)) {
      return { type: 'push_latest_report_to_group' };
    }
  }
  return undefined;
}

/**
 * Group 3: Quiz — natural phrases for operations_learning_quiz.
 *
 * Patterns:
 *   做个测验, 来个测验, 开始测验, 出个运营题
 *   做个运营测验, 来个运营测验
 */
const QUIZ_PATTERNS = [
  /^(?:做|来|开始|出)(?:个|一下|一)?(?:运营)?(?:测验|题)/,  // 做个测验, 来个测验, 开始测验, 出个运营题
  /^(?:做|来)(?:个|一下|一)?运营学习/,                        // 做个运营学习, 来个运营学习
];

function tryQuizAlias(text: string): BotIntent | undefined {
  for (const pattern of QUIZ_PATTERNS) {
    if (pattern.test(text)) {
      return { type: 'operations_learning_quiz' };
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Attempt to resolve a natural-language input to a BotIntent via deterministic
 * semantic aliases. Returns undefined if no alias matches.
 *
 * This is called ONLY when the exact parser (parseExactBotIntent) returns
 * unknown, ensuring exact commands always win.
 *
 * Rental write operations (下架, 复制, 改价 etc.) are intentionally NOT
 * mapped here — they remain unknown until LLM-based routing is added.
 */
export function resolveSemanticAlias(input: string): BotIntent | undefined {
  const text = input.replace(/\s+/g, ' ').trim();
  if (!text) return undefined;

  // Try each group in order of specificity
  return tryReportAlias(text) ?? tryPushAlias(text) ?? tryQuizAlias(text) ?? undefined;
}
