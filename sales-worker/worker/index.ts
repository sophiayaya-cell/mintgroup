/**
 * Mint Sales System - Cloudflare Worker API
 * 自主客户开发销售工作系统后端
 *
 * 路由结构:
 *   GET    /api/accounts            列表 (支持分页/筛选)
 *   POST   /api/accounts            创建
 *   GET    /api/accounts/:id        详情
 *   PUT    /api/accounts/:id        更新
 *   DELETE /api/accounts/:id        删除
 *   GET    /api/contacts            列表
 *   POST   /api/contacts            创建
 *   GET    /api/opportunities       商机列表
 *   POST   /api/opportunities       创建商机
 *   PUT    /api/opportunities/:id   移动阶段
 *   GET    /api/activities          活动列表
 *   POST   /api/activities          记录活动
 *   GET    /api/tasks              待办列表
 *   PUT    /api/tasks/:id           完成任务
 *   GET    /api/campaigns          序列列表
 *   POST   /api/campaigns          创建序列
 *   GET    /api/campaigns/:id/enroll  获取参与名单
 *   POST   /api/campaigns/:id/enroll  添加联系人到序列
 *   GET    /api/analytics/summary   仪表盘数据
 *   GET    /api/analytics/funnel     漏斗数据
 *   GET    /api/analytics/trends?days=30   时间趋势序列 (Phase 4)
 *   GET    /api/analytics/roi              序列 ROI 投入产出 (Phase 4)
 *   GET    /api/analytics/sources          线索来源归因 (Phase 4)
 *   GET    /api/lead-sources        线索来源列表
 *   POST   /api/leads/import        批量导入线索 (增强版: 去重+评分+邮箱发现)
 *   POST   /api/prospecting/search   线索自动获取 (按来源发现+评分)
 *   POST   /api/prospecting/discover-emails  邮箱发现与验证
 *   GET    /api/prospecting/scoring-model     评分模型
 *   POST   /api/webhooks/inquiry    网站询盘 webhook
 *
 *  Phase 3 外联自动化:
 *   GET    /api/campaigns/:id              序列详情(含步骤)
 *   PUT    /api/campaigns/:id              更新序列(元信息+步骤)
 *   POST   /api/campaigns/:id/activate     按筛选入组并激活
 *   GET    /api/campaigns/:id/analytics     追踪分析(发送/打开/点击/回复/退订+分步)
 *   POST   /api/campaigns/:id/preview       模板变量渲染预览
 *   POST   /api/campaigns/:id/send-now      立即发送到期步骤(测试/补发)
 *   GET    /api/tracking/open              打开追踪像素 (公开)
 *   GET    /api/tracking/click             点击追踪+跳转 (公开)
 *   GET|POST /api/unsubscribe              退订 (公开)
 *   POST   /api/webhooks/resend            Resend 入站回执 webhook (公开)
 *   POST   /api/tracking/reply            手动记录回执
 */

import {
  handleProspectingSearch,
  handleDiscoverEmails,
  handleScoringModel,
  importLeadsEnhanced,
  type ImportEnv,
  type LeadCandidate,
} from './prospecting';
import {
  sendDueSteps,
  enrollAndActivate,
  getCampaignAnalytics,
  recordOpen,
  recordClick,
  unsubscribe,
  recordReply,
  trackingPixel,
  processSendByEnrollment,
  type OutreachEnv,
} from './outreach';

export interface Env {
  DB: D1Database;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  EMAIL_FROM_NAME?: string;
  APP_BASE_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  SALES_API_KEY?: string;
  HUNTER_API_KEY?: string;
  STARTUPHUB_BASE_URL?: string;
  SEND_QUEUE?: {
    send(message: unknown): Promise<unknown>;
  };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 把 undefined 转为 null，避免 D1 / SQLite 拒绝 undefined 绑定（前端部分字段缺失时必现） */
function n(v: unknown): unknown {
  return v === undefined ? null : v;
}

// --- Auth middleware (简化版，复用 mintgroup-auth 模式) ---
async function authenticate(request: Request, env: Env): Promise<boolean> {
  // 方式 1：Bearer token（SESSION_SECRET 或 dev-token）
  const auth = request.headers.get('Authorization');
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    if (token === env.SESSION_SECRET || token === 'dev-token') return true;
  }
  // 方式 2：x-api-key（SALES_API_KEY，用于 analytics 只读接口 / 服务端调用）
  const apiKey = request.headers.get('x-api-key');
  if (apiKey && env.SALES_API_KEY && apiKey === env.SALES_API_KEY) return true;
  return false;
}

