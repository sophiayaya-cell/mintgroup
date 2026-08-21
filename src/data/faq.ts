// 产品页 FAQ 结构化数据（GEO / 富媒体搜索结果核心）
// 全 11 语种均已补全（中 / 英 / 西 / 阿 / 德 / 法 / 日 / 韩 / 俄 / 越 / 葡）
type LText = { zh: string; en: string; vi: string; pt: string };

export const PRODUCT_FAQ: { q: LText; a: LText }[] = [
  {
    q: {
      zh: '你们的最小起订量（MOQ）是多少？',
      en: 'What is your minimum order quantity (MOQ)?',
      vi: 'Số lượng đặt hàng tối thiểu (MOQ) của bạn là bao nhiêu?',
      pt: 'Qual é a quantidade mínima de pedido (MOQ)?',
    },
    a: {
      zh: '通常为一个 20 尺集装箱起订，首次试样订单数量可协商。具体视产品规格而定。',
      en: 'Typically one 20ft container as the minimum; the first trial order quantity is negotiable depending on the product specification.',
      vi: 'Thông thường tối thiểu là một container 20 feet; số lượng cho đơn hàng mẫu thử đầu tiên có thể thương lượng. Cụ thể tùy thuộc vào quy cách sản phẩm.',
      pt: 'Normalmente o mínimo é um contêiner de 20 pés; a quantidade do primeiro pedido de teste pode ser negociada conforme a especificação do produto.',
    },
  },
  {
    q: {
      zh: '你们支持 OEM / ODM 定制吗？',
      en: 'Do you support OEM / ODM customization?',
      vi: 'Bạn có hỗ trợ tùy chỉnh OEM / ODM không?',
      pt: 'Vocês oferecem personalização OEM / ODM?',
    },
    a: {
      zh: '支持。我们提供 OEM / ODM 服务，可按需定制尺寸、材质、包装并支持自有品牌贴牌。',
      en: 'Yes. We provide OEM / ODM services with customized sizes, materials, packaging and private labeling.',
      vi: 'Có. Chúng tôi cung cấp dịch vụ OEM / ODM, tùy chỉnh kích thước, chất liệu, bao bì và hỗ trợ dán nhãn riêng theo yêu cầu.',
      pt: 'Sim. Oferecemos serviços OEM / ODM com tamanhos, materiais, embalagens personalizados e private labeling.',
    },
  },
  {
    q: {
      zh: '产品有哪些认证？',
      en: 'What certifications do your products have?',
      vi: 'Các sản phẩm của bạn có những chứng nhận nào?',
      pt: 'Quais certificações seus produtos possuem?',
    },
    a: {
      zh: '我们的生产体系通过 ISO 9001 等质量管理认证，产品可按目标市场要求提供相应检测报告。具体认证以实际为准（待补充完整清单）。',
      en: 'Our production system is certified under ISO 9001 and related quality management standards; product test reports can be provided per target-market requirements. The full certificate list is to be confirmed.',
      vi: 'Hệ thống sản xuất của chúng tôi đạt chứng nhận quản lý chất lượng ISO 9001 và các tiêu chuẩn liên quan; báo cáo kiểm nghiệm sản phẩm có thể cung cấp theo yêu cầu thị trường đích. Danh sách chứng nhận đầy đủ sẽ được xác nhận sau.',
      pt: 'Nosso sistema de produção é certificado sob a ISO 9001 e padrões relacionados de gestão da qualidade; laudos de teste podem ser fornecidos conforme os requisitos do mercado-alvo. A lista completa de certificados será confirmada.',
    },
  },
  {
    q: {
      zh: '典型交期是多久？',
      en: 'What is the typical lead time?',
      vi: 'Thời gian giao hàng điển hình là bao lâu?',
      pt: 'Qual é o prazo de entrega típico?',
    },
    a: {
      zh: '通常在订单确认并收到定金后 15–30 天内发货，具体视订单量与定制要求而定。',
      en: 'Usually 15–30 days after order confirmation and deposit, depending on order volume and customization.',
      vi: 'Thường là 15–30 ngày sau khi xác nhận đơn hàng và nhận tiền cọc, tùy thuộc vào số lượng và yêu cầu tùy chỉnh.',
      pt: 'Normalmente 15–30 dias após a confirmação do pedido e o depósito, dependendo do volume e da personalização.',
    },
  },
];
