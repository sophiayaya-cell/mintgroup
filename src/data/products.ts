import type { I18n } from '../i18n/util';

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
  i18n: I18n<Omit<ProductI18n, 'specs'> & { specs?: RawSpec[] }>;
}

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
    return { slug: f.slug, category: f.category, image: f.image, i18n };
  })
  .sort((a, b) => a.slug.localeCompare(b.slug));

// 去重后的分类列表（供产品页筛选使用；相同 category 字符串自动归为一类）
export const PRODUCT_CATEGORIES: string[] = Array.from(
  new Set(PRODUCTS.map((p) => p.category).filter((c): c is string => Boolean(c)))
);