// --- Route handler ---
async function handleRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  const url = new URL(request.url);
  let path = url.pathname;
  const method = request.method;

  // 路由归一化：本 Worker 通过最具体匹配绑到 www.mint-gp.com/api/sales/*
  // （优先于 mintgroup-auth 的 /api/*），但请求 pathname 仍带 /api/sales 前缀。
  // 这里剥掉前缀，复用内部统一的 /api/* 路由，保持与本地 dev / 直接绑 /api/* 兼容。
  if (path.startsWith('/api/sales')) {
    path = path.replace('/api/sales', '/api');
  }

  // Public endpoints
  if (path === '/api/webhooks/inquiry' && method === 'POST') {
    return handleInquiryWebhook(request, env);
  }

  // --- Phase 3: 公开追踪 / 退订 / 回执端点 (邮件收件人触发，无鉴权) ---
  if (path === '/api/tracking/open' && method === 'GET') {
    const e = url.searchParams.get('e') || '';
    const s = url.searchParams.get('s') || '';
    const c = url.searchParams.get('c') || '';
    await recordOpen(env as OutreachEnv, e, s, c);
    return trackingPixel();
  }
  if (path === '/api/tracking/click' && method === 'GET') {
    const e = url.searchParams.get('e') || '';
    const s = url.searchParams.get('s') || '';
    const c = url.searchParams.get('c') || '';
    const target = url.searchParams.get('url') || '';
    return recordClick(env as OutreachEnv, e, s, c, target);
  }
  if (path === '/api/unsubscribe' && (method === 'GET' || method === 'POST')) {
    const e = url.searchParams.get('e') || null;
    const c = url.searchParams.get('c') || null;
    const em = url.searchParams.get('email') || null;
    await unsubscribe(env as OutreachEnv, e, c, em);
    if (method === 'GET') {
      return new Response(UNSUBSCRIBE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    return json({ unsubscribed: true });
  }
  if (path === '/api/webhooks/resend' && method === 'POST') {
    return handleResendWebhook(request, env);
  }
  if (path === '/api/tracking/reply' && method === 'POST') {
    return handleManualReply(request, env);
  }

  // 纯参考型只读端点：来源枚举，无敏感数据，公开便于健康检查/验证（无需鉴权 header）
  if (path === '/api/lead-sources' && method === 'GET') {
    return listLeadSources(env);
  }

  // Auth check for all other endpoints
  const authed = await authenticate(request, env);
  if (!authed) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // --- Accounts ---
  if (path === '/api/accounts' && method === 'GET') {
    return listAccounts(env, url);
  }
  if (path === '/api/accounts' && method === 'POST') {
    return createAccount(request, env);
  }
  const accountMatch = path.match(/^\/api\/accounts\/([\w-]+)$/);
  if (accountMatch) {
    const id = accountMatch[1];
    if (method === 'GET') return getAccount(env, id);
    if (method === 'PUT') return updateAccount(request, env, id);
    if (method === 'DELETE') return deleteAccount(env, id);
  }

  // --- Contacts ---
  if (path === '/api/contacts' && method === 'GET') {
    return listContacts(env, url);
  }
  if (path === '/api/contacts' && method === 'POST') {
    return createContact(request, env);
  }

  // --- Opportunities ---
  if (path === '/api/opportunities' && method === 'GET') {
    return listOpportunities(env, url);
  }
  if (path === '/api/opportunities' && method === 'POST') {
    return createOpportunity(request, env);
  }
  const oppMatch = path.match(/^\/api\/opportunities\/([\w-]+)$/);
  if (oppMatch && method === 'PUT') {
    return updateOpportunity(request, env, oppMatch[1]);
  }

  // --- Activities ---
  if (path === '/api/activities' && method === 'GET') {
    return listActivities(env, url);
  }
  if (path === '/api/activities' && method === 'POST') {
    return createActivity(request, env);
  }

  // --- Tasks ---
  if (path === '/api/tasks' && method === 'GET') {
    return listTasks(env, url);
  }
  const taskMatch = path.match(/^\/api\/tasks\/([\w-]+)$/);
  if (taskMatch && method === 'PUT') {
    return updateTask(request, env, taskMatch[1]);
  }

  // --- Campaigns ---
  if (path === '/api/campaigns' && method === 'GET') {
    return listCampaigns(env);
  }
  if (path === '/api/campaigns' && method === 'POST') {
    return createCampaign(request, env);
  }
  const enrollMatch = path.match(/^\/api\/campaigns\/([\w-]+)\/enroll$/);
  if (enrollMatch) {
    const campaignId = enrollMatch[1];
    if (method === 'GET') return listEnrollments(env, campaignId);
    if (method === 'POST') return enrollContact(request, env, campaignId);
  }

  // --- Phase 3: 外联自动化 路由 ---
  const campIdMatch = path.match(/^\/api\/campaigns\/([\w-]+)$/);
  if (campIdMatch) {
    const campaignId = campIdMatch[1];
    if (method === 'GET') return getCampaign(env, campaignId);
    if (method === 'PUT') return updateCampaign(request, env, campaignId);
  }
  const activateMatch = path.match(/^\/api\/campaigns\/([\w-]+)\/activate$/);
  if (activateMatch && method === 'POST') {
    return handleActivate(request, env, activateMatch[1]);
  }
  const analyticsMatch = path.match(/^\/api\/campaigns\/([\w-]+)\/analytics$/);
  if (analyticsMatch && method === 'GET') {
    return json(await getCampaignAnalytics(env as OutreachEnv, analyticsMatch[1]));
  }
  const previewMatch = path.match(/^\/api\/campaigns\/([\w-]+)\/preview$/);
  if (previewMatch && method === 'POST') {
    return handlePreview(request, env, previewMatch[1]);
  }
  const sendNowMatch = path.match(/^\/api\/campaigns\/([\w-]+)\/send-now$/);
  if (sendNowMatch && method === 'POST') {
    const r = await sendDueSteps(env as OutreachEnv);
    return json(r);
  }

  // --- Analytics ---
  if (path === '/api/analytics/summary' && method === 'GET') {
    return analyticsSummary(env);
  }
  if (path === '/api/analytics/funnel' && method === 'GET') {
    return analyticsFunnel(env);
  }
  // Phase 4: 数据分析增强
  if (path === '/api/analytics/trends' && method === 'GET') {
    return analyticsTrends(env, url);
  }
  if (path === '/api/analytics/roi' && method === 'GET') {
    return analyticsRoi(env);
  }
  if (path === '/api/analytics/sources' && method === 'GET') {
    return analyticsSources(env);
  }

  // --- Phase 2: 线索自动获取 ---
  if (path === '/api/prospecting/search' && method === 'POST') {
    return handleProspectingSearch(request, env as ImportEnv);
  }
  if (path === '/api/prospecting/discover-emails' && method === 'POST') {
    return handleDiscoverEmails(request);
  }
  if (path === '/api/prospecting/scoring-model' && method === 'GET') {
    return handleScoringModel();
  }

  // --- Leads Import (增强版) ---
  if (path === '/api/leads/import' && method === 'POST') {
    return handleEnhancedImport(request, env as ImportEnv);
  }

  return json({ error: 'Not found', path }, 404);
}

// ============================================================
//  ACCOUNTS
// ============================================================
async function listAccounts(env: Env, url: URL): Promise<Response> {
  const country = url.searchParams.get('country');
  const stage = url.searchParams.get('stage');
  const source = url.searchParams.get('source');
  const search = url.searchParams.get('q');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let sql = 'SELECT * FROM accounts WHERE 1=1';
  const params: string[] = [];

  if (country) { sql += ' AND country = ?'; params.push(country); }
  if (source) { sql += ' AND source = ?'; params.push(source); }
  if (search) { sql += ' AND (company_name LIKE ? OR id IN (SELECT account_id FROM contacts WHERE full_name LIKE ? OR email LIKE ?))'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  sql += ' ORDER BY lead_score DESC, created_at DESC LIMIT ? OFFSET ?';
  params.push(String(limit), String(offset));

  const result = await env.DB.prepare(sql).bind(...params).all();

  // 聚合每个账户的邮箱验证状态（来自 contacts.email_status），避免前端 N+1
  const ids = (result.results as Array<{ id: string }>).map((r) => r.id);
  let emailStats: Record<string, { verified: number; guessed: number; invalid: number; total: number }> = {};
  if (ids.length) {
    const stats = await env.DB.prepare(
      `SELECT account_id,
              SUM(CASE WHEN email_status='verified' THEN 1 ELSE 0 END) AS verified,
              SUM(CASE WHEN email_status='guessed' THEN 1 ELSE 0 END) AS guessed,
              SUM(CASE WHEN email_status='invalid' THEN 1 ELSE 0 END) AS invalid,
              COUNT(*) AS total
       FROM contacts WHERE account_id IN (${ids.map(() => '?').join(',')})
       GROUP BY account_id`,
    ).bind(...ids).all();
    for (const s of stats.results as Array<{ account_id: string; verified: unknown; guessed: unknown; invalid: unknown; total: unknown }>) {
      emailStats[s.account_id] = {
        verified: Number(s.verified) || 0,
        guessed: Number(s.guessed) || 0,
        invalid: Number(s.invalid) || 0,
        total: Number(s.total) || 0,
      };
    }
  }
  const data = (result.results as Array<{ id: string }>).map((r) => ({ ...r, email_stats: emailStats[r.id] || { verified: 0, guessed: 0, invalid: 0, total: 0 } }));

  return json({ data, count: data.length });
}

async function createAccount(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const id = genId();
  await env.DB.prepare(
    `INSERT INTO accounts (id, company_name, country, country_code, website, industry, company_size, linkedin_url, description, source, lead_score, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, n(body.company_name), n(body.country), n(body.country_code), n(body.website),
    n(body.industry), n(body.company_size), n(body.linkedin_url), n(body.description),
    body.source || 'manual', body.lead_score || 0, n(body.tags) as string || null
  ).run();
  return json({ id, ...body }, 201);
}

async function getAccount(env: Env, id: string): Promise<Response> {
  const account = await env.DB.prepare('SELECT * FROM accounts WHERE id = ?').bind(id).first();
  if (!account) return json({ error: 'Not found' }, 404);
  const contacts = await env.DB.prepare('SELECT * FROM contacts WHERE account_id = ?').bind(id).all();
  const activities = await env.DB.prepare('SELECT * FROM activities WHERE account_id = ? ORDER BY created_at DESC LIMIT 20').bind(id).all();
  const opportunities = await env.DB.prepare('SELECT * FROM opportunities WHERE account_id = ?').bind(id).all();
  const tasks = await env.DB.prepare('SELECT * FROM tasks WHERE account_id = ? AND status = ? ORDER BY due_date').bind(id, 'pending').all();
  return json({ ...account, contacts: contacts.results, activities: activities.results, opportunities: opportunities.results, tasks: tasks.results });
}

async function updateAccount(request: Request, env: Env, id: string): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const fields = ['company_name', 'country', 'country_code', 'website', 'industry', 'company_size', 'linkedin_url', 'description', 'lead_score', 'status', 'tags'];
  const updates: string[] = [];
  const params: unknown[] = [];
  fields.forEach(f => {
    if (body[f] !== undefined) { updates.push(`${f} = ?`); params.push(body[f]); }
  });
  if (updates.length === 0) return json({ id });
  updates.push(`updated_at = datetime('now')`);
  params.push(id);
  await env.DB.prepare(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
  return json({ id, ...body });
}

async function deleteAccount(env: Env, id: string): Promise<Response> {
  await env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(id).run();
  return json({ deleted: id });
}

// ============================================================
//  CONTACTS
// ============================================================
async function listContacts(env: Env, url: URL): Promise<Response> {
  const accountId = url.searchParams.get('account_id');
  let sql = 'SELECT c.*, a.company_name FROM contacts c LEFT JOIN accounts a ON c.account_id = a.id WHERE 1=1';
  const params: string[] = [];
  if (accountId) { sql += ' AND c.account_id = ?'; params.push(accountId); }
  sql += ' ORDER BY c.created_at DESC';
  const result = await env.DB.prepare(sql).bind(...params).all();
  return json({ data: result.results });
}

async function createContact(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const id = genId();
  await env.DB.prepare(
    `INSERT INTO contacts (id, account_id, first_name, last_name, full_name, title, email, phone, linkedin_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, n(body.account_id), n(body.first_name), n(body.last_name), n(body.full_name),
    n(body.title), n(body.email), n(body.phone), n(body.linkedin_url)
  ).run();
  return json({ id, ...body }, 201);
}

// ============================================================
//  OPPORTUNITIES
// ============================================================
async function listOpportunities(env: Env, url: URL): Promise<Response> {
  const stage = url.searchParams.get('stage');
  let sql = `SELECT o.*, a.company_name, a.country, a.country_code,
    c.full_name as contact_name, c.email as contact_email,
    s.name as stage_name, s.color as stage_color
    FROM opportunities o
    LEFT JOIN accounts a ON o.account_id = a.id
    LEFT JOIN contacts c ON o.primary_contact_id = c.id
    LEFT JOIN pipeline_stages s ON o.stage_id = s.id
    WHERE 1=1`;
  const params: string[] = [];
  if (stage) { sql += ' AND o.stage_id = ?'; params.push(stage); }
  sql += ' ORDER BY o.value DESC';
  const result = await env.DB.prepare(sql).bind(...params).all();
  return json({ data: result.results });
}

async function createOpportunity(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const id = genId();
  await env.DB.prepare(
    `INSERT INTO opportunities (id, account_id, primary_contact_id, stage_id, title, value, currency, product_category, hs_code, expected_close_date, probability)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, n(body.account_id), n(body.primary_contact_id), body.stage_id || 'stage_new',
    n(body.title), n(body.value), body.currency || 'USD', n(body.product_category),
    n(body.hs_code), n(body.expected_close_date), body.probability || 0
  ).run();
  return json({ id, ...body }, 201);
}

async function updateOpportunity(request: Request, env: Env, id: string): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  if (body.stage_id) {
    await env.DB.prepare('UPDATE opportunities SET stage_id = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(body.stage_id, id).run();
    // 记录活动
    await env.DB.prepare(
      `INSERT INTO activities (id, account_id, opportunity_id, type, subject, body)
       SELECT ?, account_id, ?, 'stage_change', ?, ? FROM opportunities WHERE id = ?`
    ).bind(genId(), id, `阶段变更为 ${body.stage_id}`, JSON.stringify(body), id).run();
  }
  return json({ id, ...body });
}

// ============================================================
//  ACTIVITIES
// ============================================================
async function listActivities(env: Env, url: URL): Promise<Response> {
  const accountId = url.searchParams.get('account_id');
  const limit = parseInt(url.searchParams.get('limit') || '30');
  let sql = `SELECT a.*, acc.company_name FROM activities a
    LEFT JOIN accounts acc ON a.account_id = acc.id WHERE 1=1`;
  const params: string[] = [];
  if (accountId) { sql += ' AND a.account_id = ?'; params.push(accountId); }
  sql += ' ORDER BY a.created_at DESC LIMIT ?';
  params.push(String(limit));
  const result = await env.DB.prepare(sql).bind(...params).all();
  return json({ data: result.results });
}

async function createActivity(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const id = genId();
  await env.DB.prepare(
    `INSERT INTO activities (id, account_id, contact_id, opportunity_id, type, subject, body, direction, scheduled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, n(body.account_id), n(body.contact_id), n(body.opportunity_id),
    n(body.type), n(body.subject), n(body.body), n(body.direction), n(body.scheduled_at)
  ).run();
  return json({ id, ...body }, 201);
}

// ============================================================
//  TASKS
// ============================================================
async function listTasks(env: Env, url: URL): Promise<Response> {
  const status = url.searchParams.get('status') || 'pending';
  const result = await env.DB.prepare(
    `SELECT t.*, a.company_name FROM tasks t
     LEFT JOIN accounts a ON t.account_id = a.id
     WHERE t.status = ? ORDER BY t.due_date`
  ).bind(status).all();
  return json({ data: result.results });
}

async function updateTask(request: Request, env: Env, id: string): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  if (body.status === 'completed') {
    await env.DB.prepare('UPDATE tasks SET status = ?, completed_at = datetime(\'now\') WHERE id = ?').bind('completed', id).run();
  }
  return json({ id, ...body });
}

// ============================================================
//  CAMPAIGNS
// ============================================================
async function listCampaigns(env: Env): Promise<Response> {
  const campaigns = await env.DB.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
  const steps = await env.DB.prepare('SELECT * FROM campaign_steps ORDER BY campaign_id, step_order').all();
  const data = campaigns.results.map((c: Record<string, unknown>) => ({
    ...c,
    steps: steps.results.filter((s: Record<string, unknown>) => s.campaign_id === c.id),
  }));
  return json({ data });
}

async function createCampaign(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const id = genId();
  await env.DB.prepare(
    `INSERT INTO campaigns (id, name, description, product_category, target_countries, status, cost)
     VALUES (?, ?, ?, ?, ?, 'draft', ?)`
  ).bind(id, body.name, body.description, body.product_category, body.target_countries, n(body.cost)).run();

  // 创建步骤
  const steps = body.steps as Array<Record<string, unknown>>;
  if (steps && Array.isArray(steps)) {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await env.DB.prepare(
        `INSERT INTO campaign_steps (id, campaign_id, step_order, type, subject, body, delay_days, send_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        genId(), id, i + 1, step.type || 'email',
        step.subject, step.body, step.delay_days || 0, step.send_time
      ).run();
    }
  }
  return json({ id, ...body }, 201);
}

async function listEnrollments(env: Env, campaignId: string): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT e.*, c.full_name, c.email, a.company_name, a.country
     FROM campaign_enrollments e
     LEFT JOIN contacts c ON e.contact_id = c.id
     LEFT JOIN accounts a ON e.account_id = a.id
     WHERE e.campaign_id = ?`
  ).bind(campaignId).all();
  return json({ data: result.results });
}

async function enrollContact(request: Request, env: Env, campaignId: string): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const id = genId();
  await env.DB.prepare(
    `INSERT INTO campaign_enrollments (id, campaign_id, contact_id, account_id, status)
     VALUES (?, ?, ?, ?, 'active')`
  ).bind(id, campaignId, body.contact_id, body.account_id).run();

  // 更新序列参与人数
  await env.DB.prepare(
    'UPDATE campaigns SET total_enrolled = total_enrolled + 1 WHERE id = ?'
  ).bind(campaignId).run();

  return json({ id, campaignId, ...body }, 201);
}

// ============================================================
//  ANALYTICS
// ============================================================
async function analyticsSummary(env: Env): Promise<Response> {
  const totalLeads = await env.DB.prepare('SELECT COUNT(*) as count FROM accounts').first();
  const activeOpps = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM opportunities
     WHERE stage_id NOT IN ('stage_won', 'stage_lost')`
  ).first();
  const pipelineValue = await env.DB.prepare(
    `SELECT COALESCE(SUM(value), 0) as total FROM opportunities
     WHERE stage_id NOT IN ('stage_won', 'stage_lost')`
  ).first();
  const wonValue = await env.DB.prepare(
    `SELECT COALESCE(SUM(value), 0) as total FROM opportunities WHERE stage_id = 'stage_won'`
  ).first();
  const totalEmails = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM email_events WHERE event_type = 'sent'`
  ).first();
  const totalReplies = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM email_events WHERE event_type = 'replied'`
  ).first();
  const pendingTasks = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'`
  ).first();

  return json({
    total_leads: totalLeads?.count || 0,
    active_opportunities: activeOpps?.count || 0,
    pipeline_value: pipelineValue?.total || 0,
    won_value: wonValue?.total || 0,
    emails_sent: totalEmails?.count || 0,
    emails_replied: totalReplies?.count || 0,
    reply_rate: totalEmails?.count > 0 ? ((totalReplies?.count / totalEmails?.count) * 100).toFixed(1) : '0',
    pending_tasks: pendingTasks?.count || 0,
  });
}

async function analyticsFunnel(env: Env): Promise<Response> {
  const stages = await env.DB.prepare('SELECT * FROM pipeline_stages ORDER BY display_order').all();
  const counts = await env.DB.prepare(
    `SELECT stage_id, COUNT(*) as count FROM opportunities GROUP BY stage_id`
  ).all();
  const countMap: Record<string, number> = {};
  counts.results.forEach((r: Record<string, unknown>) => {
    countMap[r.stage_id as string] = r.count as number;
  });
  return json({
    stages: stages.results.map((s: Record<string, unknown>) => ({
      ...s,
      count: countMap[s.id as string] || 0,
    }))
  });
}

// ============================================================
//  ANALYTICS — Phase 4 数据分析增强
//  时间趋势 / ROI / 来源归因
// ============================================================

/** GET /api/analytics/trends?days=30 — 按天聚合的活动时间序列 */
async function analyticsTrends(env: Env, url: URL): Promise<Response> {
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 365);
  // 截止日期(UTC)，与 SQLite datetime('now') 存储时区一致，做字符串比较
  const cutoff = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);

  // 各指标独立查询（避免 UNION ALL 过多触发 D1 "too many terms in compound SELECT"）
  const queries: Array<[string, string, string]> = [
    ['leads', `SELECT date(created_at) AS d, COUNT(*) AS c FROM accounts WHERE created_at >= ? GROUP BY d`, 'created_at'],
    ['sent', `SELECT date(occurred_at) AS d, COUNT(*) AS c FROM email_events WHERE event_type='sent' AND occurred_at >= ? GROUP BY d`, 'occurred_at'],
    ['opened', `SELECT date(occurred_at) AS d, COUNT(*) AS c FROM email_events WHERE event_type='opened' AND occurred_at >= ? GROUP BY d`, 'occurred_at'],
    ['clicked', `SELECT date(occurred_at) AS d, COUNT(*) AS c FROM email_events WHERE event_type='clicked' AND occurred_at >= ? GROUP BY d`, 'occurred_at'],
    ['replied', `SELECT date(occurred_at) AS d, COUNT(*) AS c FROM email_events WHERE event_type='replied' AND occurred_at >= ? GROUP BY d`, 'occurred_at'],
    ['unsubscribed', `SELECT date(occurred_at) AS d, COUNT(*) AS c FROM email_events WHERE event_type='unsubscribed' AND occurred_at >= ? GROUP BY d`, 'occurred_at'],
    ['opps', `SELECT date(created_at) AS d, COUNT(*) AS c FROM opportunities WHERE created_at >= ? GROUP BY d`, 'created_at'],
    ['won', `SELECT date(created_at) AS d, COUNT(*) AS c FROM opportunities WHERE stage_id='stage_won' AND created_at >= ? GROUP BY d`, 'created_at'],
  ];

  const metrics = ['leads', 'sent', 'opened', 'clicked', 'replied', 'unsubscribed', 'opps', 'won'] as const;
  const map: Record<string, Record<string, number>> = {};
  // 补全完整日期范围（含无活动日，前端折线图才连续）
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
    map[d] = Object.fromEntries(metrics.map((m) => [m, 0]));
  }

  for (const [metric, sql] of queries) {
    const res = await env.DB.prepare(sql).bind(cutoff).all();
    for (const r of res.results as Array<{ d?: string; c?: number }>) {
      if (r.d && map[r.d]) map[r.d][metric] = r.c as number;
    }
  }

  const series = Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, ...vals }));

  return json({ days, cutoff, series });
}

