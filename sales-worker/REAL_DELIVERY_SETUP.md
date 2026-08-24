# 真实送达配置清单（全免费链路）

本文件把「销售系统真实发送邮件」所需的**账号 + DNS + 密钥**三步讲清楚。
代码侧（StartupHub 邮箱验证 + Resend 发送）已经改完并通过 45/45 集成测试，
剩下的是需要在 Cloudflare / Resend 控制台手动完成的外部配置。

---

## 一、邮件真实发送：Resend（必做）

### 1. 注册 Resend 账号
- 打开 https://resend.com  → Sign up（用你日常邮箱注册，免费层 3000 封/月、100 封/天、1 个域名）。
- 进入 **API Keys** → Create API Key → 复制 `re_xxx` 开头的 key（只显示一次）。

### 2. 验证发信域名 `mint-gp.com`
- Resend 控制台 → **Domains** → Add Domain → 填 `mint-gp.com` → 选区域（默认 us）。
- Resend 会给出一组 DNS 记录，到 **Cloudflare 控制台 → mint-gp.com → DNS → Records** 添加：

  | 类型 | 名称 | 内容 | 说明 |
  |---|---|---|---|
  | TXT | `mint-gp.com` 或 `@` | `v=spf1 include:amazonses.com ~all` | 覆盖默认 SPF（Resend 用 SES 发信） |
  | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@mint-gp.com` | DMARC 策略（初期用 none 观察） |
  | CNAME | `xxx._domainkey` | Resend 给的 `xxx.dkim.amazonses.com` | DKIM 签名（Resend 控制台会列出具体主机名+值，通常 1~3 条） |

  > 注：Resend 控制台会**逐条列出**确切的 Name/Value，以上为通用形态，以控制台显示为准。
  > Cloudflare 里 CNAME 主机名去掉 `mint-gp.com.` 后缀只填前缀（如 `resend._domainkey`）。

- 回到 Resend 点 **Verify**，等状态变绿（DNS 生效通常 5~30 分钟，最长 24h）。

### 3. 注入密钥到 Cloudflare Worker
在 `sales-worker/` 目录执行（把 key 换成你的）：

```bash
wrangler secret put RESEND_API_KEY --name mintgroup-sales
# 粘贴 re_xxx

# SESSION_SECRET 也建议设（API Bearer 鉴权，否则只能用 dev-token）
wrangler secret put SESSION_SECRET --name mintgroup-sales
# 粘贴一段随机串，例如：openssl rand -hex 32
```

> `EMAIL_FROM=sales@mint-gp.com` 已在 wrangler.toml 的 [vars] 里设好，无需改。

---

## 二、邮箱发现：StartupHub（已内置，免配置）

- `worker/prospecting.ts` 的 `discoverEmails()` 默认调用免费公共服务
  `https://startuphub-validator-service.onrender.com/api/discover-email`（免 API key、实时 SMTP 校验）。
- 服务不可达时自动降级为 `guessed`（不阻断导入）。
- 若想自建实例覆盖端点，在 wrangler.toml [vars] 加：
  `STARTUPHUB_BASE_URL = "https://你的实例/api"`
- **无需任何 secret。**

---

## 三、部署

代码已通过本地集成测试。执行部署：

```bash
cd C:/Users/Lenovo/zibo-mint-hygiene/sales-worker
npm run build            # 若有 build 脚本（esbuild 打包）；否则跳过
wrangler deploy
```

部署后验证：

```bash
# 线索来源（公开只读，应 200 + 6 项）
curl https://www.mint-gp.com/api/sales/lead-sources

# 真实发送验证：用一封测试邮箱触发一次 send-now（需 Bearer token = SESSION_SECRET）
curl -X POST https://www.mint-gp.com/api/sales/outreach/send-now \
  -H "Authorization: Bearer <SESSION_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"enrollmentId":"<某个enrollment>","testMode":true,"testTo":"你的邮箱@xx.com"}'
```

收件箱应收到来自 `sales@mint-gp.com` 的邮件（含打开像素 + 退订页脚）。

---

## 四、免费层限制与注意事项

| 项目 | 免费额度 | 备注 |
|---|---|---|
| Resend | 3000 封/月、100 封/天、1 域名 | 超出需升级；冷启动期建议小批量试发 |
| StartupHub | 慷慨、未公开硬上限、无 key | onrender 实例首次请求 ~10s 冷启动；量大可自建 |
| 合规 | — | 每封必须含退订链接（代码已自动注入 List-Unsubscribe 头 + 页脚）；遵守 CAN-SPAM / GDPR |

---

## 五、排错

- **Resend 发送 403/401**：key 没设对或域名未验证 → 查 `wrangler secret list --name mintgroup-sales` 确认 RESEND_API_KEY 存在，Resend 控制台 Domain 状态为 Verified。
- **邮件进垃圾箱**：DKIM/DMARC 未生效 → 用 https://www.mail-tester.com 发一封测试信看评分。
- **StartupHub 超时**：沙箱/Cloudflare 出网被限 → `discoverEmails` 已 catch 降级，不影响导入，只是邮箱状态退化为 `guessed`。
