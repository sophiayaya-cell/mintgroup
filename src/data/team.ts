import type { I18n } from '../i18n/util';

export interface MemberI18n {
  name: string;
  role: string;
  bio: string;
}

export interface Member {
  id: string;
  i18n: I18n<MemberI18n>;
}

export const TEAM: Member[] = [
  {
    id: 'zhang-ming',
    i18n: {
      zh: {
        name: '张明',
        role: '研发中心负责人',
        bio: '拥有 15 年卫生用品研发经验，主导多项核心吸收材料专利。',
      },
      en: {
        name: 'Zhang Ming',
        role: 'Head of R&D',
        bio: '15 years of hygiene product R&D experience, leading multiple core absorbent material patents.',
      },
    },
  },
  {
    id: 'li-na',
    i18n: {
      zh: {
        name: '李娜',
        role: '生产总监',
        bio: '统筹智能制造与精益生产，推动产能与良率双提升。',
      },
      en: {
        name: 'Li Na',
        role: 'Production Director',
        bio: 'Oversees smart manufacturing and lean production, driving gains in both capacity and yield.',
      },
    },
  },
  {
    id: 'wang-qiang',
    i18n: {
      zh: {
        name: '王强',
        role: '质量管控经理',
        bio: '建立全流程可追溯品控体系，守护每一件产品的安全。',
      },
      en: {
        name: 'Wang Qiang',
        role: 'Quality Control Manager',
        bio: 'Built an end-to-end traceable QC system, safeguarding the safety of every product.',
      },
    },
  },
  {
    id: 'chen-jing',
    i18n: {
      zh: {
        name: '陈静',
        role: '海外业务经理',
        bio: '深耕国际市场，为多语种客户提供本地化合规与服务支持。',
      },
      en: {
        name: 'Chen Jing',
        role: 'Overseas Business Manager',
        bio: 'Deeply engaged in international markets, providing localized compliance and service support for multilingual clients.',
      },
    },
  },
];