/** GET /api/analytics/roi — 逐序列投入产出比（任意触点归因） */
async function analyticsRoi(env: Env): Promise<Response> {
  const campaigns = await env.DB.prepare(
    'SELECT id, name, status, cost, total_enrolled, created_at FROM campaigns ORDER BY created_at DESC'
  ).all();
  // 每序列各事件计数
  const ev = await env.DB.prepare(
    `SELECT en.campaign_id, e.event_type, COUNT(*) AS c
     FROM email_events e JOIN campaign_enrollments en ON e.enrollment_id = en.id
     GROUP BY en.campaign_id, e.event_type`
  ).all();
  // 每序列归因成交（任意触点：该序列入组账号产生的 won 商机）
  const won = await env.DB.prepare(
    `SELECT en.campaign_id, COUNT(DISTINCT o.id) AS won_count, COALESCE(SUM(o.value), 0) AS won_value
     FROM campaign_enrollments en JOIN opportunities o ON en.account_id = o.account_id
     WHERE o.stage_id = 'stage_won'
     GROUP BY en.campaign_id`
  ).all();

  const evMap: Record<string, Record<string, number>> = {};
  for (const r of ev.results as Array<{ campaign_id: string; event_type: string; c: number }>) {
    (evMap[r.campaign_id] ??= {})[r.event_type] = r.c;
  }
  const wonMap: Record<string, { won_count: number; won_value: number }> = {};
  for (const r of won.results as Array<{ campaign_id: string; won_count: number; won_value: number }>) {
    wonMap[r.campaign_id] = { won_count: r.won_count, won_value: r.won_value };
  }

  const data = (campaigns.results as Array<Record<string, unknown>>).map((c) => {
    const id = c.id as string;
    const e = evMap[id] || {};
    const sent = e.sent || 0;
    const opened = e.opened || 0;
    const clicked = e.clicked || 0;
    const replied = e.replied || 0;
    const w = wonMap[id] || { won_count: 0, won_value: 0 };
    const cost = (c.cost as number) || 0;
    const wonValue = w.won_value || 0;
    return {
      id,
      name: c.name,
      status: c.status,
      cost,
      enrolled: (c.total_enrolled as number) || 0,
      sent,
      opened,
      clicked,
      replied,
      open_rate: sent > 0 ? +((opened / sent) * 100).toFixed(1) : 0,
      reply_rate: sent > 0 ? +((replied / sent) * 100).toFixed(1) : 0,
      won_count: w.won_count || 0,
      won_value: wonValue,
      roi: cost > 0 ? +(wonValue / cost).toFixed(2) : null,
      profit: +(wonValue - cost).toFixed(2),
    };
  });

  const totals = data.reduce(
    (acc, d) => ({
      cost: acc.cost + d.cost,
      sent: acc.sent + d.sent,
      opened: acc.opened + d.opened,
      replied: acc.replied + d.replied,
      won_count: acc.won_count + d.won_count,
      won_value: acc.won_value + d.won_value,
    }),
    { cost: 0, sent: 0, opened: 0, replied: 0, won_count: 0, won_value: 0 }
  );
  const totalsOut = {
    ...totals,
    open_rate: totals.sent > 0 ? +((totals.opened / totals.sent) * 100).toFixed(1) : 0,
    reply_rate: totals.sent > 0 ? +((totals.replied / totals.sent) * 100).toFixed(1) : 0,
    roi: totals.cost > 0 ? +(totals.won_value / totals.cost).toFixed(2) : null,
    profit: +(totals.won_value - totals.cost).toFixed(2),
  };

  return json({ attribution: 'any-touch', note: 'won 归因于该序列入组账号产生的成交；同一账号入组多个序列会被各计一次', data, totals: totalsOut });
}

