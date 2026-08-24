# Mint Sales System — 部署联调 Runbook

销售工作系统（线索获取 → 补全评分 → 管线 CRM → 外联自动化 → 追踪回复）的
Cloudflare 部署指南。与现有 `mintgroup-auth` Worker 在同一域名 `www.mint-gp.com`
共存，通过**路径最具体匹配**隔离：

| 路径 | 处理方 |
|------|--------|
| `www.mint-gp.com/api/sales/*` | **mintgroup-sales**（本系统后端 API） |
| `www.mint-gp.com/api/auth`、`/api/callback`、`/api/gh/*`、`/api/logout` | mintgroup-auth（Decap CMS OAuth） |
| 其余 `www.mint-gp.com/*` | mintgroup（Astro 静态站 / Pages） |

入口 `worker/index.ts` 已把 `/api/sales` 前缀归一化为 `/api` 再路由，因此内部
全部 `/api/*` 路由无需改动即可在 `/api/sales/*` 下工作。

---

## 0. 前置条件

1. **Node 18+**（已具备）。
2. **安装 Wrangler**（任选其一）：
   ```bash
   npm install -g wrangler        # 全局
   # 或项目本地： cd sales-worker && npm install wrangler
   ```
3. **登录 Cloudflare**（首次部署前，浏览器 OAuth 或 API Token）：
   ```bash
   wrangler login
   # 或： wrangler login --api-token  <你的 CF API Token>
   ```
4. **GitHub OAuth App**：销售系统的管理后台（Dashboard）沿用 Decap 的
   GitHub OAuth。复用 `mintgroup-auth` 同一个 OAuth App：
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` 与 auth-worker 一致。
   - 回调地址已是 `https://www.mint-gp.com/api/callback`（由 auth-worker 处理）。

---

## 1. 创建 D1 数据库

```bash
cd sales-worker
wrangler d1 create mint-sales-db
```

