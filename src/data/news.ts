import type { I18n } from '../i18n/util';

export interface NewsI18n {
  title: string;
  excerpt: string;
  body: { para: string }[];
}

export interface NewsArticle {
  slug: string;
  date: string; // ISO yyyy-mm-dd
  i18n: I18n<NewsI18n>;
}

interface NewsFile {
  slug: string;
  date: string;
  i18n: I18n<NewsI18n>;
}

// 新闻内容由 Decap CMS 在 content/news/*.json 中编辑（后台 /admin）。
// 此处仅负责在构建时把它们聚合为 NEWS 数组，供新闻列表 / 详情页消费。
const modules = import.meta.glob('../../content/news/*.json', {
  eager: true,
}) as Record<string, { default: NewsFile }>;

export const NEWS: NewsArticle[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => b.date.localeCompare(a.date)); // 最新的排在前面