/** GET /api/analytics/sources — 线索来源归因（每来源的转化漏斗） */
async function analyticsSources(env: Env): Promise<Response> {
  const src = await env.DB.prepare(
    `SELECT COALESCE(source, 'unknown') AS source, COUNT(*) AS total, COALESCE(AVG(lead_score), 0) AS avg_score
     FROM accounts GROUP BY source ORDER BY total DESC`
  ).all();
  const rep = await env.DB.prepare(
    `SELECT COALESCE(a.source, 'unknown') AS source, COUNT(DISTINCT a.id) AS replied
     FROM accounts a JOIN contacts c ON c.account_id = a.id
     JOIN email_events e ON e.contact_id = c.id
     WHERE e.event_type = 'replied'
     GROUP BY COALESCE(a.source, 'unknown')`
  ).all();
  const won = await env.DB.prepare(
    `SELECT COALESCE(a.source, 'unknown') AS source, COUNT(DISTINCT o.id) AS won_count, COALESCE(SUM(o.value), 0) AS won_value
     FROM accounts a JOIN opportunities o ON o.account_id = a.id
     WHERE o.stage_id = 'stage_won'
     GROUP BY COALESCE(a.source, 'unknown')`
  ).all();

  const repMap: Record<string, number> = {};
  for (const r of rep.results as Array<{ source: string; replied: number }>) repMap[r.source] = r.replied;
  const wonMap: Record<string, { won_count: number; won_value: number }> = {};
  for (const r of won.results as Array<{ source: string; won_count: number; won_value: number }>) {
    wonMap[r.source] = { won_count: r.won_count, won_value: r.won_value };
  }

  const data = (src.results as Array<{ source: string; total: number; avg_score: number }>).map((r) => {
    const total = r.total || 0;
    const replied = repMap[r.source] || 0;
    const w = wonMap[r.source] || { won_count: 0, won_value: 0 };
    return {
      source: r.source,
      total,
      avg_score: +(r.avg_score || 0).toFixed(1),
      replied,
      reply_rate: total > 0 ? +((replied / total) * 100).toFixed(1) : 0,
      won_count: w.won_count || 0,
      won_value: w.won_value || 0,
      conversion_rate: total > 0 ? +((w.won_count / total) * 100).toFixed(1) : 0,
    };
  });

  return json({ data });
}

