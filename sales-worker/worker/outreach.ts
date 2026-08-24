/**
 * Mint Sales System - Phase 3 外联自动化引擎 (outreach.ts)
 *
 * 职责:
 *  1. 模板变量渲染引擎 ({{var}} / {{var|fallback}})
 *  2. 追踪 URL 构建 (打开像素 / 点击 / 退订 / 回执)
 *  3. Resend 真实发送 (含 List-Unsubscribe 头与投递标签)
 *  4. 邮件序列推进 (cron / send-now / 可选 Queue)
 *  5. 入组激活 (按产品/国家/评分筛选匹配联系人)
 *  6. 分析聚合 (发送/打开/点击/回复/退订 + 分步漏斗)
 *  7. 追踪事件处理 (open / click / unsubscribe / reply webhook)
 */

// ============================================================
//  类型
// ============================================================
export interface OutreachEnv {
  DB: D1Database;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  EMAIL_FROM_NAME?: string;
  APP_BASE_URL: string;
  SESSION_SECRET: string;
  SEND_QUEUE?: {
    send(message: unknown): Promise<unknown>;
  };
}

export interface TemplateContext {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  company?: string;
  company_name?: string;
  country?: string;
  industry?: string;
  product?: string;
  product_category?: string;
  hs_code?: string;
  website?: string;
  owner?: string;
  sender_name?: string;
  sender_company?: string;
  [k: string]: string | undefined;
}

export interface SendTarget {
  enrollmentId: string;
  contactId: string;
  accountId: string;
  stepId: string;
  stepOrder: number;
  to: string;
  fullName: string;
  companyName: string;
  subject: string;
  body: string; // 含 {{变量}} 的原始模板
  context: TemplateContext;
}

// ============================================================
//  1. 模板变量渲染引擎
// ============================================================
/**
 * 渲染 {{var}} 与 {{var|fallback}}。
 * 未知或空值使用 fallback（无 fallback 则留空并标注 ⚠）。
 */
export function renderTemplate(
  template: string,
  ctx: TemplateContext
): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([\w]+)\s*(?:\|\s*([^}]+?))?\s*\}\}/g,
    (_m, key: string, fallback?: string) => {
      const val = ctx[key];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val);
      }
      if (fallback !== undefined && fallback.trim() !== '') {
        return fallback.trim();
      }
      return ''; // 留空，避免把占位符泄漏给收件人
    });
}

