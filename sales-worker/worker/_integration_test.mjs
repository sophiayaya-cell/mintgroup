// 本地集成测试台：用 node:sqlite 伪造 D1，直接驱动 Worker bundle 的真实 fetch handler。
// 绕过 workerd（本机 VC++ 运行库过旧导致 workerd 崩溃），但实测的是真实路由+鉴权+DB 联动。
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

// ---------- D1 桩（映射 node:sqlite -> Cloudflare D1 接口） ----------
class D1Stmt {
  constructor(db, sql) { this.db = db; this.sql = sql; this.params = []; }
  bind(...p) { this.params = p; return this; }
  async all() {
    const rows = this.db.prepare(this.sql).all(...this.params);
    return { results: rows };
  }
  async first() {
    const r = this.db.prepare(this.sql).get(...this.params);
    return r === undefined ? null : r;
  }
  async run() {
    this.db.prepare(this.sql).run(...this.params);
    return { success: true, meta: {} };
  }
}
class D1 {
  constructor(db) { this.db = db; }
  prepare(sql) { return new D1Stmt(this.db, sql); }
}

// ---------- 建库 + 跑 schema ----------
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema/schema.sql', import.meta.url), 'utf8'));

// 种入 open 追踪所需的 FK 数据（contact / campaign / step / enrollment）
db.prepare(`INSERT INTO accounts (id, company_name, country) VALUES ('a1','Seed Acct','US')`).run();
db.prepare(`INSERT INTO contacts (id, account_id, full_name, email) VALUES ('c1','a1','Jane Doe','jane@seed.com')`).run();
db.prepare(`INSERT INTO campaigns (id, name, status) VALUES ('cmp1','Seed Campaign','active')`).run();
db.prepare(`INSERT INTO campaign_steps (id, campaign_id, step_order, type, subject, body) VALUES ('s1','cmp1',1,'email','Subj','Body')`).run();
db.prepare(`INSERT INTO campaign_enrollments (id, campaign_id, contact_id, account_id, status) VALUES ('e1','cmp1','c1','a1','active')`).run();

const env = {
  DB: new D1(db),
  RESEND_API_KEY: 'test-resend-key',
  EMAIL_FROM: 'sales@mint-gp.com',
  EMAIL_FROM_NAME: 'Mint Sales',
  APP_BASE_URL: 'https://www.mint-gp.com',
  GITHUB_CLIENT_ID: 'REPLACE',
  GITHUB_CLIENT_SECRET: 'REPLACE',
  SESSION_SECRET: 'test-session-secret',
  HUNTER_API_KEY: undefined,
};

const { default: worker } = await import('./_bundle.mjs');
const BASE = 'http://localhost';
const AUTH = { Authorization: 'Bearer dev-token', 'Content-Type': 'application/json' };

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ✓', name, extra); }
  else { fail++; console.log('  ✗ FAIL:', name, extra); }
}
async function call(method, p, body, headers = {}) {
  const req = new Request(BASE + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const res = await worker.fetch(req, env);
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) data = await res.json();
  else data = await res.text();
  if (res.status >= 500) console.log('   [5xx 错误体]', JSON.stringify(data));
  return { status: res.status, ct, data };
}

