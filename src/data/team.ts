import type { I18n } from '../i18n/util';

export interface MemberI18n {
  name: string;
  role: string;
  bio: string;
}

export interface Member {
  id: string;
  order?: number;
  i18n: I18n<MemberI18n>;
}

interface MemberFile {
  id: string;
  order?: number;
  i18n: I18n<MemberI18n>;
}

// 团队成员由 Decap CMS 在 content/team/*.json 中编辑（后台 /admin）。
// 此处仅负责在构建时把它们聚合为 TEAM 数组，供团队页消费。
const modules = import.meta.glob('../../content/team/*.json', {
  eager: true,
}) as Record<string, { default: MemberFile }>;

export const TEAM: Member[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => (a.order ?? 999) - (b.order ?? 999)); // order 小的排前面