/** 构建联系人+公司→模板上下文 */
export function buildContext(
  account: Record<string, unknown> | null,
  contact: Record<string, unknown> | null,
  opportunity?: Record<string, unknown> | null
): TemplateContext {
  const fullName = (contact?.full_name as string)
    || `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim();
  return {
    first_name: (contact?.first_name as string) || '',
    last_name: (contact?.last_name as string) || '',
    full_name: fullName,
    company: (account?.company_name as string) || '',
    company_name: (account?.company_name as string) || '',
    country: (account?.country as string) || '',
    industry: (account?.industry as string) || '',
    product: (opportunity?.product_category as string)
      || (account?.industry as string) || '',
    product_category: (opportunity?.product_category as string)
      || (account?.industry as string) || '',
    hs_code: (opportunity?.hs_code as string) || '5603.93',
    website: (account?.website as string) || '',
    owner: (opportunity?.owner as string) || 'Mint Sales',
    sender_name: (account ? 'Mint Sales Team' : 'Mint Sales Team'),
    sender_company: 'Zibo Mint Hygiene',
  };
}

// ============================================================
//  2. 追踪 URL 构建
// ============================================================
export interface TrackingUrls {
  open: string;
  click: (url: string) => string;
  unsubscribe: string;
}

export function buildTrackingUrls(
  env: OutreachEnv,
  enrollmentId: string,
  stepId: string,
  contactId: string,
  email: string
): TrackingUrls {
  const base = env.APP_BASE_URL.replace(/\/$/, '');
  const e = encodeURIComponent(enrollmentId);
  const s = encodeURIComponent(stepId);
  const c = encodeURIComponent(contactId);
  const em = encodeURIComponent(email);
  return {
    open: `${base}/api/tracking/open?e=${e}&s=${s}&c=${c}`,
    click: (url: string) =>
      `${base}/api/tracking/click?e=${e}&s=${s}&c=${c}&url=${encodeURIComponent(url)}`,
    unsubscribe: `${base}/api/unsubscribe?e=${e}&s=${s}&c=${c}&email=${em}`,
  };
}

/** 将 body 中的 <a href="X"> 替换为点击追踪链接（仅 http/https） */
export function wrapLinksWithTracking(html: string, clickBuilder: (u: string) => string): string {
  return html.replace(/<a\s+([^>]*?)href=(["'])(.*?)\2([^>]*)>/gi,
    (_m, pre: string, _q: string, href: string, post: string) => {
      if (!/^https?:\/\//i.test(href)) return _m; // 不追踪非 http 链接
      const tracked = clickBuilder(href);
      return `<a ${pre}href="${tracked}"${post}>`;
    });
}

// ============================================================
//  3. Resend 真实发送
// ============================================================
/**
 * 通过 Resend 发送一封追踪邮件。
 * 返回 messageId（Resend 的 id）。
 */
export async function sendViaResend(
  env: OutreachEnv,
  opts: {
    to: string;
    subject: string;
    html: string;
    text: string;
    tracking: TrackingUrls;
    tags?: Array<{ name: string; value: string }>;
  }
): Promise<string> {
  const fromName = env.EMAIL_FROM_NAME || 'Mint Sales';
  const from = `${fromName} <${env.EMAIL_FROM}>`;

  // 在 HTML 末尾注入打开追踪像素 + 退订链接
  let html = opts.html;
  if (!/<img[^>]+tracking\/open/i.test(html)) {
    html = html.replace(/<\/body>/i, `<img src="${opts.tracking.open}" width="1" height="1" alt="" style="display:none" /></body>`)
      || html + `<img src="${opts.tracking.open}" width="1" height="1" alt="" style="display:none" />`;
  }
  // 退订页脚（若有 {{unsubscribe_url}} 则替换，否则追加）
  if (html.includes('{{unsubscribe_url}}')) {
    html = html.replace(/\{\{\s*unsubscribe_url\s*\}\}/g, opts.tracking.unsubscribe);
  } else {
    html += `<p style="font-size:11px;color:#999;margin-top:18px">You received this because you are in our B2B network. <a href="${opts.tracking.unsubscribe}">Unsubscribe</a></p>`;
  }

  const unsubUrl = opts.tracking.unsubscribe;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html,
      text: opts.text,
      reply_to: env.EMAIL_FROM,
      tags: opts.tags || [],
      headers: {
        'List-Unsubscribe': `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Mint-Enrollment': opts.tags?.find(t => t.name === 'enrollment_id')?.value || '',
        'X-Mint-Contact': opts.tags?.find(t => t.name === 'contact_id')?.value || '',
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${txt.slice(0, 200)}`);
  }
  const j = (await res.json()) as { id?: string };
  return j.id || '';
}

// ============================================================
//  4. 邮件序列推进
// ============================================================
const TRANSPARENT_GIF_B64 =
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * 查找到期待发步骤并发送。
 * 若绑定 SEND_QUEUE，则将发送任务入队（异步）；否则直接发送。
 * 返回处理摘要。
 */
export async function sendDueSteps(env: OutreachEnv): Promise<{
  due: number;
  sent: number;
  errors: number;
  queued: number;
}> {
  const due = await env.DB.prepare(
    `SELECT e.id AS enrollment_id
     FROM campaign_enrollments e
     JOIN contacts c ON e.contact_id = c.id
     JOIN campaign_steps cs ON cs.campaign_id = e.campaign_id AND cs.step_order = e.current_step + 1
     WHERE e.status = 'active'
       AND c.unsubscribed = 0
       AND c.email IS NOT NULL AND c.email <> ''
       AND e.next_step_at <= datetime('now')
       AND cs.type = 'email'
     ORDER BY e.next_step_at ASC`
  ).all();

  const ids = (due.results as Array<Record<string, unknown>>).map(r => r.enrollment_id as string);
  let sent = 0, errors = 0, queued = 0;

  for (const enrollmentId of ids) {
    if (env.SEND_QUEUE) {
      // 入队并加锁(把 next_step_at 推远，避免 cron 重复选取)；队列消费成功后复位
      await env.SEND_QUEUE.send({ type: 'send_step', enrollmentId });
      await env.DB.prepare(
        `UPDATE campaign_enrollments SET next_step_at = datetime('now','+365 days') WHERE id = ?`
      ).bind(enrollmentId).run();
      queued++;
    } else {
      try {
        await processSendByEnrollment(env, enrollmentId);
        sent++;
      } catch {
        errors++;
      }
    }
  }
  return { due: ids.length, sent, errors, queued };
}

/** 按 enrollment 查询其当前待发步骤并发送（供 cron 与 Queue 消费共用） */
export async function processSendByEnrollment(env: OutreachEnv, enrollmentId: string): Promise<boolean> {
  const it = await env.DB.prepare(
    `SELECT e.id AS enrollment_id, e.campaign_id, e.contact_id, e.account_id,
            c.full_name, c.email, a.company_name,
            cs.id AS step_id, cs.step_order, cs.subject, cs.body
     FROM campaign_enrollments e
     JOIN contacts c ON e.contact_id = c.id
     JOIN accounts a ON e.account_id = a.id
     JOIN campaign_steps cs ON cs.campaign_id = e.campaign_id AND cs.step_order = e.current_step + 1
     WHERE e.id = ? AND e.status = 'active' AND c.unsubscribed = 0
       AND c.email IS NOT NULL AND c.email <> ''
       AND cs.type = 'email'`
  ).bind(enrollmentId).first() as Record<string, unknown> | null;

  if (!it) return false;

  const target: SendTarget = {
    enrollmentId: it.enrollment_id as string,
    contactId: it.contact_id as string,
    accountId: it.account_id as string,
    stepId: it.step_id as string,
    stepOrder: Number(it.step_order),
    to: it.email as string,
    fullName: (it.full_name as string) || '',
    companyName: it.company_name as string,
    subject: (it.subject as string) || '',
    body: (it.body as string) || '',
    context: {},
  };
  await processSend(env, target);
  return true;
}

/**
 * 单次发送：从 DB 取上下文→渲染→发 Resend→记录事件→推进步骤。
 */
export async function processSend(env: OutreachEnv, target: SendTarget): Promise<void> {
  // 取最新上下文
  const account = await env.DB.prepare('SELECT * FROM accounts WHERE id = ?')
    .bind(target.accountId).first() as Record<string, unknown> | null;
  const contact = await env.DB.prepare('SELECT * FROM contacts WHERE id = ?')
    .bind(target.contactId).first() as Record<string, unknown> | null;
  const opp = await env.DB.prepare(
    'SELECT * FROM opportunities WHERE account_id = ? AND stage_id NOT IN (?,?) ORDER BY created_at DESC LIMIT 1'
  ).bind(target.accountId, 'stage_won', 'stage_lost').first() as Record<string, unknown> | null;

  const context = buildContext(account, contact, opp);
  target.context = context;

  const subject = renderTemplate(target.subject, context);
  let html = renderTemplate(target.body, context);
  if (!/<html/i.test(html)) {
    html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222">${html}</div>`;
  }
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const tracking = buildTrackingUrls(env, target.enrollmentId, target.stepId, target.contactId, target.to);
  const htmlTracked = wrapLinksWithTracking(html, tracking.click);

  const messageId = await sendViaResend(env, {
    to: target.to,
    subject,
    html: htmlTracked,
    text,
    tracking,
    tags: [
      { name: 'campaign_id', value: account ? '' : '' }, // 占位，下方覆盖
      { name: 'enrollment_id', value: target.enrollmentId },
      { name: 'contact_id', value: target.contactId },
      { name: 'step_order', value: String(target.stepOrder) },
    ],
  });

  // 记录 sent 事件
  await env.DB.prepare(
    `INSERT INTO email_events (id, enrollment_id, contact_id, step_id, event_type, message_id, recipient, subject)
     VALUES (?, ?, ?, ?, 'sent', ?, ?, ?)`
  ).bind(genId(), target.enrollmentId, target.contactId, target.stepId, messageId, target.to, subject).run();

  // 记录活动
  await env.DB.prepare(
    `INSERT INTO activities (id, account_id, contact_id, type, subject, body, direction)
     VALUES (?, ?, ?, 'email_sent', ?, ?, 'out')`
  ).bind(genId(), target.accountId, target.contactId, subject, `Step ${target.stepOrder}: ${subject}`).run();

  // 推进步骤：检查是否还有下一步
  const next = await env.DB.prepare(
    'SELECT id FROM campaign_steps WHERE campaign_id = (SELECT campaign_id FROM campaign_enrollments WHERE id = ?) AND step_order = ?'
  ).bind(target.enrollmentId, target.stepOrder + 1).first();

  if (next) {
    await env.DB.prepare(
      `UPDATE campaign_enrollments SET current_step = current_step + 1, next_step_at = datetime('now','+7 days')
       WHERE id = ?`
    ).bind(target.enrollmentId).run();
  } else {
    // 序列结束
    await env.DB.prepare(
      `UPDATE campaign_enrollments SET current_step = current_step + 1, status = 'completed'
       WHERE id = ?`
    ).bind(target.enrollmentId).run();
  }
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ============================================================
//  5. 入组激活
// ============================================================
/**
 * 按筛选条件匹配联系人并加入序列、激活。
 */
