<#
 .SYNOPSIS
    Mint Sales System one-click deploy (PowerShell, run from repo root)
 .DESCRIPTION
    Chains the full deploy:
      1) git push origin main      -- Pages Git integration deploys the frontend
      2) D1 schema apply           -- idempotent (D1 already exists)
      3) wrangler secret put       -- SALES_API_KEY / RESEND_API_KEY / SESSION_SECRET / GITHUB_CLIENT_SECRET
      4) wrangler deploy           -- mintgroup-sales goes live
      5) Cloudflare DNS hint       -- manual Resend domain verification
      6) online smoke tests        -- auto curl verify endpoints return 200
    Usage:
      .\deploy-all.ps1
      $env:RESEND_API_KEY="re_xxx"; $env:SESSION_SECRET="..."; .\deploy-all.ps1
 .NOTES
    For a fresh build, first run sales-worker\deploy.ps1 once to create the D1
    and write database_id into wrangler.toml.
    DNS records must be added manually in Cloudflare (see
    sales-worker\REAL_DELIVERY_SETUP.md section 2), then Verify in Resend.
#>
$ErrorActionPreference = "Stop"
$WorkerName = "mintgroup-sales"
$RepoRoot = $PSScriptRoot
$WorkerDir = Join-Path $RepoRoot "sales-worker"

# 0. prerequisites
if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: wrangler not found. Install: npm install -g wrangler" -ForegroundColor Red
  exit 1
}

# 1. push frontend (Pages auto-deploys via Git integration)
Write-Host "`n==> Step 1/6: git push origin main (frontend auto-deploy)" -ForegroundColor Cyan
Set-Location $RepoRoot
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "main") {
  Write-Host "Current branch is '$branch', not main. Skipping push; handle manually." -ForegroundColor Yellow
} else {
  $ahead = git log "origin/main..HEAD" --oneline 2>$null
  if (-not $ahead) {
    Write-Host "    Nothing to push, skipped." -ForegroundColor Green
  } else {
    git push origin main
    if ($LASTEXITCODE -ne 0) {
      Write-Host "    git push failed. Check network/credentials and rerun." -ForegroundColor Red
      exit 1
    }
    Write-Host "    Frontend pushed; Cloudflare Pages will build+deploy automatically." -ForegroundColor Green
  }
}

# 2. D1 schema (idempotent)
Write-Host "`n==> Step 2/6: apply D1 schema (idempotent)" -ForegroundColor Cyan
Set-Location $WorkerDir
# 动态读取 wrangler.toml 中的 database_name，确保与 Worker 绑定一致
$dbName = (Select-String -Path (Join-Path $WorkerDir "wrangler.toml") -Pattern 'database_name\s*=\s*"([^"]+)"' | ForEach-Object { $_.Matches.Groups[1].Value } | Select-Object -First 1)
if (-not $dbName) { $dbName = "mintgroup-sales" }
Write-Host "    target D1 database: $dbName" -ForegroundColor Gray
wrangler d1 execute $dbName --file=./schema/schema.sql
if ($LASTEXITCODE -ne 0) {
  Write-Host "    schema apply failed, see output above." -ForegroundColor Red
  exit 1
}

# 3. secrets (env first, else prompt; Enter skips optional ones)
Write-Host "`n==> Step 3/6: configure secrets" -ForegroundColor Cyan
# SALES_API_KEY 必须与前端硬编码值一致（prospecting/outreach/analytics.html 中的 KEY），
# 否则线上站点每个 x-api-key 请求都会返回 401。该值已暴露在前端源码中，故无 env 时直接用硬编码默认值。
$SalesApiKeyDefault = "6c9aa264c91c7a0c5a9847c59e48271536dda8806cdf1b0ebbcc724e38ec7e80"
$keys = @(
  @{ Name = "SALES_API_KEY";         Required = $true;  Val = (if ($env:SALES_API_KEY) { $env:SALES_API_KEY } else { $SalesApiKeyDefault }) },
  @{ Name = "RESEND_API_KEY";        Required = $true;  Val = $env:RESEND_API_KEY },
  @{ Name = "SESSION_SECRET";        Required = $false; Val = $env:SESSION_SECRET },
  @{ Name = "GITHUB_CLIENT_SECRET";  Required = $false; Val = $env:GITHUB_CLIENT_SECRET }
)
foreach ($k in $keys) {
  $v = $k.Val
  if (-not $v) {
    if ($k.Required) {
      $v = Read-Host "  $($k.Name) (required for real sending)"
    } else {
      $v = Read-Host "  $($k.Name) (optional, Enter to skip)"
      if (-not $v) { continue }
    }
  }
  if ($v) {
    Write-Host "    writing $($k.Name) ..." -ForegroundColor Gray
    $v | wrangler secret put $k.Name --name $WorkerName
  }
}

