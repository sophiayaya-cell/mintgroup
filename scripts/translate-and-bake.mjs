// 一次性把缺失语种（es/ar/de/fr/ja/ko/ru）的翻译直接写回源 JSON（products/news/team）。
// 与 translate-products.mjs 的区别：后者只在构建期生成侧车；本脚本把翻译"烘焙"进源文件，
// 使站点不依赖 Cloudflare 构建环境的 OPENAI_API_KEY，内容永久正确，且对 Decap 后台透明。
// 用法：OPENAI_API_KEY=sk-xxx node scripts/translate-and-bake.mjs
// 注意：已存在的语种（zh/en）会原样保留，只补齐缺失语种。
//
// 网络说明：本机 Node 原生 fetch 在沙箱里连不上 api.openai.com（UND_ERR_CONNECT_TIMEOUT），
// 但 curl 可以。因此本脚本改走 curl 做 HTTP 调用。

import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execFileSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const LOCALE_NAMES = {
  en: 'English',
  es: 'Spanish',
  ar: 'Arabic',
  de: 'German',
  fr: 'French',
  ja: 'Japanese',
  ko: 'Korean',
  ru: 'Russian',
};
const TARGET = Object.keys(LOCALE_NAMES); // 8 个目标（含 en，已存在则跳过）

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_TRANSLATE_MODEL || 'gpt-4o-mini';
const API = 'https://api.openai.com/v1/chat/completions';
const TIMEOUT = 60; // 单次请求超时（秒）

if (!apiKey) {
  console.error('[bake] 缺少 OPENAI_API_KEY，退出。');
  process.exit(1);
}

// 每种内容类型的目录、字段描述（给翻译 prompt）、以及源码字段提取器
const TYPES = {
  products: {
    dir: join(ROOT, 'content/products'),
    fields:
      'name (string), tagline (string), description (string, may contain line breaks \\n — keep them), features (string[]), specs (array of {label, value})',
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
    fields:
      'title (string), excerpt (string), body (array of {para: string}) — translate each para, keep the array structure',
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
    fields: 'name (string), role (string), bio (string)',
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

// 走 curl：本机 node fetch 连不上 OpenAI，但 curl 可以
function translateOne(source, targetLocale, fieldsDesc) {
  const targetName = LOCALE_NAMES[targetLocale];
  const body = {
    model,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a professional translator for a hygiene products manufacturer (ZIBO MINT HYGIENE). Translate the given JSON from Chinese to ${targetName}. Keep the exact same JSON structure and keys: ${fieldsDesc}. Brand names and locale-invariant codes stay unchanged. Return ONLY valid JSON, no markdown, no explanation.`,
      },
      { role: 'user', content: JSON.stringify(source) },
    ],
  };
  const tmp = join(ROOT, '.translate-req.tmp.json');
  writeFileSync(tmp, JSON.stringify(body));
  try {
    const out = execFileSync(
      'curl',
      [
        '-sS',
        '-m',
        String(TIMEOUT),
        '-X',
        'POST',
        API,
        '-H',
        'Content-Type: application/json',
        '-H',
        `Authorization: Bearer ${apiKey}`,
        '--data',
        `@${tmp}`,
      ],
      { maxBuffer: 16 * 1024 * 1024, timeout: (TIMEOUT + 10) * 1000 }
    ).toString('utf8');
    const data = JSON.parse(out);
    if (data.error) throw new Error(`API错误: ${data.error.message || data.error.type}`);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('empty response');
    return JSON.parse(content);
  } finally {
    try {
      unlinkSync(tmp);
    } catch {}
  }
}

// 只保留源里有的字段；数组项统一压成字符串字段对象
function sanitize(translated, source) {
  const out = {};
  for (const key of Object.keys(source)) {
    const src = source[key];
    const t = translated?.[key];
    if (Array.isArray(src)) {
      out[key] = Array.isArray(t)
        ? t.map((item) => {
            if (item && typeof item === 'object') {
              const clean = {};
              for (const k of Object.keys(item)) clean[k] = String(item[k] ?? '');
              return clean;
            }
            return String(item);
          })
        : src;
    } else {
      out[key] = t !== undefined ? String(t) : src;
    }
  }
  return out;
}

let total = 0;
let fail = 0;

async function main() {
  for (const [typeName, type] of Object.entries(TYPES)) {
    let files = [];
    try {
      files = readdirSync(type.dir).filter((f) => f.endsWith('.json'));
    } catch {
      console.warn(`[bake] 目录不存在，跳过 ${typeName}`);
      continue;
    }
    for (const file of files) {
      const path = join(type.dir, file);
      let raw;
      try {
        raw = JSON.parse(readFileSync(path, 'utf8'));
      } catch (e) {
        console.warn(`[bake] 跳过无法解析: ${path}`, e.message);
        continue;
      }
      const i18n = raw.i18n || {};
      const sourceLocale = i18n.zh ? 'zh' : i18n.en ? 'en' : null;
      const source = sourceLocale ? type.extract(i18n, sourceLocale) : null;
      if (!source) {
        console.log(`[bake] ${typeName}/${file}: 无源文本，跳过`);
        continue;
      }
      for (const locale of TARGET) {
        if (i18n[locale] && Object.keys(i18n[locale]).length) continue; // 已有，保留
        try {
          const t = translateOne(source, locale, type.fields);
          i18n[locale] = sanitize(t, source);
          total++;
          console.log(`[bake] ${typeName}/${file} -> ${locale} OK`);
        } catch (e) {
          fail++;
          console.warn(`[bake] ${typeName}/${file} -> ${locale} FAIL:`, e.message);
        }
      }
      raw.i18n = i18n;
      writeFileSync(path, JSON.stringify(raw, null, 2) + '\n');
    }
  }
  console.log(`[bake] 完成：成功 ${total}，失败 ${fail}。`);
}

main().catch((e) => {
  console.error('[bake] 致命错误:', e.message);
  process.exit(1);
});