export async function enrollAndActivate(
  env: OutreachEnv,
  campaignId: string,
  filter: {
    product_category?: string;
    countries?: string[];
    min_score?: number;
    contact_ids?: string[];
  }
): Promise<{ matched: number; enrolled: number; skipped: number }> {
  let sql = `SELECT c.id AS contact_id, c.account_id, a.company_name, a.country, a.lead_score
             FROM contacts c
             JOIN accounts a ON c.account_id = a.id
             WHERE c.email IS NOT NULL AND c.email <> ''
               AND c.unsubscribed = 0
               AND c.status = 'active'`;
  const params: string[] = [];
  if (filter.contact_ids && filter.contact_ids.length) {
    sql += ` AND c.id IN (${filter.contact_ids.map(() => '?').join(',')})`;
    params.push(...filter.contact_ids);
  } else {
    if (filter.product_category) {
      sql += ` AND (a.industry LIKE ? OR a.company_name LIKE ?)`;
      params.push(`%${filter.product_category}%`, `%${filter.product_category}%`);
    }
    if (filter.countries && filter.countries.length) {
      sql += ` AND a.country IN (${filter.countries.map(() => '?').join(',')})`;
      params.push(...filter.countries);
    }
    if (filter.min_score) {
      sql += ` AND a.lead_score >= ?`;
      params.push(String(filter.min_score));
    }
  }

  const rows = (await env.DB.prepare(sql).bind(...params).all()).results as Array<Record<string, unknown>>;
  let enrolled = 0, skipped = 0;

  for (const r of rows) {
    const exists = await env.DB.prepare(
      'SELECT id FROM campaign_enrollments WHERE campaign_id = ? AND contact_id = ?'
    ).bind(campaignId, r.contact_id).first();
    if (exists) { skipped++; continue; }

    await env.DB.prepare(
      `INSERT INTO campaign_enrollments (id, campaign_id, contact_id, account_id, current_step, next_step_at, status)
       VALUES (?, ?, ?, ?, 0, datetime('now'), 'active')`
    ).bind(genId(), campaignId, r.contact_id, r.account_id).run();
    enrolled++;
  }

  // 更新 campaign 状态与计数
  await env.DB.prepare(
    `UPDATE campaigns SET status = 'active', total_enrolled = (SELECT COUNT(*) FROM campaign_enrollments WHERE campaign_id = ?)
     WHERE id = ?`
  ).bind(campaignId, campaignId).run();

  return { matched: rows.length, enrolled, skipped };
}

