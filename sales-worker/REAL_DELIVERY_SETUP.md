# 真实送达配置清单（全免费链路）

本文件把「销售系统真实发送邮件」所需的**账号 + DNS + 密钥**三步讲清楚。
代码侧（StartupHub 邮箱验证 + Resend 发送）已经改完并通过 45/45 集成测试，
剩下的是需要在 Cloudflare / Resend 控制台手动完成的外部配置。

---

## 一、邮件真实发送：Resend（必做）

### 1. 注册 Resend 账号
- 打开 https://resend.com  → Sign up（用你日常邮箱注册，免费层 3000 封/月、100 封/天、1 个域名）。
- 进入 **API Keys** → Create API Key → 复制 `re_xxx` 开头的 key（只显示一次）。

### 2. 验证发信域名 `mint-gp.com`（截图级步骤）

> 目标：让 Resend 能代表 `mint-gp.com` 发信，且收件方承认签名合法。
> 一共 3 步：Resend 里加域名 → 把 Resend 给的 DNS 记录逐项抄到 Cloudflare → 回 Resend 点 Verify。

#### 2.1 在 Resend 后台添加域名
1. 登录 https://resend.com → 左侧菜单 **Domains**（域名）→ 右上角 **Add Domain**。
2. 弹窗里填 `mint-gp.com` → 区域选 **us-east-1**（默认即可）→ 点 **Add**。
3. 进入域名详情页，页面会显示一个 **DNS records（DNS 记录）** 面板，通常列出 **3 条记录**（1 条 SPF-TXT、1 条 DMARC-TXT、1~3 条 DKIM-CNAME）。
   - 每条记录都有 **Type（类型）/ Host（主机）/ Value（值/目标）** 三列，右侧有复制按钮。
   - 记下这 3 条的内容，下一步原样抄到 Cloudflare。**以这个面板显示的值为准**，下面的表只是示例，不要照抄字面。

   | Resend 面板上的 Type | 典型 Host（示例） | 典型 Value（示例） | 含义 |
   |---|---|---|---|
   | `TXT` | `mint-gp.com`（或 `@`） | `v=spf1 include:amazonses.com ~all` | SPF：授权 Resend 代发 |
   | `TXT` | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@mint-gp.com` | DMARC：初期 `p=none` 仅观察 |
   | `CNAME` | `resend._domainkey`（或类似 `xxx._domainkey`） | `resend.dkim.amazonses.com`（或 `dkim.resend.com` 等） | DKIM：签名公钥指针（可能 2~3 条） |

#### 2.2 在 Cloudflare 后台逐项添加 DNS 记录
1. 登录 https://dash.cloudflare.com → 选站点 **mint-gp.com** → 顶部 **DNS** → **Records** 标签。
2. 点右上角蓝色 **Add record**（添加记录）。对 Resend 面板里的**每一条**记录重复以下操作：

   - **Type（类型）**：从下拉框选 Resend 给的类型（TXT 或 CNAME），**不要选错**。
   - **Name（名称）**：把 Resend 的 Host **去掉末尾的 `.mint-gp.com`** 再填：
     - Host 是 `mint-gp.com` 或 `@` → 填 `@`（或留空，Cloudflare 会自动补根域名）。
     - Host 是 `_dmarc` → 填 `_dmarc`。
     - Host 是 `resend._domainkey` → 填 `resend._domainkey`（**只填前缀，不要带 `.mint-gp.com`**，否则会变成 `resend._domainkey.mint-gp.com.mint-gp.com` 双重后缀而失败）。
   - **Content / Target（内容/目标）**：
     - TXT 类型 → 把 Resend 的 Value **整段**粘贴进 Content（含 `v=spf1...` 或 `v=DMARC1...`，不要丢分号）。
     - CNAME 类型 → 把 Resend 的 Value 粘贴进 Target（形如 `resend.dkim.amazonses.com`，**末尾不要手填点号**，Cloudflare 会补）。
   - **TTL**：保持 **Auto**（自动）。
   - **代理状态（关键！）**：点一下右侧的小云朵，确保它是 **灰色（DNS only / 仅 DNS）**，不是橙色（Proxied / 已代理）。
     - ⚠️ DKIM 的 CNAME **绝不能开代理（橙色云）**，否则收件方查不到正确签名，邮件必进垃圾箱或验证失败。SPF/DMARC 的 TXT 不受影响，但统一设成灰云最稳妥。
   - 填完点 **Save**（保存）。重复直到 3 条都加完。
3. 添加后，Cloudflare 的 Records 列表里应能看见这 3 条，且云朵都是灰色。

#### 2.3 回 Resend 点 Verify
1. 回到 Resend 的域名详情页，等 **1~2 分钟** 让 DNS 传播（Cloudflare 保存后通常几十秒就生效，但 Resend 校验有缓存）。
2. 点页面上的 **Verify**（或刷新页面后出现的 Verify Domain）按钮。
3. 状态从 `Pending` / `Not verified` 变为 **`Verified`**（绿色）即成功。
   - 若仍 `Pending`：等 5~30 分钟再点一次；最长 24h。多半是某条记录 Host 多写了后缀或 CNAME 开了代理，回头按 2.2 核对。
   - 可用第三方核对：在终端跑 `dig +short TXT mint-gp.com` 应回显 `v=spf1 include:amazonses.com ~all`；`dig +short CNAME resend._domainkey.mint-gp.com` 应回显 `resend.dkim.amazonses.com`（值以你的面板为准）。

> 小提示：Resend 较新版本会把 DKIM 合并成 1 条 CNAME，老版本是 3 条——**条数以你后台面板显示为准**，逐条照抄即可，不要凭记忆补删。

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

#### 3.1 密钥丢失 / 轮换怎么办

Resend 的 API Key **创建时只显示一次，之后后台不再展示明文**，所以"没记录下来"无法"查看"，只能**重新生成一个新 key**。处理步骤：

1. 登录 https://resend.com → 左侧 **API Keys** → **Create API Key**（也可把旧的删掉，避免留下废弃 key）。
2. 创建后立即复制 `re_xxx`（只弹这一次），马上粘贴进下面的 `wrangler secret put`。
3. `wrangler secret put RESEND_API_KEY --name mintgroup-sales` 会**直接覆盖** Worker 里旧的 secret，**无需先删旧的**；put 成功后 Cloudflare 会自动重新部署，新 key 立即生效。
4. 旧 key 若没删，在 Resend 后台手动 Delete 即可（留着也能用，但建议删除以缩小泄露面）。

> 注意：Cloudflare Worker 的 secret **无法反向读取明文**——一旦 `wrangler secret put` 进去就再也看不到，所以丢了只能按上面重新生成。下次拿到 key 建议立刻存进密码管理器（如 Bitwarden / 1Password）或写进本地 `.env`（已被 `.gitignore` 忽略，不会入库）。

> `SESSION_SECRET` **不是 Resend 的东西**，而是你自己生成的随机串（`openssl rand -hex 32`）。它若已经设进 Worker 且在用，无需重设；只有想轮换时才换——注意换了会让现有 `Bearer <SESSION_SECRET>` 的会话全部失效，需重新用新值调接口。

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
