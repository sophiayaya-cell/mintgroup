# 上线后日常运营检查清单（mintgroup-sales 邮件系统）

> 适用：www.mint-gp.com 销售邮件系统上线后的例行巡检与发信前自检。
> 系统栈：Cloudflare Worker（mintgroup-sales）+ D1 + Resend + StartupHub。
> 发信域名：`mint-gp.com`；发件地址：`sophia.wang@mint-gp.com`。

---

## 0. 发信前必做：testTo 安全自检

每次真实群发前，先用测试模式把邮件发到自己的邮箱验证渲染 + 送达，**不碰真实买家**：

```bash
curl -X POST https://www.mint-gp.com/api/sales/campaigns/<序列ID>/send-now \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d "{\"testTo\":\"sophia.wang@mint-gp.com\"}"
```

- 返回含 `"mode":"test"`、`"testTo":"sophia.wang@mint-gp.com"` 即成功。
- 确认收件箱收到、排版正确、未被判垃圾邮件，再做真实群发（去掉 `testTo`，空 body `{}`）。
- ⚠️ 真实群发会直接发给该序列所有到期真实买家并推进序列，且 Cloudflare Cron（每小时）也会自动发送到期步骤。

---

## 1. 每日巡检（5 分钟）

| # | 检查项 | 怎么做 | 异常处理 |
|---|--------|--------|----------|
| 1 | Resend 当日额度余量 | Resend 控制台 → Overview，看「Emails sent today」（免费 100/天） | 临近上限先暂停群发，避免超发报错 |
| 2 | 退信 / 投诉率 | Resend → Logs / Audience，看 bounced、complained | 单日投诉率 > 0.1% 或累计 > 5% 立即停发并排查名单质量 |
| 3 | 退订入口可用 | 浏览器打开 `https://www.mint-gp.com/api/sales/unsubscribe?email=test@example.com` 应返回 HTML 退订页 | 返回 404/500 说明 Worker 或路由异常，查 `wrangler tail` |
| 4 | 打开追踪像素存活 | 打开一封已发邮件，确认 `<img>` 指向 `…/api/sales/tracking/open?…`（公开端点） | 图片破图不影响送达，但打开率统计会失真 |
| 5 | 发送/打开趋势 | `curl -H "x-api-key: $SALES_API_KEY" "https://www.mint-gp.com/api/sales/analytics/trends?days=1"` | 打开率骤降 → 多半是域名信誉/进垃圾箱，做第 3 项邮件头核查 |

---

## 2. 每周复盘（20 分钟）

| # | 检查项 | 怎么做 |
|---|--------|--------|
| 1 | 月度额度进度 | Resend → 看当月累计（免费 3000/月），预估是否月底超量 |
| 2 | 序列效果 | `analytics/roi`、`analytics/funnel` 看各序列 open/click/reply 率，淘汰低效序列 |
| 3 | 邮箱验证健康 | 看 `accounts` 列表的 `email_stats.verified` 占比；`guessed` 偏高说明 StartupHub 频繁超时（免费实例冷启动） |
| 4 | DNS 未被误改 | Cloudflare → DNS：SPF(TXT @) 仍含 `include:amazonses.com`；`dkim1._domainkey` CNAME 仍存在且为**灰云/DNS only**；`_dmarc` 仍在 |
| 5 | 数据备份 | `wrangler d1 export mintgroup-sales --output=backup-$(date +%F).sql` 留存 |

---

## 3. 每月 / 变更时

- **Resend API Key 轮换**：旧 key 泄露或想轮换时，Resend 后台新建 key → `wrangler secret put RESEND_API_KEY --name mintgroup-sales`（直接覆盖，自动重部署）。
- **SESSION_SECRET 轮换**：`wrangler secret put SESSION_SECRET --name mintgroup-sales`（换了会让现有 Bearer 会话失效）。
- **域名/dx 续期**：确认 mint-gp.com 域名未过期；Zoho/Cloudflare 账密不过期。
- **Resend 域名 Verify 状态**：控制台 Domain 应为 Verified（绿）；若变红，回看 DNS 是否被动过。

---

## 4. 快速排错

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| `curl .../accounts` 返回 401 | 请求没带鉴权，或 `SALES_API_KEY` secret 没设进 Worker | 用 `dev-token` 旁路：`Authorization: Bearer dev-token`；或确认 `wrangler secret list --name mintgroup-sales` 含 `SALES_API_KEY` |
| 真实发送 403 / 401 | RESEND_API_KEY 错或域名未 Verify | 查 secret 存在 + Resend Domain=Verified |
| 邮件进垃圾箱 | DKIM/DMARC 未生效 | 用 mail-tester.com 发测试信看评分；确认 DKIM CNAME 是灰云 |
| 打开率长期 0 | 追踪像素被客户端拦截（正常）或 `tracking/open` 端点挂了 | 多数邮件客户端默认不加载远程图片，属正常；仍可用点击/回复率评估 |
| StartupHub 超时导致邮箱全 guessed | 免费实例冷启动 / 出网受限 | 不影响导入，仅邮箱状态退化；量大可自建实例覆盖 `STARTUPHUB_BASE_URL` |
| 群发后买家没收到 | 序列 `status` 非 active / `next_step_at` 未到期 / 联系人 `unsubscribed=1` / 邮箱空 | 查 `campaign_enrollments` 与 `contacts` 对应字段 |
| 打开 `/sales/` 后被弹去 GitHub、回来仍空白/401 | OAuth App 没加 `https://www.mint-gp.com/api/sales/callback` 回调，或 `GITHUB_CLIENT_SECRET`/`SESSION_SECRET` 未设在 mintgroup-sales | 见 REAL_DELIVERY_SETUP.md 第六节；`/api/sales/auth` 返回 500 多为 `GITHUB_CLIENT_ID` 仍是占位符 |
| 能登录但页面数据 401 | 改了登录代码却没重新 `wrangler deploy` | 重新部署 mintgroup-sales Worker |

---

## 5. 端点速查

| 端点 | 鉴权 | 说明 |
|------|------|------|
| `GET /api/sales/lead-sources` | 公开 | 线索来源列表（部署存活自检） |
| `GET /api/sales/accounts` | dev-token / SESSION_SECRET / x-api-key | 客户列表 + email_stats |
| `GET /api/sales/analytics/trends?days=30` | 同上 | 趋势 |
| `GET /api/sales/analytics/roi` `…/funnel` `…/sources` | 同上 | 分析 |
| `POST /api/sales/campaigns/:id/send-now` | 同上 | 立即发送（支持 `{"testTo":"邮箱"}` 安全自检） |
| `GET /api/sales/tracking/open` `…/click` | 公开 | 打开/点击追踪 |
| `GET /api/sales/unsubscribe` | 公开 | 退订 |

> 鉴权三选一：`Authorization: Bearer dev-token`（旁路，仅测试用）、`Authorization: Bearer $SESSION_SECRET`、`x-api-key: $SALES_API_KEY`（前端硬编码同款 key）。