console.log('=== 1. 公开端点：打开追踪像素 ===');
{
  const r = await call('GET', '/api/sales/tracking/open?e=e1&s=s1&c=c1');
  check('HTTP 200', r.status === 200, `(${r.status})`);
  check('content-type=image/gif', r.ct.includes('image/gif'), `(${r.ct})`);
  check('gif 字节数约 42', r.data.length >= 35 && r.data.length <= 50, `(len=${r.data.length})`);
  // 验证已落库 email_events (opened)
  const ev = db.prepare("SELECT COUNT(*) c FROM email_events WHERE event_type='opened' AND step_id='s1'").get();
  check('open 事件已落库', ev.c === 1, `(c=${ev.c})`);
}
console.log('=== 2. 公开端点：退订页 ===');
{
  const r = await call('GET', '/api/sales/unsubscribe?email=test@example.com');
  check('HTTP 200', r.status === 200, `(${r.status})`);
  check('返回 HTML', r.ct.includes('text/html'), `(${r.ct})`);
  // 退订会标记 contacts (无该邮箱则仅页面)，这里验证端点可用即可
}
console.log('=== 3. 受保护：lead-sources (期望 6) ===');
{
  const r = await call('GET', '/api/sales/lead-sources', null, AUTH);
  check('HTTP 200', r.status === 200, `(${r.status})`);
  const arr = r.data?.data;
  check('6 个线索来源', Array.isArray(arr) && arr.length === 6, `(len=${Array.isArray(arr)?arr.length:'?'})`);
}
console.log('=== 4. 受保护：scoring-model (权重和=100) ===');
{
  const r = await call('GET', '/api/sales/prospecting/scoring-model', null, AUTH);
  check('HTTP 200', r.status === 200, `(${r.status})`);
  const sum = (r.data?.weights || []).reduce((a, f) => a + (f.max || 0), 0);
  check('权重和=100', sum === 100, `(sum=${sum})`);
}
console.log('=== 5. 受保护：analytics/summary ===');
{
  const r = await call('GET', '/api/sales/analytics/summary', null, AUTH);
  check('HTTP 200', r.status === 200, `(${r.status})`);
  check('含 total_leads 数', typeof r.data?.total_leads === 'number', `(total_leads=${r.data?.total_leads})`);
}
console.log('=== 6. 受保护：campaigns 列表 ===');
{
  const r = await call('GET', '/api/sales/campaigns', null, AUTH);
  check('HTTP 200', r.status === 200, `(${r.status})`);
  check('返回 campaigns 数组', Array.isArray(r.data?.data), `(len=${r.data?.data?.length})`);
}
console.log('=== 7. 受保护：prospecting/search (发现+评分) ===');
{
  const r = await call('POST', '/api/sales/prospecting/search', { source: 'customs', filters: { country: 'US', product: 'laminated' } }, AUTH);
  check('HTTP 200', r.status === 200, `(${r.status})`);
  const leads = r.data?.leads || [];
  check('返回线索数组', Array.isArray(leads) && leads.length > 0, `(len=${leads.length})`);
  if (Array.isArray(leads) && leads[0]) {
    check('线索带 score', typeof leads[0].score === 'number', `(score=${leads[0].score})`);
    check('线索带 tier', typeof leads[0].tier === 'string', `(tier=${leads[0].tier})`);
  }
}
console.log('=== 8. 受保护：prospecting/discover-emails ===');
{
  const r = await call('POST', '/api/sales/prospecting/discover-emails',
    { website: 'acmehygiene.com', contacts: [{ first_name: 'Jane', last_name: 'Doe', title: 'Procurement', seniority: 'senior' }] }, AUTH);
  check('HTTP 200', r.status === 200, `(${r.status})`);
  const em = r.data?.emails || r.data;
  check('返回邮箱数组', Array.isArray(em), '');
  if (Array.isArray(em)) check('含 guessed/verified 状态', em.every(x => ['verified','guessed','invalid'].includes(x.status)), '');
}
console.log('=== 9. 受保护：leads/import (去重导入) ===');
{
  const before = db.prepare('SELECT COUNT(*) c FROM accounts').get().c;
  const r = await call('POST', '/api/sales/leads/import', {
    leads: [{
      company_name: 'Integration Test Buyer Ltd', country: 'Germany', country_code: 'DE',
      website: 'itb.example.com', industry: 'Medical', product_category: 'laminated',
      hs_code: '5603.93', source_type: 'customs', source_ref: 'customs_data',
      contacts: [{ first_name: 'Hans', last_name: 'Mueller', title: 'Buyer', email: 'hans@itb.example.com' }]
    }]
  }, AUTH);
  check('HTTP 200', r.status === 200, `(${r.status})`);
  check('imported=1', r.data?.imported === 1, `(imported=${r.data?.imported}, skipped=${r.data?.skipped})`);
  const after = db.prepare('SELECT COUNT(*) c FROM accounts').get().c;
  check('accounts 行数 +1', after === before + 1, `(${before}->${after})`);
  const acct = db.prepare("SELECT id, lead_score, source FROM accounts WHERE company_name='Integration Test Buyer Ltd'").get();
  check('导入行含自动评分', acct && typeof acct.lead_score === 'number', `(score=${acct?.lead_score})`);
  check('导入行含来源', acct && acct.source === 'customs', `(${acct?.source})`);
  const contact = db.prepare("SELECT COUNT(*) c FROM contacts WHERE account_id=?").get(acct.id);
  check('自动建联系人', contact.c === 1, `(c=${contact.c})`);
  const opp = db.prepare("SELECT COUNT(*) c FROM opportunities WHERE account_id=?").get(acct.id);
  check('自动建商机', opp.c === 1, `(c=${opp.c})`);
}
console.log('=== 10. 鉴权：无 token 应 401 ===');
{
  const r = await call('GET', '/api/sales/lead-sources');
  check('HTTP 401', r.status === 401, `(${r.status})`);
}
console.log('=== 11. 鉴权：错误 token 应 401 ===');
{
  const r = await call('GET', '/api/sales/lead-sources', null, { headers: { Authorization: 'Bearer wrong' } });
  check('HTTP 401', r.status === 401, `(${r.status})`);
}
console.log('=== 12. 路由：未知路径应 404 ===');
{
  const r = await call('GET', '/api/sales/nope', null, AUTH);
  check('HTTP 404', r.status === 404, `(${r.status})`);
}
console.log('=== 13. Phase 4: analytics/trends ===');
{
  const r = await call('GET', '/api/sales/analytics/trends?days=30', null, AUTH);
  check('HTTP 200', r.status === 200, `(${r.status})`);
  const s = r.data?.series;
  check('series 长度=30', Array.isArray(s) && s.length === 30, `(len=${Array.isArray(s)?s.length:'?'})`);
  const keys = ['leads','sent','opened','clicked','replied','unsubscribed','opps','won'];
  check('每点含全部 8 指标', s && keys.every(k => typeof s[0][k] === 'number'), `(keys=${s?Object.keys(s[0]||{}).join(','):''})`);
  const leadsSum = Array.isArray(s) ? s.reduce((a, x) => a + (x.leads || 0), 0) : 0;
  check('30 天线索合计>=1 (含种子账号)', leadsSum >= 1, `(sum=${leadsSum})`);
}
console.log('=== 14. Phase 4: analytics/roi ===');
{
  const r = await call('GET', '/api/sales/analytics/roi', null, AUTH);
  check('HTTP 200', r.status === 200, `(${r.status})`);
  check('attribution=any-touch', r.data?.attribution === 'any-touch', `(${r.data?.attribution})`);
  check('data 为数组', Array.isArray(r.data?.data), `(len=${r.data?.data?.length})`);
  const t = r.data?.totals;
  check('totals 含 cost/sent/replied/won_value', t && ['cost','sent','replied','won_count','won_value','roi'].every(k => k in t), '');
  const seed = (r.data?.data || []).find(d => d.id === 'cmp1');
  check('种子序列 cmp1 在结果中', !!seed, `(found=${!!seed})`);
  check('cmp1 roi=null (cost=0)', seed && seed.roi === null, `(roi=${seed?.roi})`);
}
console.log('=== 15. Phase 4: analytics/sources ===');
{
  const r = await call('GET', '/api/sales/analytics/sources', null, AUTH);
  check('HTTP 200', r.status === 200, `(${r.status})`);
  const d = r.data?.data;
  check('data 为数组且非空', Array.isArray(d) && d.length > 0, `(len=${Array.isArray(d)?d.length:'?'})`);
  check('每来源含 total/avg_score/reply_rate/conversion_rate', d && d.length > 0 && ['total','avg_score','reply_rate','conversion_rate'].every(k => typeof d[0][k] === 'number'), '');
  const customs = (d || []).find(x => x.source === 'customs');
  check('含 customs 来源 (导入测试产生)', !!customs, `(found=${!!customs})`);
}
// 清理 bundle（测试产物，不入库；safe-delete 钩子可能拦截 rm，用 try 包住避免影响总结）
import { rmSync } from 'node:fs';
try { rmSync(new URL('./_bundle.mjs', import.meta.url), { force: true }); } catch { /* 忽略清理失败 */ }

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
process.exit(fail === 0 ? 0 : 1);