# 4. deploy worker
Write-Host "`n==> Step 4/6: wrangler deploy" -ForegroundColor Cyan
wrangler deploy
if ($LASTEXITCODE -ne 0) {
  Write-Host "    deploy failed, see output above." -ForegroundColor Red
  exit 1
}
Write-Host "    Worker deployed." -ForegroundColor Green

# 5. DNS hint (manual, then pause)
Write-Host "`n==> Step 5/6: Cloudflare DNS config (manual)" -ForegroundColor Cyan
Write-Host "  Code is live, but real email delivery also needs Resend DNS records in Cloudflare:"
Write-Host "    1. Resend console -> Domains -> mint-gp.com -> copy the 3 records shown"
Write-Host "       (1x SPF-TXT, 1x DMARC-TXT, 1-3x DKIM-CNAME)"
Write-Host "    2. Cloudflare console -> mint-gp.com -> DNS -> Records -> Add record"
Write-Host "       - pick TXT or CNAME per record; strip the trailing .mint-gp.com from Name"
Write-Host "       - DKIM CNAME must stay gray-cloud (DNS only), never orange proxy"
Write-Host "    3. Back in Resend click Verify; turns green when done"
Write-Host "       (details in REAL_DELIVERY_SETUP.md section 2)"
Read-Host "  After adding DNS and Verify, press Enter to finish"

Read-Host "  After adding DNS and Verify, press Enter to run online smoke tests"

# 6. online smoke tests (executed, not just printed)
Write-Host "`n==> Step 6/6: online smoke tests" -ForegroundColor Cyan
# 等部署传播几秒，避免刚 deploy 完就测到旧实例
Start-Sleep -Seconds 5

$ApiBase = "https://www.mint-gp.com/api/sales"
# 6.1 lead-sources 现已公开，裸 curl 应 200
Write-Host "  [1/3] GET /lead-sources (public, expect 200)" -ForegroundColor Gray
try {
  $code = (curl.exe -s -o $null -w "%{http_code}" "$ApiBase/lead-sources" 2>$null)
  if ($code -eq "200") { Write-Host "        PASS ($code)" -ForegroundColor Green }
  else { Write-Host "        FAIL ($code) -- deploy may not have propagated yet, retry in a minute" -ForegroundColor Yellow }
} catch {
  Write-Host "        SKIP (curl not available)" -ForegroundColor Gray
}

# 6.2 analytics/trends 受保护，带 x-api-key 应 200
Write-Host "  [2/3] GET /analytics/trends (protected, x-api-key, expect 200)" -ForegroundColor Gray
$SalesKey = if ($env:SALES_API_KEY) { $env:SALES_API_KEY } else { "6c9aa264c91c7a0c5a9847c59e48271536dda8806cdf1b0ebbcc724e38ec7e80" }
if (-not $SalesKey) {
  Write-Host "        SKIP -- SALES_API_KEY not available" -ForegroundColor Gray
} else {
  try {
    $code = (curl.exe -s -o $null -w "%{http_code}" -H "x-api-key: $SalesKey" "$ApiBase/analytics/trends?days=30" 2>$null)
    if ($code -eq "200") { Write-Host "        PASS ($code)" -ForegroundColor Green }
    else { Write-Host "        FAIL ($code)" -ForegroundColor Yellow }
  } catch {
    Write-Host "        SKIP (curl not available)" -ForegroundColor Gray
  }
}

# 6.3 真实发送（需已配 RESEND_API_KEY + 域名 DNS 已 Verify）。仅打印命令，不自动发。
Write-Host "  [3/3] real send (manual) -- requires RESEND_API_KEY + verified domain" -ForegroundColor Gray
Write-Host "        curl -X POST $ApiBase/outreach/send-now -H 'Authorization: Bearer <SESSION_SECRET>' -H 'Content-Type: application/json' -d '{\"enrollmentId\":\"<id>\",\"testMode\":true,\"testTo\":\"you@xx.com\"}'" -ForegroundColor Gray
Write-Host "        (SESSION_SECRET is the value you put via wrangler secret put, or dev-token for a quick test)" -ForegroundColor Gray

Write-Host "`nDeploy flow finished." -ForegroundColor Green
Write-Host "Next (manual): add Resend DNS in Cloudflare + Verify in Resend, then real emails will deliver." -ForegroundColor Cyan
