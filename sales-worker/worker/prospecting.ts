/**
 * Mint Sales System - 线索评分 / 邮箱发现 / 增强导入 (Phase 2 引擎)
 *
 *  - scoreLead:        规则化评分（权重和=100），返回总分 + 分项明细
 *  - discoverEmails:    基于域名+姓名的邮箱模式生成 + 校验 + 验证状态
 *  - importLeads:      增强版导入（去重 + 自动评分 + 邮箱发现 + 建联系人/商机/活动）
 */

import type {
  LeadCandidate, SourceType, LeadContact, SearchFilters,
} from './connectors';
import { CONNECTORS, getSourceLabel } from './connectors';

// ============================================================
//  评分配置 (目标市场 / 目标产品 / 行业权重)
// ============================================================
export const TARGET_COUNTRIES = [
  'United States', 'Germany', 'Turkey', 'India', 'Brazil',
  'Mexico', 'Vietnam', 'Indonesia', 'Poland', 'Spain', 'Japan',
];

const TARGET_PRODUCTS: string[] = ['laminated', 'spunbond', 'both'];

const CORE_INDUSTRIES = [
  'Baby & Adult Hygiene', 'Feminine Care', 'Medical Disposables', 'Wipes & Cleaning',
];
const RELATED_INDUSTRIES = [
  'Packaging', 'Agriculture', 'Filtration', 'Hygiene Convertor', 'Distribution',
];

// 评分因子权重（总和=100）
export const SCORING_FACTORS = [
  { key: 'product_match',   label: '产品匹配度',   max: 30, desc: '覆膜/纺粘无纺布相关度' },
  { key: 'country_match',   label: '目标市场匹配', max: 20, desc: '是否落在 11 个核心目标国' },
  { key: 'industry_fit',    label: '行业匹配度',   max: 15, desc: '卫生/医疗/擦拭/包装等下游' },
  { key: 'company_size',    label: '公司规模',     max: 12, desc: '采购量级代理指标' },
  { key: 'web_presence',    label: '网站存在',     max: 8,  desc: '有无官网（可核验/触达）' },
  { key: 'email_found',     label: '邮箱可发现',   max: 10, desc: '能否发现有效联系人邮箱' },
  { key: 'import_activity', label: '进口活跃度',   max: 5,  desc: '海关进口频次（仅海关来源）' },
] as const;

export interface ScoreBreakdownItem {
  key: string;
  label: string;
  points: number;
  max: number;
  detail: string;
}

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdownItem[];
  tier: 'A' | 'B' | 'C' | 'D';
}