输出会给出 `database_id`（一串 UUID）。把它填进 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "mint-sales-db"
database_id = "<这里换成真实 UUID>"
```

> 也可用本地开发：把 database_id 暂时留任意值，`wrangler dev` 会建本地库。

---

## 2. 初始化表结构（Schema）

首次部署后执行（远程）：

```bash
wrangler d1 execute mint-sales-db --file=./schema/schema.sql
```

若**之前已部署过旧版 schema**（缺 `contacts.unsubscribed` 列），先补迁移：

```bash
wrangler d1 execute mint-sales-db --remote --command="ALTER TABLE contacts ADD COLUMN unsubscribed INTEGER DEFAULT 0;"
```

若**之前已部署过 Phase 0-3 旧版**（campaigns 表缺 `cost` 列，Phase 4 ROI 需要），补迁移：

```bash
wrangler d1 execute mint-sales-db --remote --command="ALTER TABLE campaigns ADD COLUMN cost REAL DEFAULT 0;"
# 时间趋势索引（可选，加速 analytics/trends）
wrangler d1 execute mint-sales-db --remote --command="CREATE INDEX IF NOT EXISTS idx_email_occurred ON email_events(occurred_at); CREATE INDEX IF NOT EXISTS idx_accounts_created ON accounts(created_at); CREATE INDEX IF NOT EXISTS idx_opp_created ON opportunities(created_at);"
```

（`schema.sql` 中 `unsubscribed` / `cost` / 索引已是 `CREATE TABLE` / `CREATE INDEX IF NOT EXISTS` 一部分；新库直接跑整文件即可。）

---

## 3. 配置密钥（Secrets）

敏感项**不要写进 `wrangler.toml`**，用 `wrangler secret put`：

```bash
wrangler secret put RESEND_API_KEY --name mintgroup-sales     # 邮件发送（Resend）
wrangler secret put SESSION_SECRET --name mintgroup-sales     # API 鉴权 Bearer token
wrangler secret put GITHUB_CLIENT_SECRET --name mintgroup-sales
wrangler secret put HUNTER_API_KEY --name mintgroup-sales     # 邮箱发现/验证(可选)
```

- `SESSION_SECRET`：自己设一个长随机串，Dashboard 调 API 时作为
  `Authorization: Bearer <SESSION_SECRET>` 使用（开发期也可临时用 `dev-token`）。
- `RESEND_API_KEY`：在 [resend.com](https://resend.com) 注册拿到；未配置时
  发送会失败但不影响部署与建表。
- `EMAIL_FROM` / `EMAIL_FROM_NAME` / `APP_BASE_URL` / `GITHUB_CLIENT_ID` 已在
  `wrangler.toml` 的 `[vars]` 中，可按需改。

**本地开发**可改放 `sales-worker/.dev.vars`（已被 `.gitignore` 忽略）：

```ini
RESEND_API_KEY=re_xxx
SESSION_SECRET=dev-token
GITHUB_CLIENT_SECRET=xxx
HUNTER_API_KEY=xxx
```

---

## 4. 部署 Worker（自动挂路由）

```bash
cd sales-worker
wrangler deploy
```

`wrangler.toml` 里的 `routes` 字段会在首次部署时自动把
`www.mint-gp.com/api/sales/*` 加为 zone 路由（无需手动控制台操作）。
之后每次改代码只需重跑 `wrangler deploy`。

（可选）启用异步发送队列，避免 cron 单次超时：
```bash
# 1) 取消 wrangler.toml 中 [[queues]] 注释
wrangler queues create mint-sales-send
wrangler deploy
```

---

## 5. 验证（部署后冒烟）

### 5.1 公开端点（无需鉴权）

```bash
# 打开追踪像素（应返回 1x1 gif）
curl "https://www.mint-gp.com/api/sales/tracking/open?e=test&s=s1&c=c1"

# 点击追踪（应 302 跳转到 url 参数）
curl -i "https://www.mint-gp.com/api/sales/tracking/click?e=test&s=s1&c=c1&url=https://www.mint-gp.com"

# 退订页（应返回 HTML 退订成功页）
curl "https://www.mint-gp.com/api/sales/unsubscribe?email=someone@example.com"
```

### 5.2 受保护端点（需 Bearer token）

```bash
TOKEN=<你的 SESSION_SECRET 或 dev-token>

# 仪表盘汇总
curl -H "Authorization: Bearer $TOKEN" \
  https://www.mint-gp.com/api/sales/analytics/summary

# 时间趋势(最近30天)  [Phase 4]
curl -H "Authorization: Bearer $TOKEN" \
  "https://www.mint-gp.com/api/sales/analytics/trends?days=30"

# 序列 ROI 投入产出  [Phase 4]
curl -H "Authorization: Bearer $TOKEN" \
  https://www.mint-gp.com/api/sales/analytics/roi

# 线索来源归因  [Phase 4]
curl -H "Authorization: Bearer $TOKEN" \
  https://www.mint-gp.com/api/sales/analytics/sources

# 线索来源列表
curl -H "Authorization: Bearer $TOKEN" \
  https://www.mint-gp.com/api/sales/lead-sources

# 评分模型
curl -H "Authorization: Bearer $TOKEN" \
  https://www.mint-gp.com/api/sales/prospecting/scoring-model

# 线索搜索（发现+评分）
# 注意：字段名是 source（非 source_type），筛选条件放在 filters 下
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"source":"customs","filters":{"country":"US","product":"laminated"}}' \
  https://www.mint-gp.com/api/sales/prospecting/search
```

若返回 JSON 而非 `{"error":"Unauthorized"}`，说明路由前缀、鉴权、D1 全部打通。

---

## 6. 本地联调 / 免账号验证（重要）

> ⚠️ **`wrangler dev --local` 在本机 Windows 上会崩溃**：workerd 本地运行时报
> `access violation in the runtime`，官方提示是 **Microsoft Visual C++ Redistributable
> 版本过旧**。这是本机环境限制，**不影响 `wrangler deploy`**（部署走云端运行时，不依赖
> workerd）。仅在想本地起 dev server 时才需要修复 VC++ 运行库。

**免 Cloudflare 账号的运行时验证**（推荐，已跑通 31/31）：

本仓库附带 Node 集成测试，用 `node:sqlite` 伪造 D1，直接驱动 Worker 的
真实 `fetch` handler，覆盖路由 / 鉴权 / DB 联动 / 公开追踪端点：

```bash
cd sales-worker
# 需要先装 esbuild（已在 managed node workspace 提供）
export ES=~/.workbuddy/binaries/node/workspace/node_modules/.bin/esbuild
export NODE=~/.workbuddy/binaries/node/versions/22.22.2/node.exe
"$ES" worker/index.ts --bundle --format=esm --platform=node --outfile=worker/_bundle.mjs
"$NODE" --experimental-sqlite worker/_integration_test.mjs
```

输出 `=== 结果: 31 通过, 0 失败 ===` 即代表路由、鉴权、schema、导入、追踪全链路通过。

如确需本地 dev server，先修复 VC++ 运行库（下载最新
[Microsoft Visual C++ Redistributable](https://learn.microsoft.com/zh-cn/cpp/windows/latest-supported-vc-redist)）
再 `wrangler dev --local`，另一终端把第 5 节的域名换成 `http://127.0.0.1:8787` 即可
（本地模式 `dev-token` 可直接当 Bearer 用）。

---

## 7. Dashboard 接入（后续步骤）

`dashboard/*.html` 目前是**前端镜像引擎**（离线可交互，不真正调 API）。
接真实后端需两步：

1. 把 Dashboard 静态托管到可访问地址（建议单独 Cloudflare Pages 项目或一个
   子路径），并在文件里把 API base 从 mock 改为
   `https://www.mint-gp.com/api/sales`。
2. 所有 fetch 加 `Authorization: Bearer <SESSION_SECRET>`。
3. 登录态：复用 mintgroup-auth 的 GitHub OAuth，Dashboard 拿到 token 后调 API。

> 注意：Dashboard 含客户数据，建议放在受保护的内部地址，不要挂在公开根域名下。

---

## 已知限制 / 后续

- 鉴权为简化版（Bearer 静态 token）。生产建议接入 mintgroup-auth 的 GitHub
  OAuth session（复用 `verifySession`）。
- 真实线索来源（Europages / ImportGenius / LinkedIn）需在 `worker/connectors.ts`
  填入对应 API key 并实现抓取；当前为与业务匹配的种子数据集。
- 邮件真实送达依赖 Resend + 发信域名 `sales@mint-gp.com` 的 DNS 校验（SPF/DKIM）。
