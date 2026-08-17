// 构建前自动机翻：把产品缺失语种从中文（缺则英文）翻译出来，写入合并侧车
// src/data/.product-translations.json，供 products.ts 在聚合时补齐。
//
// - 仅当环境变量 OPENAI_API_KEY 存在时才真正调用翻译 API；否则优雅跳过
//   （缺失语种由 products.ts 的 pick() 回退到中文/英文），构建照常进行。
// - 翻译结果不写入源 JSON，只在构建环境生成侧车，仓库保持「仅中文」干净状态。
// - 含本地缓存（scripts/.translate-cache.json），相同原文不重复调用 API。

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PRODUCTS_DIR = join(ROOT, 'content', 'products');
const SIDECAR = join(ROOT, 'src', 'data', '.product-translations.json');
const CACHE_FILE = join(__dirname, '.translate-cache.json');

// 全部目标语种（中文为源，不翻）
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
const TARGET_LOCALES = Object.keys(LOCALE_NAMES);

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_TRANSLATE_MODEL || 'gpt-4o-mini';

function hash(s) {
  return createHash('sha1').update(s).digest('hex').slice(0, 16);
}

function loadCache() {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.warn('[translate] 缓存写入失败（忽略）:', e.message);
  }
}

// 从源对象抽取可翻译字段；只翻存在的字段
function extractSource(i18n, sourceLocale) {
  const src = i18n[sourceLocale];
  if (!src) return null;
  const obj = {};
  if (src.name) obj.name = src.name;
  if (src.tagline) obj.tagline = src.tagline;
  if (src.description) obj.description = src.description;
  if (Array.isArray(src.features) && src.features.length) obj.features = src.features;
  if (Array.isArray(src.specs) && src.specs.length) {
    obj.specs = src.specs.map((s) => ({
      label: s.label ?? s.spec?.label ?? '',
      value: s.value ?? s.spec?.value ?? '',
    }));
  }
  return Object.keys(obj).length ? obj : null;
}

// 校验模型返回的翻译结构，只保留已知字段
function sanitize(translated, source) {
  const out = {};
  if (source.name !== undefined) out.name = String(translated.name ?? source.name);
  if (source.tagline !== undefined) out.tagline = String(translated.tagline ?? source.tagline);
  if (source.description !== undefined)
    out.description = String(translated.description ?? source.description);
  if (source.features !== undefined)
    out.features = Array.isArray(translated.features)
      ? translated.features.map((x) => String(x))
      : source.features;
  if (source.specs !== undefined)
    out.specs = Array.isArray(translated.specs)
      ? translated.specs.map((s) => ({
          label: String(s?.label ?? ''),
          value: String(s?.value ?? ''),
        }))
      : source.specs;
  return out;
}

async function translateOne(source, targetLocale) {
  const targetName = LOCALE_NAMES[targetLocale];
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a professional translator for a hygiene products manufacturer (ZIBO MINT HYGIENE). Translate the given JSON from Chinese to ${targetName}. Keep the exact same JSON structure and keys: {name, tagline, description, features: string[], specs: [{label, value}]}. Brand names and locale-invariant codes stay unchanged. Return ONLY valid JSON, no markdown, no explanation.`,
        },
        { role: 'user', content: JSON.stringify(source) },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('空响应');
  return JSON.parse(content);
}

async function main() {
  mkdirSync(dirname(SIDECAR), { recursive: true });

  if (!apiKey) {
    console.log(
      '[translate] 未检测到 OPENAI_API_KEY，跳过机翻（缺失语种将由前台回退中文/英文）。'
    );
    writeFileSync(SIDECAR, JSON.stringify({}, null, 2));
    return;
  }

  const files = readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith('.json'));
  const cache = loadCache();
  const sidecar = {};

  let translated = 0;
  let reused = 0;
  let skipped = 0;

  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(PRODUCTS_DIR, file), 'utf8'));
    const slug = raw.slug || file.replace(/\.json$/, '');
    const i18n = raw.i18n || {};
    const sourceLocale = i18n.zh ? 'zh' : i18n.en ? 'en' : null;
    const source = sourceLocale ? extractSource(i18n, sourceLocale) : null;

    if (!source) {
      skipped++;
      continue;
    }

    sidecar[slug] = sidecar[slug] || {};
    for (const locale of TARGET_LOCALES) {
      // 用户已手填该语种 → 保留，不机翻
      if (i18n[locale] && Object.keys(i18n[locale]).length) {
        continue;
      }
      const cacheKey = `${locale}:${hash(JSON.stringify(source))}`;
      let result = cache[cacheKey];
      if (result) {
        reused++;
      } else {
        try {
          const t = await translateOne(source, locale);
          result = sanitize(t, source);
          cache[cacheKey] = result;
          translated++;
        } catch (e) {
          console.warn(`[translate] ${slug} -> ${locale} 失败，跳过:`, e.message);
          continue;
        }
      }
      sidecar[slug][locale] = result;
    }
  }

  saveCache(cache);
  writeFileSync(SIDECAR, JSON.stringify(sidecar, null, 2));
  console.log(
    `[translate] 完成：新翻译 ${translated}，缓存复用 ${reused}，跳过 ${skipped} 个无源文本产品。`
  );
}

main().catch((e) => {
  // 任何致命错误都不阻断构建：写空侧车，交给回退逻辑
  console.error('[translate] 脚本异常，跳过机翻:', e.message);
  try {
    writeFileSync(SIDECAR, JSON.stringify({}, null, 2));
  } catch {}
  process.exit(0);
});
