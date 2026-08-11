import type { I18n } from '../i18n/util';

export interface NewsI18n {
  title: string;
  excerpt: string;
  body: string[];
}

export interface NewsArticle {
  slug: string;
  date: string; // ISO yyyy-mm-dd
  i18n: I18n<NewsI18n>;
}

export const NEWS: NewsArticle[] = [
  {
    slug: 'new-automated-production-line',
    date: '2026-06-15',
    i18n: {
      zh: {
        title: '全新自动化生产线正式投产',
        excerpt: '公司引进的自动化卫生用品生产线已正式投产，产能与品控再升级。',
        body: [
          '为进一步提升产品一致性与交付能力，公司引进的全新自动化生产线已于本月正式投产。',
          '新产线集成了在线视觉检测与智能分拣，关键工序实现全流程可追溯，显著降低了人为误差。',
          '未来我们将持续投入智能制造，为全球客户提供更稳定、更安全的高品质卫生用品。',
        ],
      },
      en: {
        title: 'New Automated Production Line Goes Live',
        excerpt: 'Our newly introduced automated hygiene products line is now operational, upgrading both capacity and quality control.',
        body: [
          'To further improve product consistency and delivery capability, our newly introduced automated production line officially went into operation this month.',
          'The new line integrates inline visual inspection and intelligent sorting, making key processes fully traceable and significantly reducing human error.',
          'Moving forward, we will keep investing in smart manufacturing to deliver more stable, safer, high-quality hygiene products to customers worldwide.',
        ],
      },
    },
  },
  {
    slug: 'iso13485-certification',
    date: '2026-05-20',
    i18n: {
      zh: {
        title: '通过 ISO 13485 医疗器械质量管理体系认证',
        excerpt: '公司质量管理体系再获权威认可，医用护理产品合规性进一步增强。',
        body: [
          '经第三方权威机构审核，公司正式通过 ISO 13485 医疗器械质量管理体系认证。',
          '该认证标志着公司在医用护理产品的设计、生产与服务全过程，已建立与国际接轨的质量管理体系。',
          '我们将以此为新的起点，持续完善合规与品控，为客户与终端用户提供更可靠的保障。',
        ],
      },
      en: {
        title: 'Certified to ISO 13485 Quality Management System',
        excerpt: 'Our quality management system earns further recognition, strengthening compliance of medical care products.',
        body: [
          'Following audit by an accredited third-party organization, we have been officially certified to the ISO 13485 quality management system for medical devices.',
          'This certification confirms that our medical care product design, production and service processes follow an internationally aligned quality management system.',
          'We will take this as a new starting point, continuously improving compliance and quality control to provide more reliable assurance to customers and end users.',
        ],
      },
    },
  },
  {
    slug: 'global-export-milestone',
    date: '2026-04-10',
    i18n: {
      zh: {
        title: '产品出口突破 30 个国家和地区',
        excerpt: '凭借稳定的品质与本地化服务，我们的产品远销全球 30+ 市场。',
        body: [
          '依托稳定的产品品质与日益完善的本地化服务体系，公司产品已出口至全球 30 多个国家和地区。',
          '针对不同市场的法规与偏好，我们提供多语言资料与合规支持，帮助海外合作伙伴快速落地。',
          '感谢每一位客户的信任，我们期待与更多全球伙伴携手，将"自然呵护"带给世界。',
        ],
      },
      en: {
        title: 'Exports Surpass 30 Countries and Regions',
        excerpt: 'With consistent quality and localized service, our products now reach 30+ markets worldwide.',
        body: [
          'Relying on consistent product quality and an increasingly complete localized service system, our products are now exported to more than 30 countries and regions.',
          'For different markets’ regulations and preferences, we provide multilingual materials and compliance support to help overseas partners move fast.',
          'We thank every customer for their trust and look forward to working with more global partners to bring "Pure Care" to the world.',
        ],
      },
    },
  },
];
