// 用 MyMemory 免费翻译接口（无需 Key）把缺失语种（es/ar/de/fr/ja/ko/ru）写回源 JSON。
// 与 OpenAI 版的区别：零成本、走 curl（本机 node fetch 连不上外网，curl 可以）。
// 用法：node scripts/translate-mymemory.mjs
// 特性：只补齐缺失语种；可反复运行（已翻译的跳过），断点续跑。
// 注意：MyMemory 匿名额度约 5000 词/日（CJK 按字符计），若中途额度用尽会停止并提示。

import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execFileSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const API = 'https://api.mymemory.translated.net/get';
const TARGET = ['es', 'ar', 'de', 'fr', 'ja', 'ko', 'ru'];
const DELAY = 120; // 每次请求间隔(ms)，避免限流

const TYPES = {
  products: {
    dir: join(ROOT, 'content/products'),
    extract: (i18n, loc) => {
      const s = i18n[loc];
      if (!s) return null;
      const o = {};
      if (s.name) o.name = s.name;
      if (s.tagline) o.tagline = s.tagline;
      if (s.description) o.description = s.description;
      if (Array.isArray(s.features) && s.features.length) o.features = s.features;
      if (Array.isArray(s.specs) && s.specs.length)
        o.specs = s.specs.map((x) => ({
          label: x.label ?? x.spec?.label ?? '',
          value: x.value ?? x.spec?.value ?? '',
        }));
      return Object.keys(o).length ? o : null;
    },
  },
  news: {
    dir: join(ROOT, 'content/news'),
    extract: (i18n, loc) => {
      const s = i18n[loc];
      if (!s) return null;
      const o = {};
      if (s.title) o.title = s.title;
      if (s.excerpt) o.excerpt = s.excerpt;
      if (Array.isArray(s.body) && s.body.length) o.body = s.body.map((p) => ({ para: p.para }));
      return Object.keys(o).length ? o : null;
    },
  },
  team: {
    dir: join(ROOT, 'content/team'),
    extract: (i18n, loc) => {
      const s = i18n[loc];
      if (!s) return null;
      const o = {};
      if (s.name) o.name = s.name;
      if (s.role) o.role = s.role;
      if (s.bio) o.bio = s.bio;
      return Object.keys(o).length ? o : null;
    },
  },
};

async function translateText(text, target) {
  const tmp = join(ROOT, '.mm-req.tmp');
  writeFileSync(tmp, String(text));
  // Windows schannel 在此沙箱里 TLS 握手间歇性失败，故 curl 自带重试 + JS 层再重试
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const out = execFileSync(
        'curl',
        [
          '-sS',
          '-m',
          '30',
          '--retry',
          '5',
          '--retry-delay',
          '1',
          '--retry-all-errors',
          '-G',
          API,
          '--data-urlencode',
          `q@${tmp}`,
          '--data-urlencode',
          `langpair=zh|${target}`,
        ],
        { maxBuffer: 8 * 1024 * 1024, timeout: 45000 }
      ).toString('utf8');
      const j = JSON.parse(out);
      const t = j?.responseData?.translatedText;
      if (!t) throw new Error('空翻译');
      if (/MYMEMORY WARNING/i.test(t)) throw new Error('QUOTA_EXHAUSTED:' + t.slice(0, 50));
      return t;
    } catch (e) {
      lastErr = e;
      if (/QUOTA_EXHAUSTED/.test(e.message)) throw e; // 额度问题不重试
      console.warn(`[mm] 重试(${attempt}) zh->${target}: ${e.message.slice(0, 60)}`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastErr;
}

async function deepTranslate(node, target) {
  if (typeof node === 'string') return await translateText(node, target);
  if (Array.isArray(node)) return await Promise.all(node.map((x) => deepTranslate(x, target)));
  if (node && typeof node === 'object') {
    const o = {};
    for (const k of Object.keys(node)) o[k] = await deepTranslate(node[k], target);
    return o;
  }
  return node;
}

let total = 0;
let fail = 0;
let quotaHit = false;

async function main() {
  for (const [typeName, type] of Object.entries(TYPES)) {
    let files = [];
    try {
      files = readdirSync(type.dir).filter((f) => f.endsWith('.json'));
    } catch {
      console.warn(`[mm] 目录不存在，跳过 ${typeName}`);
      continue;
    }
    for (const file of files) {
      const path = join(type.dir, file);
      let raw;
      try {
        raw = JSON.parse(readFileSync(path, 'utf8'));
      } catch (e) {
        console.warn(`[mm] 跳过无法解析: ${path}`, e.message);
        continue;
      }
      const i18n = raw.i18n || {};
      const sourceLocale = i18n.zh ? 'zh' : i18n.en ? 'en' : null;
      const source = sourceLocale ? type.extract(i18n, sourceLocale) : null;
      if (!source) {
        console.log(`[mm] ${typeName}/${file}: 无源文本，跳过`);
        continue;
      }
      for (const locale of TARGET) {
        if (i18n[locale] && Object.keys(i18n[locale]).length) continue; // 已有，保留
        if (quotaHit) {
          console.log(`[mm] ${typeName}/${file} -> ${locale} 跳过(额度已尽)`);
          continue;
        }
        try {
          i18n[locale] = await deepTranslate(source, locale);
          total++;
          console.log(`[mm] ${typeName}/${file} -> ${locale} OK`);
        } catch (e) {
          if (/QUOTA_EXHAUSTED/.test(e.message)) {
            quotaHit = true;
            fail++;
            console.warn(`[mm] 额度用尽，停止翻译。已完成 ${total} 条。`);
            break;
          }
          fail++;
          console.warn(`[mm] ${typeName}/${file} -> ${locale} FAIL:`, e.message);
        }
        await new Promise((r) => setTimeout(r, DELAY));
      }
      raw.i18n = i18n;
      writeFileSync(path, JSON.stringify(raw, null, 2) + '\n');
      if (quotaHit) break;
    }
    if (quotaHit) break;
  }
  console.log(`[mm] 完成：成功 ${total}，失败 ${fail}。${quotaHit ? '额度已尽，可明日或配 MyMemory 免费 Key 后续跑补全。' : ''}`);
}

main().catch((e) => {
  console.error('[mm] 致命错误:', e.message);
  process.exit(1);
});
