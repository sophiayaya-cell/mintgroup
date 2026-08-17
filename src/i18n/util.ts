import type { Locale } from './ui';

// 多语言字段：必须提供英文兜底，其余语种缺失时回退到英文
export type I18n<T> = Partial<Record<Locale, T>> & { en: T };

export function pick<T>(map: I18n<T>, locale: Locale): T {
  // 优先请求语种；缺失时回退英文，再回退中文（中文为源语言，保证永不出现 undefined）
  return map[locale] ?? map.en ?? map.zh;
}
