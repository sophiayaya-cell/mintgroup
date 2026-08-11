// 产品页 FAQ 结构化数据（GEO / 富媒体搜索结果核心）
// 其余语种（西/阿/德/法/日/韩/俄）回退英文；后续可逐语种补全
type LText = { zh: string; en: string };

export const PRODUCT_FAQ: { q: LText; a: LText }[] = [
  {
    q: {
      zh: '你们的最小起订量（MOQ）是多少？',
      en: 'What is your minimum order quantity (MOQ)?',
    },
    a: {
      zh: '通常为一个 20 尺集装箱起订，首次试样订单数量可协商。具体视产品规格而定。',
      en: 'Typically one 20ft container as the minimum; the first trial order quantity is negotiable depending on the product specification.',
    },
  },
  {
    q: {
      zh: '你们支持 OEM / ODM 定制吗？',
      en: 'Do you support OEM / ODM customization?',
    },
    a: {
      zh: '支持。我们提供 OEM / ODM 服务，可按需定制尺寸、材质、包装并支持自有品牌贴牌。',
      en: 'Yes. We provide OEM / ODM services with customized sizes, materials, packaging and private labeling.',
    },
  },
  {
    q: {
      zh: '产品有哪些认证？',
      en: 'What certifications do your products have?',
    },
    a: {
      zh: '我们的生产体系通过 ISO 9001 等质量管理认证，产品可按目标市场要求提供相应检测报告。具体认证以实际为准（待补充完整清单）。',
      en: 'Our production system is certified under ISO 9001 and related quality management standards; product test reports can be provided per target-market requirements. The full certificate list is to be confirmed.',
    },
  },
  {
    q: {
      zh: '典型交期是多久？',
      en: 'What is the typical lead time?',
    },
    a: {
      zh: '通常在订单确认并收到定金后 15–30 天内发货，具体视订单量与定制要求而定。',
      en: 'Usually 15–30 days after order confirmation and deposit, depending on order volume and customization.',
    },
  },
];
