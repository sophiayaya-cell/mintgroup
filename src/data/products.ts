import type { I18n } from '../i18n/util';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export interface ProductI18n {
  name: string;
  tagline: string;
  description: string;
  features: string[];
  specs: { label: string; value: string }[];
}

export interface Product {
  slug: string;
  category?: string;
  image?: string;
  i18n: I18n<ProductI18n>;
}

// Decap 后台的 specs 列表字段（list + object）会输出嵌套结构 { spec: { label, value } }，
// 而手写/旧数据可能是扁平结构 { label, value }。这里统一压平成 { label, value }，
// 使详情页渲染一致、且类型安全（详情页只读扁平结构）。
type RawSpec =
  | { label?: string; value?: string }
  | { spec?: { label?: string; value?: string } };

function normalizeSpec(s: RawSpec): { label: string; value: string } | null {
  if (s && 'spec' in s && s.spec) {
    return { label: s.spec.label ?? '', value: s.spec.value ?? '' };
  }
  if (s && 'label' in s) {
    return { label: s.label ?? '', value: s.value ?? '' };
  }
  return null;
}

function normalizeSpecs(raw?: RawSpec[]): { label: string; value: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeSpec)
    .filter(
      (s): s is { label: string; value: string } =>
        s !== null && (s.label !== '' || s.value !== '')
    );
}

interface RawProductFile {
  slug: string;
  category?: string;
  image?: string;
  // 构建前机翻会补齐其余语种；源文件只需中文（英文可选手填覆盖）
  i18n: Partial<Record<Locale, Omit<ProductI18n, 'specs'> & { specs?: RawSpec[] }>>;
}

type Locale = keyof I18n<unknown>;

// 构建前机翻脚本生成的合并侧车（content/products 仅中文源 + 机翻补齐）。
// 缺失语种用侧车补，绝不覆盖用户在后台手填的内容。无 KEY 时侧车为空，走回退。
// 注意：用 process.cwd() 解析而非 import.meta.url —— Astro 构建时会把本模块打包，
// import.meta.url 会指向打包产物目录，导致侧车找不到。项目根固定，从 cwd 解析最稳。
function loadTranslations(): Record<string, Record<string, ProductI18n>> {
  try {
    return JSON.parse(
      readFileSync(resolve(process.cwd(), 'src/data/.product-translations.json'), 'utf8')
    );
  } catch {
    return {};
  }
}
const TRANSLATIONS = loadTranslations();

// 产品内容由 Decap CMS 在 content/products/*.json 中编辑（后台 /admin）。
// 此处仅负责在构建时把它们聚合为 PRODUCTS 数组，供产品页 / 详情页消费。
const modules = import.meta.glob('../../content/products/*.json', {
  eager: true,
}) as Record<string, { default: RawProductFile }>;

export const PRODUCTS: Product[] = Object.values(modules)
  .map((m) => {
    const f = m.default;
    const i18n = Object.fromEntries(
      Object.entries(f.i18n).map(([loc, v]) => [
        loc,
        { ...v, specs: normalizeSpecs(v.specs) },
      ])
    ) as I18n<ProductI18n>;

    // 补齐机翻语种（仅当该语种在源文件中缺失时）
    const extra = TRANSLATIONS[f.slug];
    if (extra) {
      for (const [loc, t] of Object.entries(extra)) {
        if (!i18n[loc as Locale]) {
          i18n[loc as Locale] = { ...t, specs: normalizeSpecs(t.specs as RawSpec[]) };
        }
      }
    }

    return { slug: f.slug, category: f.category, image: f.image, i18n };
  })
  .sort((a, b) => a.slug.localeCompare(b.slug));

// 去重后的分类列表（供产品页筛选使用；相同 category 字符串自动归为一类）
export const PRODUCT_CATEGORIES: string[] = Array.from(
  new Set(PRODUCTS.map((p) => p.category).filter((c): c is string => Boolean(c)))
);