// ============================================================
//  LEAD SOURCES & IMPORT
// ============================================================
async function listLeadSources(env: Env): Promise<Response> {
  const result = await env.DB.prepare('SELECT * FROM lead_sources ORDER BY name').all();
  return json({ data: result.results });
}

async function handleEnhancedImport(request: Request, env: ImportEnv): Promise<Response> {
  const body = await request.json() as { leads: Array<Record<string, unknown>> };
  // importLeadsEnhanced 期望 LeadCandidate[] 结构（与 /api/prospecting/search 返回一致）
  const result = await importLeadsEnhanced(body.leads as LeadCandidate[], env);
  return json({
    imported: result.imported,
    skipped: result.skipped,
    total: body.leads.length,
    details: result.details,
  });
}

// ============================================================
//  WEBHOOK: 网站询盘
// ============================================================
async function handleInquiryWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;

  // 从网站询盘表单创建线索
  const accountId = genId();
  await env.DB.prepare(
    `INSERT INTO accounts (id, company_name, country, website, source, lead_score, status)
     VALUES (?, ?, ?, ?, 'website', 60, 'active')`
  ).bind(
    accountId,
    body.company || body.name || 'Unknown',
    body.country || null,
    body.website || null
  ).run();

  // 创建联系人
  if (body.email || body.name) {
    await env.DB.prepare(
      `INSERT INTO contacts (id, account_id, full_name, email, phone)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(genId(), accountId, body.name, body.email, body.phone).run();
  }

  // 创建商机
  await env.DB.prepare(
    `INSERT INTO opportunities (id, account_id, stage_id, title, product_category)
     VALUES (?, ?, 'stage_new', ?, ?)`
  ).bind(genId(), accountId, `Website inquiry - ${body.product || 'General'}`, body.product).run();

  // 记录活动
  await env.DB.prepare(
    `INSERT INTO activities (id, account_id, type, subject, body)
     VALUES (?, ?, 'inquiry', 'New website inquiry', ?)`
  ).bind(genId(), accountId, JSON.stringify(body)).run();

  return json({ received: true, account_id: accountId }, 201);
}

// --- Scheduled handler (Cron: 每小时检查并发送到期邮件序列步骤) ---
async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
  await sendDueSteps(env as OutreachEnv);
}

// --- Queue handler (可选: 异步批量发送) ---
async function handleQueue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
  for (const msg of batch.messages) {
    const data = msg.body as { type?: string; enrollmentId?: string };
    if (data?.type === 'send_step' && data.enrollmentId) {
      try {
        const ok = await processSendByEnrollment(env as OutreachEnv, data.enrollmentId);
        if (ok) {
          msg.ack();
        } else {
          // 无可发步骤：丢弃该消息
          msg.ack();
        }
      } catch {
        // 发送失败：将 next_step_at 复位为现在，让下次重试（不 ack，等待重投）
        await env.DB.prepare(
          `UPDATE campaign_enrollments SET next_step_at = datetime('now') WHERE id = ?`
        ).bind(data.enrollmentId).run();
        msg.retry();
      }
    } else {
      msg.ack();
    }
  }
}

// ============================================================
//  PHASE 3 HELPERS
// ============================================================
function trackingPixelExport(_env: OutreachEnv): Response {
  return trackingPixel();
}

const UNSUBSCRIBE_HTML = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>退订成功</title>
<style>body{font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;background:#f5f5f4;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#fff;border:1px solid #e7e5e4;border-radius:10px;padding:40px 48px;text-align:center;max-width:380px}
.check{width:56px;height:56px;border-radius:50%;background:#E1F5EE;color:#1D9E75;font-size:30px;display:flex;align-items:center;justify-content:center;margin:0 auto 18px}
h1{font-size:19px;margin:0 0 8px;color:#1c1917}h2{font-size:14px;font-weight:400;color:#78716c;margin:0;line-height:1.6}</style></head>
<body><div class="card"><div class="check">✓</div><h1>您已成功退订</h1>
<h2>我们将不再向您发送营销邮件。<br>如需重新订阅，请联系 sales@mint-gp.com。</h2></div></body></html>`;

async function getCampaign(env: Env, campaignId: string): Promise<Response> {
  const c = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ?').bind(campaignId).first();
  if (!c) return json({ error: 'Not found' }, 404);
  const steps = await env.DB.prepare(
    'SELECT * FROM campaign_steps WHERE campaign_id = ? ORDER BY step_order'
  ).bind(campaignId).all();
  const enroll = await env.DB.prepare(
    'SELECT COUNT(*) AS c FROM campaign_enrollments WHERE campaign_id = ?'
  ).bind(campaignId).first();
  const analytics = await getCampaignAnalytics(env as OutreachEnv, campaignId);
  return json({ ...c, steps: steps.results, enrolled: (enroll as { c: number }).c, analytics });
}

async function updateCampaign(request: Request, env: Env, campaignId: string): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  // 更新元信息
  const metaFields = ['name', 'description', 'product_category', 'target_countries', 'status', 'cost'];
  const updates: string[] = [];
  const params: unknown[] = [];
  metaFields.forEach(f => {
    if (body[f] !== undefined) { updates.push(`${f} = ?`); params.push(body[f]); }
  });
  if (updates.length) {
    updates.push(`updated_at = datetime('now')`);
    params.push(campaignId);
    await env.DB.prepare(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
  }
  // 替换步骤
  if (body.steps && Array.isArray(body.steps)) {
    await env.DB.prepare('DELETE FROM campaign_steps WHERE campaign_id = ?').bind(campaignId).run();
    for (let i = 0; i < (body.steps as Array<Record<string, unknown>>).length; i++) {
      const step = (body.steps as Array<Record<string, unknown>>)[i];
      await env.DB.prepare(
        `INSERT INTO campaign_steps (id, campaign_id, step_order, type, subject, body, delay_days, send_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        genId(), campaignId, i + 1, step.type || 'email',
        step.subject, step.body, step.delay_days || 0, step.send_time
      ).run();
    }
  }
  return json({ id: campaignId, ...body });
}

async function handleActivate(request: Request, env: Env, campaignId: string): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const result = await enrollAndActivate(env as OutreachEnv, campaignId, {
    product_category: body.product_category as string,
    countries: body.countries as string[],
    min_score: body.min_score as number,
    contact_ids: body.contact_ids as string[],
  });
  // 触发一次立即发送
  const sent = await sendDueSteps(env as OutreachEnv);
  return json({ ...result, sent_now: sent });
}

async function handlePreview(request: Request, env: Env, campaignId: string): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const stepOrder = Number(body.step_order) || 1;
  const step = await env.DB.prepare(
    'SELECT * FROM campaign_steps WHERE campaign_id = ? AND step_order = ?'
  ).bind(campaignId, stepOrder).first() as Record<string, unknown> | null;
  if (!step) return json({ error: 'Step not found' }, 404);

  // 用户提供的上下文或样例上下文
  let ctx: Record<string, string> = (body.context as Record<string, string>) || {};
  if (Object.keys(ctx).length === 0) {
    const sample = await env.DB.prepare(
      `SELECT c.*, a.company_name, a.country, a.industry, a.lead_score
       FROM campaign_enrollments e JOIN contacts c ON e.contact_id = c.id JOIN accounts a ON c.account_id = a.id
       WHERE e.campaign_id = ? LIMIT 1`
    ).bind(campaignId).first() as Record<string, unknown> | null;
    if (sample) ctx = buildContextJS(sample, sample);
  }
  const subject = renderTemplateJS(step.subject as string, ctx);
  const bodyHtml = renderTemplateJS(step.body as string, ctx);
  return json({ step_order: stepOrder, subject, body: bodyHtml, context: ctx });
}

function buildContextJS(account: Record<string, unknown>, contact: Record<string, unknown>): Record<string, string> {
  const fullName = (contact.full_name as string) || `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
  return {
    first_name: (contact.first_name as string) || '',
    last_name: (contact.last_name as string) || '',
    full_name: fullName,
    company: (account.company_name as string) || '',
    company_name: (account.company_name as string) || '',
    country: (account.country as string) || '',
    industry: (account.industry as string) || '',
    product: (account.industry as string) || '',
    product_category: (account.industry as string) || '',
    hs_code: '5603.93',
    website: (account.website as string) || '',
    owner: 'Mint Sales',
    sender_name: 'Mint Sales Team',
    sender_company: 'Zibo Mint Hygiene',
  };
}

function renderTemplateJS(template: string, ctx: Record<string, string>): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([\w]+)\s*(?:\|\s*([^}]+?))?\s*\}\}/g,
    (_m, key: string, fallback?: string) => {
      const val = ctx[key];
      if (val !== undefined && val !== null && String(val).trim() !== '') return String(val);
      if (fallback !== undefined && fallback.trim() !== '') return fallback.trim();
      return '';
    });
}