function tierOf(score: number): ScoreResult['tier'] {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

/**
 * 规则化评分。discoveredEmails 可选——搜索阶段未做邮箱发现时传空数组，
 * email_found 因子记为 0；导入阶段已发现邮箱则据实给分。
 */
export function scoreLead(
  c: LeadCandidate,
  discoveredEmails: Array<{ status: string }> = [],
): ScoreResult {
  const b: ScoreBreakdownItem[] = [];

  // 产品匹配 (30)
  let productPts = 8;
  if (c.product_category === 'both') productPts = 30;
  else if (TARGET_PRODUCTS.includes(c.product_category)) productPts = 24;
  b.push({ key: 'product_match', label: '产品匹配度', points: productPts, max: 30,
    detail: `品类=${c.product_category}` });

  // 国家匹配 (20)
  const countryPts = TARGET_COUNTRIES.includes(c.country) ? 20 : 6;
  b.push({ key: 'country_match', label: '目标市场匹配', points: countryPts, max: 20,
    detail: TARGET_COUNTRIES.includes(c.country) ? `核心目标国：${c.country}` : `非核心：${c.country}` });

  // 行业匹配 (15)
  let industryPts = 4;
  if (CORE_INDUSTRIES.includes(c.industry)) industryPts = 15;
  else if (RELATED_INDUSTRIES.includes(c.industry)) industryPts = 10;
  b.push({ key: 'industry_fit', label: '行业匹配度', points: industryPts, max: 15,
    detail: `行业=${c.industry}` });

  // 公司规模 (12)
  const sizeMap: Record<string, number> = { enterprise: 12, large: 10, medium: 7, small: 4, '': 4 };
  const sizePts = sizeMap[c.company_size || ''] ?? 4;
  b.push({ key: 'company_size', label: '公司规模', points: sizePts, max: 12,
    detail: `规模=${c.company_size || '未知'}` });

  // 网站存在 (8)
  const webPts = c.website ? 8 : 0;
  b.push({ key: 'web_presence', label: '网站存在', points: webPts, max: 8,
    detail: c.website ? `官网=${c.website}` : '无官网' });

  // 邮箱可发现 (10)
  const emailPts = discoveredEmails.some((e) => e.status === 'verified' || e.status === 'guessed') ? 10 : 0;
  b.push({ key: 'email_found', label: '邮箱可发现', points: emailPts, max: 10,
    detail: discoveredEmails.length ? `已发现 ${discoveredEmails.length} 个邮箱` : '尚未发现邮箱' });

  // 进口活跃度 (5) — 仅海关来源
  const importPts = c.import_signals > 0 ? Math.round((c.import_signals / 100) * 5) : 0;
  b.push({ key: 'import_activity', label: '进口活跃度', points: importPts, max: 5,
    detail: c.import_signals > 0 ? `进口信号=${c.import_signals}` : '无海关信号' });

  const score = Math.min(100, b.reduce((s, x) => s + x.points, 0));
  return { score, breakdown: b, tier: tierOf(score) };
}

export function getScoringModel() {
  return {
    weights: SCORING_FACTORS,
    target_countries: TARGET_COUNTRIES,
    target_products: TARGET_PRODUCTS,
    tiers: { A: '≥80 优先攻坚', B: '65-79 重点跟进', C: '50-64 培育', D: '<50 低优先级' },
  };
}

// ============================================================
//  邮箱发现与验证
// ============================================================
export interface DiscoveredEmail {
  contact_name: string;
  title: string;
  email: string;
  pattern: string;
  status: 'verified' | 'guessed' | 'invalid';
  confidence: number;
}

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function domainOf(website: string | null): string | null {
  if (!website) return null;
  return website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
}

function slug(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
}

/**
 * 基于域名 + 姓名生成邮箱候选并校验。
 * 生产环境：status 应由 Hunter.io / Clearbit verify API 返回；
 * 无 API key 时进入「模拟验证」分支，按确定性哈希给出 verified/guessed/invalid，
 * 仅用于演示流程，不替代真实校验。
 */
export function discoverEmails(
  website: string | null,
  contacts: LeadContact[],
  opts?: { simulate?: boolean },
): DiscoveredEmail[] {
  const domain = domainOf(website);
  const simulate = opts?.simulate ?? true;
  const out: DiscoveredEmail[] = [];

  for (const ct of contacts) {
    const f = slug(ct.first_name);
    const l = slug(ct.last_name);
    if (!domain || !f || !l) continue;

    const candidates: Array<{ email: string; pattern: string; base: number }> = [
      { email: `${f}.${l}@${domain}`, pattern: 'first.last', base: 0.92 },
      { email: `${f[0]}${l}@${domain}`,  pattern: 'flast',      base: 0.74 },
      { email: `${f}${l}@${domain}`,      pattern: 'firstlast',  base: 0.66 },
    ];

    // 选最强且格式有效的模式
    const valid = candidates.find((c) => EMAIL_RE.test(c.email)) || candidates[0];

    let status: DiscoveredEmail['status'] = 'guessed';
    let confidence = valid.base;
    if (EMAIL_RE.test(valid.email)) {
      if (simulate) {
        // 确定性模拟：高管更可能验证通过，部分随机无效
        const h = hashStr(valid.email);
        if (ct.seniority === 'exec' && h % 5 !== 0) { status = 'verified'; confidence = Math.min(0.99, valid.base + 0.05); }
        else if (h % 7 === 0) { status = 'invalid'; confidence = 0; }
        else { status = 'guessed'; confidence = valid.base; }
      }
      // TODO(prod): const v = await fetch(`https://api.hunter.io/v2/email-verifier?email=${valid.email}&api_key=${ENV.HUNTER_API_KEY}`);
      //         status = v.data.result; // deliverable / undeliverable / unknown
    } else {
      status = 'invalid';
      confidence = 0;
    }

    out.push({
      contact_name: `${ct.first_name} ${ct.last_name}`,
      title: ct.title,
      email: valid.email,
      pattern: valid.pattern,
      status,
      confidence: Math.round(confidence * 100) / 100,
    });
  }
  return out;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ============================================================
//  增强导入（去重 + 评分 + 邮箱发现 + 建关联记录）
// ============================================================
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export interface ImportEnv {
  DB: D1Database;
  HUNTER_API_KEY?: string;
}

export async function importLeadsEnhanced(
  leads: LeadCandidate[],
  env: ImportEnv,
): Promise<{ imported: number; skipped: number; details: Array<Record<string, unknown>> }> {
  let imported = 0;
  let skipped = 0;
  const details: Array<Record<string, unknown>> = [];

  for (const lead of leads) {
    // 去重：公司名 + 国家
    const existing = await env.DB.prepare(
      'SELECT id FROM accounts WHERE company_name = ? AND country = ?',
    ).bind(lead.company_name, lead.country).first();

    if (existing) { skipped++; continue; }

    // 邮箱发现
    const emails = discoverEmails(lead.website, lead.contacts, {
      simulate: !env.HUNTER_API_KEY,
    });

    // 评分（用已发现邮箱）
    const score = scoreLead(lead, emails);

    const accountId = genId();
    await env.DB.prepare(
      `INSERT INTO accounts
        (id, company_name, country, country_code, website, industry, company_size,
         linkedin_url, description, source, source_ref, lead_score, status, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    ).bind(
      accountId, lead.company_name, lead.country, lead.country_code, lead.website,
      lead.industry, lead.company_size ?? null, lead.linkedin_url ?? null, lead.description ?? null,
      lead.source_type, lead.source_ref ?? null, score.score,
      `tier-${score.tier}`,
    ).run();

    // 联系人 + 邮箱
    for (const ct of lead.contacts) {
      const found = emails.find((e) => e.contact_name === `${ct.first_name} ${ct.last_name}`);
      await env.DB.prepare(
        `INSERT INTO contacts (id, account_id, first_name, last_name, full_name, title, email, email_status, email_verified, linkedin_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        genId(), accountId, ct.first_name, ct.last_name,
        `${ct.first_name} ${ct.last_name}`, ct.title,
        found?.email || null,
        found ? found.status : 'unknown',
        found?.status === 'verified' ? 1 : 0,
        lead.linkedin_url ?? null,
      ).run();
    }

    // 初始商机
    await env.DB.prepare(
      `INSERT INTO opportunities (id, account_id, stage_id, title, value, currency, product_category, hs_code)
       VALUES (?, ?, 'stage_new', ?, 0, 'USD', ?, ?)`,
    ).bind(
      genId(), accountId, `${lead.company_name} - 新发现线索`,
      lead.product_category, lead.hs_code,
    ).run();

    // 来源活动
    await env.DB.prepare(
      `INSERT INTO activities (id, account_id, type, subject, body)
       VALUES (?, ?, 'lead_discovered', ?, ?)`,
    ).bind(
      genId(), accountId,
      `来自${getSourceLabel(lead.source_type)}的线索`,
      JSON.stringify({ source_ref: lead.source_ref, score: score.score, tier: score.tier, emails: emails.length }),
    ).run();

    // 更新来源计数
    await env.DB.prepare(
      `UPDATE lead_sources SET total_leads = total_leads + 1, last_synced_at = datetime('now') WHERE type = ?`,
    ).bind(lead.source_type).run();

    imported++;
    details.push({
      company: lead.company_name, country: lead.country,
      score: score.score, tier: score.tier, emails: emails.length,
    });
  }

  return { imported, skipped, details };
}

// ============================================================
//  处理器 (供 index.ts 路由调用)
// ============================================================
export async function handleProspectingSearch(request: Request, env: ImportEnv): Promise<Response> {
  const body = await request.json() as { source: SourceType; filters?: SearchFilters };
  const source = body.source;
  if (!source || !CONNECTORS[source]) {
    return json({ error: '无效来源', valid: Object.keys(CONNECTORS) }, 400);
  }
  const raw = await CONNECTORS[source](body.filters || {});
  // 搜索阶段先做邮箱发现（用于评分 email_found 因子与预览），再评分排序
  const scored = raw.map((c) => {
    const emails = discoverEmails(c.website, c.contacts, { simulate: !env.HUNTER_API_KEY });
    const sc = scoreLead(c, emails);
    return { ...c, score: sc.score, tier: sc.tier, breakdown: sc.breakdown, emails };
  }).sort((a, b) => b.score - a.score);

  // 更新来源同步时间
  await env.DB.prepare(
    `UPDATE lead_sources SET last_synced_at = datetime('now') WHERE type = ?`,
  ).bind(source).run();

  return json({
    source, source_label: getSourceLabel(source), count: scored.length,
    leads: scored,
  });
}

export async function handleDiscoverEmails(request: Request): Promise<Response> {
  const body = await request.json() as { website: string | null; contacts: LeadContact[] };
  const emails = discoverEmails(body.website, body.contacts || [], { simulate: true });
  return json({ emails });
}

export async function handleScoringModel(): Promise<Response> {
  return json(getScoringModel());
}

// --- 复用 index.ts 的 json 助手（保持响应格式一致） ---
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    },
  });
}
