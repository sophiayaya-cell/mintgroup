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

interface ProductFile {
  slug: string;
  category?: string;
  image?: string;
  i18n: I18n<ProductI18n>;
}

// 产品内容由 Decap CMS 在 content/products/*.json 中编辑（后台 /admin）。
// 此处仅负责在构建时把它们聚合为 PRODUCTS 数组，供产品页 / 详情页消费。
const modules = import.meta.glob('../../content/products/*.json', {
  eager: true,
}) as Record<string, { default: ProductFile }>;

export const PRODUCTS: Product[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.slug.localeCompare(b.slug));

// 去重后的分类列表（供产品页筛选使用；相同 category 字符串自动归为一类）
export const PRODUCT_CATEGORIES: string[] = Array.from(
  new Set(PRODUCTS.map((p) => p.category).filter((c): c is string => Boolean(c)))
);
