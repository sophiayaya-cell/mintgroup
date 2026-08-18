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

// Decap 后台对 body 的存储可能出现两种形态：
//   1) 正常：[{ para: "段落" }, ...]   （list 嵌套 text 字段）
//   2) 异常：["整段文本", ...]          （字符串数组，常见于 slug 留空触发序列化时的旧数据）
// 详情页渲染依赖 b.para，若为字符串数组会得到 undefined → 正文空白。
// 这里统一归一化为 [{ para }]，使两种形态都能正常显示。
function normalizeBody(body: unknown): { para: string }[] {
  if (!Array.isArray(body)) return [];
  return body.map((b) => {
    if (b && typeof b === 'object' && 'para' in (b as Record<string, unknown>)) {
      const para = (b as { para: unknown }).para;
      return { para: typeof para === 'string' ? para : String(para ?? '') };
    }
    // 字符串数组形态
    return { para: typeof b === 'string' ? b : String(b ?? '') };
  });
}

function normalizeArticle(file: NewsFile): NewsArticle {
  const i18n = {} as I18n<NewsI18n>;
  for (const locale of Object.keys(file.i18n)) {
    const lang = file.i18n[locale];
    if (!lang) continue;
    i18n[locale] = {
      title: lang.title ?? '',
      excerpt: lang.excerpt ?? '',
      body: normalizeBody(lang.body),
    };
  }
  return {
    slug: file.slug || '',
    date: file.date || '',
    i18n,
  };
}

// 新闻内容由 Decap CMS 在 content/news/*.json 中编辑（后台 /admin）。
// 此处仅负责在构建时把它们聚合为 NEWS 数组，供新闻列表 / 详情页消费。
const modules = import.meta.glob('../../content/news/*.json', {
  eager: true,
}) as Record<string, { default: NewsFile }>;

export const NEWS: NewsArticle[] = Object.values(modules)
  .map((m) => normalizeArticle(m.default))
  .sort((a, b) => b.date.localeCompare(a.date)); // 最新的排在前面
