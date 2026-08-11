import type { Locale } from '../i18n/ui';

// 公司联系信息（集中管理，9 语种联系页统一读取）
// 地址提供中文/英文，其余语种在 ContactInfo 组件中回退英文
export const CONTACT = {
  address: {
    zh: '山东省淄博市张店区宏程国际广场17号楼1604室',
    en: 'Room 1604, Building 17, Hongcheng International Plaza, Zhangdian District, Zibo City, Shandong Province, China',
  },
  phone: '+86 18053308111',
  email: 'sophia.wang@mint-gp.com',
  whatsapp: '+86 18053308111',
  wechat: '+86 18053308111',
  website: 'https://www.mint-gp.com',
  // Facebook：username 用于拼接链接，name 用于展示
  facebook: 'MINTGROUP',
  facebookName: 'MINT GROUP',
} as const;

export type ContactData = typeof CONTACT;