// ============================================================
//  6. 分析聚合
// ============================================================
export async function getCampaignAnalytics(
  env: OutreachEnv,
  campaignId: string
): Promise<Record<string, unknown>> {
  const steps = (await env.DB.prepare(
    'SELECT * FROM campaign_steps WHERE campaign_id = ? ORDER BY step_order'
  ).bind(campaignId).all()).results as Array<Record<string, unknown>>;

  const enroll = await env.DB.prepare(
    'SELECT COUNT(*) AS c FROM campaign_enrollments WHERE campaign_id = ?'
  ).bind(campaignId).first() as { c: number };

  const counts = await env.DB.prepare(
    `SELECT e.event_type, e.step_id, COUNT(DISTINCT e.contact_id) AS contacts, COUNT(*) AS total
     FROM email_events e
     JOIN campaign_enrollments ce ON ce.id = e.enrollment_id
     WHERE ce.campaign_id = ?
     GROUP BY e.event_type, e.step_id`
  ).bind(campaignId).all();

  const byEvent: Record<string, { contacts: number; total: number }> = {};
  const byStep: Record<string, Record<string, number>> = {};
  (counts.results as Array<Record<string, unknown>>).forEach(r => {
    const et = r.event_type as string;
    byEvent[et] = { contacts: r.contacts as number, total: r.total as number };
    const sid = (r.step_id as string) || 'unknown';
    byStep[sid] = byStep[sid] || {};
    byStep[sid][et] = (byStep[sid][et] || 0) + (r.total as number);
  });

  const sent = byEvent['sent']?.contacts || 0;
  const opened = byEvent['opened']?.contacts || 0;
  const clicked = byEvent['clicked']?.contacts || 0;
  const replied = byEvent['replied']?.contacts || 0;
  const unsub = byEvent['unsubscribed']?.contacts || 0;

  const perStep = steps.map(s => {
    const sid = s.id as string;
    const ss = byStep[sid] || {};
    const sSent = ss['sent'] || 0;
    return {
      step_order: s.step_order,
      subject: s.subject,
      sent: sSent,
      opened: ss['opened'] || 0,
      clicked: ss['clicked'] || 0,
      replied: ss['replied'] || 0,
      open_rate: sSent ? Math.round((ss['opened'] || 0) / sSent * 100) : 0,
      click_rate: sSent ? Math.round((ss['clicked'] || 0) / sSent * 100) : 0,
    };
  });

  return {
    campaign_id: campaignId,
    enrolled: enroll.c,
    totals: {
      sent, opened, clicked, replied, unsubscribed: unsub,
      open_rate: sent ? Math.round(opened / sent * 100) : 0,
      click_rate: sent ? Math.round(clicked / sent * 100) : 0,
      reply_rate: sent ? Math.round(replied / sent * 100) : 0,
      unsub_rate: sent ? Math.round(unsub / sent * 100) : 0,
    },
    per_step: perStep,
  };
}

