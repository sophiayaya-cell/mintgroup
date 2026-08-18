// 针对性修复：产品 specs 里有一层嵌套 spec（克重/幅宽/颜色），MyMemory 翻译脚本只翻了顶层
// （材质/适用场景/认证），导致非 zh/en 语种的详情页缺这三项规格。本脚本把嵌套 spec 的
// label/value 也翻译并注入到各语种，使 9 语种规格完整一致。
// 用法：node scripts/fix-product-specs.mjs

import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execFileSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const API = 'https://api.mymemory.translated.net/get';
const TARGET = ['es', 'ar', 'de', 'fr', 'ja', 'ko', 'ru'];
const PRODUCTS_DIR = join(ROOT, 'content/products');

async function translateText(text, target) {
  const tmp = join(ROOT, '.mm-req.tmp');
  writeFileSync(tmp, String(text));
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const out = execFileSync(
        'curl',
        [
          '-sS', '-m', '30', '--retry', '5', '--retry-delay', '1', '--retry-all-errors',
          '-G', API, '--data-urlencode', `q@${tmp}`, '--data-urlencode', `langpair=zh|${target}`,
        ],
        { maxBuffer: 8 * 1024 * 1024, timeout: 45000 }
      ).toString('utf8');
      const j = JSON.parse(out);
      const t = j?.responseData?.translatedText;
      if (!t) throw new Error('空翻译');
      if (/MYMEMORY WARNING/i.test(t)) throw new Error('QUOTA:' + t.slice(0, 40));
      return t;
    } catch (e) {
      lastErr = e;
      if (/QUOTA/.test(e.message)) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastErr;
}

let total = 0;
let fail = 0;

async function main() {
  const files = readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const path = join(PRODUCTS_DIR, file);
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const zhSpecs = (raw.i18n?.zh?.specs || []).map((x) => ({
      label: x.label ?? '',
      value: x.value ?? '',
      spec: x.spec ?? null,
    }));
    if (!zhSpecs.length) {
      console.log(`[specs] ${file}: 无 zh specs，跳过`);
      continue;
    }
    for (const locale of TARGET) {
      const cur = raw.i18n?.[locale]?.specs;
      if (!Array.isArray(cur) || cur.length !== zhSpecs.length) {
        console.log(`[specs] ${file} -> ${locale}: 结构不匹配，跳过`);
        continue;
      }
      let changed = false;
      for (let i = 0; i < zhSpecs.length; i++) {
        const zhNested = zhSpecs[i].spec;
        if (!zhNested) continue;
        try {
          const label = await translateText(zhNested.label || '', locale);
          const value = await translateText(zhNested.value || '', locale);
          cur[i].spec = { label, value };
          total++;
          changed = true;
          console.log(`[specs] ${file} -> ${locale} [${i}] OK`);
        } catch (e) {
          fail++;
          console.warn(`[specs] ${file} -> ${locale} [${i}] FAIL:`, e.message.slice(0, 50));
        }
        await new Promise((r) => setTimeout(r, 120));
      }
      if (changed) raw.i18n[locale].specs = cur;
    }
    writeFileSync(path, JSON.stringify(raw, null, 2) + '\n');
  }
  console.log(`[specs] 完成：成功 ${total}，失败 ${fail}。`);
}

main().catch((e) => {
  console.error('[specs] 致命错误:', e.message);
  process.exit(1);
});
