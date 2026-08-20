// 把 baby-diapers.json 的 7 个目标语种按中文(农用无纺布)强制重翻，覆盖旧的“婴儿纸尿裤”译文。
// 走 curl（沙箱里 Node fetch 连不上外网，curl 可通），带重试扛 Windows schannel 抖动。
import { readFileSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';

const ROOT = process.cwd();
const FILE = join(ROOT, 'content/products/baby-diapers.json');
const API = 'https://api.mymemory.translated.net/get';
const TARGETS = ['es', 'ar', 'de', 'fr', 'ja', 'ko', 'ru'];

function translateText(text, target) {
  const tmp = join(ROOT, '.mm-req.tmp');
  writeFileSync(tmp, String(text));
  const attempt = (n) => {
    try {
      const out = execFileSync(
        'curl',
        [
          '-sS', '-m', '25', '--retry', '5', '--retry-all-errors', '--retry-delay', '1',
          '-G', API,
          '--data-urlencode', `q@${tmp}`,
          '--data-urlencode', `langpair=zh|${target}`,
        ],
        { maxBuffer: 8 * 1024 * 1024, timeout: 35000 }
      ).toString('utf8');
      const j = JSON.parse(out);
      const t = j?.responseData?.translatedText;
      if (!t) throw new Error('空翻译');
      if (/MYMEMORY WARNING/i.test(t)) throw new Error('QUOTA_EXHAUSTED:' + t.slice(0, 60));
      return t;
    } catch (e) {
      if (n <= 1) throw e;
      return attempt(n - 1);
    }
  };
  try {
    return attempt(3);
  } finally {
    try { execFileSync('rm', ['-f', tmp]); } catch {}
  }
}

function deepTranslate(node, target) {
  if (typeof node === 'string') return translateText(node, target);
  if (Array.isArray(node)) return node.map((x) => deepTranslate(x, target));
  if (node && typeof node === 'object') {
    const o = {};
    for (const k of Object.keys(node)) o[k] = deepTranslate(node[k], target);
    return o;
  }
  return node;
}

const raw = JSON.parse(readFileSync(FILE, 'utf8'));
const zh = raw.i18n.zh;
for (const loc of TARGETS) {
  if (!raw.i18n[loc]) raw.i18n[loc] = {};
  raw.i18n[loc] = deepTranslate(zh, loc);
  console.log(`✓ ${loc}: ${raw.i18n[loc].name}`);
}
writeFileSync(FILE, JSON.stringify(raw, null, 2) + '\n');
console.log('已写回', FILE);