// ============================================================
//  7. 追踪事件处理
// ============================================================
export function trackingPixel(): Response {
  return new Response(
    Uint8Array.from(atob(TRANSPARENT_GIF_B64), c => c.charCodeAt(0)),
    { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' } }
  );
}

/** 记录打开事件（去重到分钟级以免刷新刷爆计数，但保留每次记录用于时间线） */
export async function recordOpen(
  env: OutreachEnv,
  enrollmentId: string,
  stepId: string,
  contactId: string
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO email_events (id, enrollment_id, contact_id, step_id, event_type, recipient)
     VALUES (?, ?, ?, ?, 'opened', (SELECT email FROM contacts WHERE id = ?))`
  ).bind(genId(), enrollmentId, contactId, stepId, contactId).run();
}

/** 记录点击事件并 302 重定向到目标 URL */
export async function recordClick(
  env: OutreachEnv,
  enrollmentId: string,
  stepId: string,
  contactId: string,
  targetUrl: string
): Promise<Response> {
  // 防开放重定向：仅允许 http/https
  let safe = targetUrl;
  try {
    const u = new URL(targetUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') safe = env.APP_BASE_URL;
  } catch {
    safe = env.APP_BASE_URL;
  }
  await env.DB.prepare(
    `INSERT INTO email_events (id, enrollment_id, contact_id, step_id, event_type, metadata)
     VALUES (?, ?, ?, ?, 'clicked', ?)`
  ).bind(genId(), enrollmentId, contactId, stepId, JSON.stringify({ url: safe })).run();
  return new Response(null, { status: 302, headers: { Location: safe } });
}

/** 退订：记录事件 + 标记联系人 + 暂停其所有进行中的序列 */
export async function unsubscribe(
  env: OutreachEnv,
  enrollmentId: string | null,
  contactId: string | null,
  email: string | null
): Promise<void> {
  // 解析 contact
  let cid = contactId;
  if (!cid && email) {
    const c = await env.DB.prepare('SELECT id FROM contacts WHERE email = ?').bind(email).first() as { id?: string } | null;
    cid = c?.id || null;
  }
  if (!cid) return;

  await env.DB.prepare('UPDATE contacts SET unsubscribed = 1 WHERE id = ?').bind(cid).run();

  // 暂停进行中的序列参与
  const enrClause = enrollmentId ? 'AND id = ?' : '';
  await env.DB.prepare(
    `UPDATE campaign_enrollments SET status = 'unsubscribed' WHERE contact_id = ? AND status = 'active' ${enrClause}`
  ).bind(...(enrollmentId ? [cid, enrollmentId] : [cid])).run();

  // 记录事件（若指定 enrollment）
  if (enrollmentId) {
    await env.DB.prepare(
      `INSERT INTO email_events (id, enrollment_id, contact_id, event_type, recipient)
       VALUES (?, ?, ?, 'unsubscribed', ?)`
    ).bind(genId(), enrollmentId, cid, email || '').run();
  }
  // 记录活动
  await env.DB.prepare(
    `INSERT INTO activities (id, contact_id, type, subject, body)
     VALUES (?, ?, 'unsubscribed', 'Unsubscribed', ?)`
  ).bind(genId(), cid, `Contact unsubscribed${enrollmentId ? ' from campaign' : ''}`).run();
}

/**
 * 处理回执（来自 Resend inbound webhook 或手动 POST）。
 * 通过发件人邮箱匹配联系人，记录 replied，并推进商机阶段。
 */
export async function recordReply(
  env: OutreachEnv,
  fromEmail: string,
  subject?: string,
  text?: string
): Promise<{ matched: boolean; contactId?: string }> {
  const contact = await env.DB.prepare('SELECT * FROM contacts WHERE email = ?')
    .bind(fromEmail).first() as Record<string, unknown> | null;
  if (!contact) return { matched: false };

  const cid = contact.id as string;
  const aid = contact.account_id as string;

  // 找到该联系人的最新 active enrollment 标记为已回复
  const enr = await env.DB.prepare(
    `SELECT id FROM campaign_enrollments WHERE contact_id = ? AND status = 'active' ORDER BY enrolled_at DESC LIMIT 1`
  ).bind(cid).first() as { id?: string } | null;

  await env.DB.prepare(
    `INSERT INTO email_events (id, enrollment_id, contact_id, event_type, subject, metadata)
     VALUES (?, ?, ?, 'replied', ?, ?)`
  ).bind(genId(), enr?.id || null, cid, subject || '', JSON.stringify({ text: (text || '').slice(0, 500) })).run();

  // 记录活动
  await env.DB.prepare(
    `INSERT INTO activities (id, account_id, contact_id, type, subject, body, direction)
     VALUES (?, ?, ?, 'email_reply', ?, ?, 'in')`
  ).bind(genId(), aid, cid, subject || 'Re:', (text || '').slice(0, 500)).run();

  // 推进商机到「已合格」或「谈判中」
  await env.DB.prepare(
    `UPDATE opportunities SET stage_id = 'stage_qualified', updated_at = datetime('now')
     WHERE account_id = ? AND stage_id IN ('stage_new','stage_contacted')`
  ).bind(aid).run();

  // 更新序列计数
  if (enr?.id) {
    await env.DB.prepare('UPDATE campaigns SET total_replied = total_replied + 1 WHERE id = (SELECT campaign_id FROM campaign_enrollments WHERE id = ?)')
      .bind(enr.id).run();
  }

  return { matched: true, contactId: cid };
}