async function handleResendWebhook(request: Request, env: Env): Promise<Response> {
  // Resend inbound: payload 形如 { from, subject, text, html, to, ... }
  let payload: Record<string, unknown>;
  try {
    payload = await request.json() as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  // 兼容数组批量与单条
  const items = Array.isArray(payload) ? (payload as Array<Record<string, unknown>>) : [payload];
  let matched = 0;
  for (const item of items) {
    const from = extractEmail(item.from as string);
    if (!from) continue;
    const r = await recordReply(env as OutreachEnv, from, item.subject as string, item.text as string);
    if (r.matched) matched++;
  }
  return json({ received: true, matched });
}

function extractEmail(s?: string): string | null {
  if (!s) return null;
  const m = s.match(/<([^>]+)>/) || s.match(/([\w.+-]+@[\w.-]+\.\w+)/);
  return m ? m[1] : null;
}

async function handleManualReply(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const email = body.email as string;
  if (!email) return json({ error: 'email required' }, 400);
  const r = await recordReply(env as OutreachEnv, email, body.subject as string, body.text as string);
  return json(r);
}

// --- Export ---
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return json({ error: msg }, 500);
    }
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(event, env));
  },
  async queue(batch: MessageBatch<unknown>, env: Env, _ctx: ExecutionContext): Promise<void> {
    await handleQueue(batch, env);
  },
};
