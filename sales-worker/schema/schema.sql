-- ============================================================
--  Mint Sales System - Cloudflare D1 Schema
--  自主客户开发销售工作系统
-- ============================================================

-- --------------------------------------------------------
--  Pipeline Stages (管线阶段定义)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  is_won      INTEGER DEFAULT 0,
  is_lost     INTEGER DEFAULT 0,
  color       TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO pipeline_stages (id, name, display_order, is_won, is_lost, color) VALUES
  ('stage_new',         '新线索',     1, 0, 0, '#378ADD'),
  ('stage_contacted',   '已联系',     2, 0, 0, '#1D9E75'),
  ('stage_qualified',   '已合格',     3, 0, 0, '#7F77DD'),
  ('stage_sample',      '寄样中',     4, 0, 0, '#EF9F27'),
  ('stage_negotiating', '谈判中',     5, 0, 0, '#D85A30'),
  ('stage_won',         '成交',       6, 1, 0, '#639922'),
  ('stage_lost',        '流失',       7, 0, 1, '#E24B4A');

-- --------------------------------------------------------
--  Accounts (客户公司)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
  id            TEXT PRIMARY KEY,
  company_name  TEXT NOT NULL,
  country       TEXT,
  country_code  TEXT,
  website       TEXT,
  industry      TEXT,
  company_size  TEXT,
  linkedin_url  TEXT,
  description   TEXT,
  source        TEXT DEFAULT 'manual',
  source_ref    TEXT,
  lead_score    INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'active',
  tags          TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_accounts_country ON accounts(country);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_source ON accounts(source);
CREATE INDEX IF NOT EXISTS idx_accounts_score ON accounts(lead_score);
CREATE INDEX IF NOT EXISTS idx_accounts_created ON accounts(created_at);   -- 时间趋势

-- --------------------------------------------------------
--  Contacts (联系人)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
  id              TEXT PRIMARY KEY,
  account_id      TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  first_name      TEXT,
  last_name       TEXT,
  full_name       TEXT,
  title           TEXT,
  email           TEXT,
  phone           TEXT,
  linkedin_url    TEXT,
  email_verified  INTEGER DEFAULT 0,
  email_status    TEXT DEFAULT 'unknown',
  unsubscribed    INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'active',
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_account ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);

-- --------------------------------------------------------
--  Opportunities (商机/交易)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS opportunities (
  id                TEXT PRIMARY KEY,
  account_id        TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  primary_contact_id TEXT REFERENCES contacts(id),
  stage_id          TEXT REFERENCES pipeline_stages(id),
  title             TEXT,
  value             REAL DEFAULT 0,
  currency          TEXT DEFAULT 'USD',
  product_category  TEXT,
  hs_code           TEXT,
  quantity          TEXT,
  expected_close_date TEXT,
  probability       INTEGER DEFAULT 0,
  owner             TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_opp_account ON opportunities(account_id);
CREATE INDEX IF NOT EXISTS idx_opp_stage ON opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_opp_owner ON opportunities(owner);
CREATE INDEX IF NOT EXISTS idx_opp_created ON opportunities(created_at);   -- 时间趋势

-- --------------------------------------------------------
--  Activities (活动/时间线)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS activities (
  id              TEXT PRIMARY KEY,
  account_id      TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id      TEXT REFERENCES contacts(id),
  opportunity_id  TEXT REFERENCES opportunities(id),
  type            TEXT NOT NULL,
  subject         TEXT,
  body            TEXT,
  direction       TEXT,
  scheduled_at    TEXT,
  completed_at    TEXT,
  metadata        TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_act_account ON activities(account_id);
CREATE INDEX IF NOT EXISTS idx_act_contact ON activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_act_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_act_scheduled ON activities(scheduled_at);

-- --------------------------------------------------------
--  Campaigns (邮件序列/活动)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT,
  product_category  TEXT,
  target_countries  TEXT,
  status            TEXT DEFAULT 'draft',
  cost              REAL DEFAULT 0,        -- 序列投入成本(USD)，用于 ROI 计算
  total_enrolled    INTEGER DEFAULT 0,
  total_replied     INTEGER DEFAULT 0,
  total_won         INTEGER DEFAULT 0,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

-- --------------------------------------------------------
--  Campaign Steps (序列步骤)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaign_steps (
  id            TEXT PRIMARY KEY,
  campaign_id   TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
  step_order    INTEGER NOT NULL,
  type          TEXT DEFAULT 'email',
  subject       TEXT,
  body          TEXT,
  delay_days    INTEGER DEFAULT 0,
  send_time     TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_steps_campaign ON campaign_steps(campaign_id);

-- --------------------------------------------------------
--  Campaign Enrollments (序列参与)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaign_enrollments (
  id            TEXT PRIMARY KEY,
  campaign_id   TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id    TEXT REFERENCES contacts(id),
  account_id    TEXT REFERENCES accounts(id),
  current_step  INTEGER DEFAULT 0,
  next_step_at  TEXT,
  status        TEXT DEFAULT 'active',
  enrolled_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_enr_campaign ON campaign_enrollments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_enr_contact ON campaign_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_enr_next_step ON campaign_enrollments(next_step_at);
CREATE INDEX IF NOT EXISTS idx_enr_status ON campaign_enrollments(status);

-- --------------------------------------------------------
--  Email Events (邮件追踪事件)
--  event_type 取值: sent | opened | clicked | replied | bounced | unsubscribed
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_events (
  id              TEXT PRIMARY KEY,
  enrollment_id   TEXT REFERENCES campaign_enrollments(id),
  contact_id      TEXT REFERENCES contacts(id),
  step_id         TEXT REFERENCES campaign_steps(id),
  event_type      TEXT NOT NULL,
  message_id      TEXT,
  recipient       TEXT,
  subject         TEXT,
  occurred_at     TEXT DEFAULT (datetime('now')),
  metadata        TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_contact ON email_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_enrollment ON email_events(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_email_occurred ON email_events(occurred_at);   -- 时间趋势

-- --------------------------------------------------------
--  Tasks (待办任务)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id              TEXT PRIMARY KEY,
  account_id      TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id      TEXT REFERENCES contacts(id),
  opportunity_id  TEXT REFERENCES opportunities(id),
  title           TEXT NOT NULL,
  description     TEXT,
  due_date        TEXT,
  priority        TEXT DEFAULT 'medium',
  status          TEXT DEFAULT 'pending',
  created_at      TEXT DEFAULT (datetime('now')),
  completed_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_account ON tasks(account_id);

-- --------------------------------------------------------
--  Lead Sources (线索来源配置)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_sources (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,
  config          TEXT,
  last_synced_at  TEXT,
  total_leads     INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'active',
  created_at      TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO lead_sources (id, name, type, status) VALUES
  ('src_manual',     '手动录入',       'manual',     'active'),
  ('src_directory',  '贸易目录',       'directory',  'active'),
  ('src_linkedin',   'LinkedIn',       'api',        'active'),
  ('src_customs',    '海关数据',       'api',        'inactive'),
  ('src_exhibition', '展会名单',       'file',       'active'),
  ('src_website',    '网站询盘',       'webhook',    'active');

-- --------------------------------------------------------
--  Users (用户)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  role        TEXT DEFAULT 'admin',
  avatar      TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- --------------------------------------------------------
--  Settings (系统配置)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('email_provider', 'resend'),
  ('email_from', 'sales@mint-gp.com'),
  ('email_from_name', 'Mint Hygiene Sales'),
  ('currency', 'USD'),
  ('timezone', 'Asia/Shanghai');
