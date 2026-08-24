<#
 .SYNOPSIS
    Mint Sales System 一键部署脚本 (PowerShell)
 .DESCRIPTION
    半自动部署 mintgroup-sales Worker 到 Cloudflare：
      1) 创建 D1 数据库 (首次)
      2) 把 database_id 写入 wrangler.toml
      3) 执行 schema 建表
      4) 交互式配置 secrets
      5) wrangler deploy (自动挂 /api/sales/* 路由)
    用法:
      .\deploy.ps1                       # 引导创建 D1，然后按提示重跑
      .\deploy.ps1 -D1Id <uuid>          # 已创建过 D1，跳过创建
      $env:MINT_D1_ID=<uuid>; .\deploy.ps1   # 同上，用环境变量传 id
#>
param(
  [string]$D1Id = $env:MINT_D1_ID,
  [switch]$SkipD1Create
)

$ErrorActionPreference = "Stop"
$WorkerName = "mintgroup-sales"

# 0. 确保位于脚本所在目录
Push-Location $PSScriptRoot

# 1. 检查 wrangler
if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: 未找到 wrangler。请先安装: npm install -g wrangler" -ForegroundColor Red
  exit 1
}

# 2. 创建 D1（首次，需手动回填 id）
if (-not $SkipD1Create -and -not $D1Id) {
  Write-Host "==> 步骤1/5: 创建 D1 数据库 mint-sales-db" -ForegroundColor Cyan
  wrangler d1 create mint-sales-db
  Write-Host "请把上面输出中的 database_id 复制下来，然后重跑:" -ForegroundColor Yellow
  Write-Host "    .\deploy.ps1 -D1Id <粘贴的UUID>" -ForegroundColor Yellow
  exit 0
}

if (-not $D1Id) {
  Write-Host "ERROR: 请提供 -D1Id 或设置环境变量 MINT_D1_ID" -ForegroundColor Red
  exit 1
}

# 3. 把 database_id 写入 wrangler.toml（替换占位）
Write-Host "==> 步骤2/5: 写入 database_id 到 wrangler.toml" -ForegroundColor Cyan
$toml = "wrangler.toml"
$content = Get-Content $toml -Raw
if ($content -notmatch [regex]::Escape($D1Id)) {
  $content = $content -replace 'database_id = "REPLACE_WITH_YOUR_D1_ID"', "database_id = `"$D1Id`""
  Set-Content $toml $content -Encoding utf8
  Write-Host "    已更新 database_id" -ForegroundColor Green
} else {
  Write-Host "    database_id 已是目标值，跳过" -ForegroundColor Green
}

# 4. 执行 schema
Write-Host "==> 步骤3/5: 初始化表结构" -ForegroundColor Cyan
wrangler d1 execute mint-sales-db --file=./schema/schema.sql
if ($LASTEXITCODE -ne 0) {
  Write-Host "schema 执行失败，请检查输出" -ForegroundColor Red
  exit 1
}

# 5. 配置 secrets（逐个交互，回车跳过）
Write-Host "==> 步骤4/5: 配置密钥 (回车跳过某项)" -ForegroundColor Cyan
foreach ($key in @("RESEND_API_KEY", "SESSION_SECRET", "GITHUB_CLIENT_SECRET", "HUNTER_API_KEY")) {
  $val = Read-Host "  $key"
  if ($val) {
    # wrangler secret put 从 stdin 读取值
    $val | wrangler secret put $key --name $WorkerName
  }
}

# 6. 部署
Write-Host "==> 步骤5/5: wrangler deploy (自动挂 www.mint-gp.com/api/sales/* 路由)" -ForegroundColor Cyan
wrangler deploy
if ($LASTEXITCODE -eq 0) {
  Write-Host "部署完成! 验证: curl https://www.mint-gp.com/api/sales/lead-sources" -ForegroundColor Green
} else {
  Write-Host "部署失败，请查看上方错误" -ForegroundColor Red
}

Pop-Location
