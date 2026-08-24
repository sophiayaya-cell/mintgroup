/**
 * Mint Sales System - 获客连接器 (Phase 2)
 *
 * 三类线索来源的真实感实现：
 *   1. 贸易目录 (Trade Directory)  - Europages / Kompass / 行业黄页类买家库
 *   2. LinkedIn                    - 采购 / 寻源 / 供应链职位联系人
 *   3. 海关数据 (Customs)          - HS 5603 进口商 + 进口活跃度信号
 *
 * 每个连接器都基于与用户业务（覆膜/纺粘无纺布，HS 5603.93/5603.94）匹配的种子数据集，
 * 并预留真实第三方 API 调用骨架（含密钥接入点，生产环境通过 wrangler secret 注入）。
 */

export type SourceType = 'directory' | 'linkedin' | 'customs';
export type ProductCategory = 'laminated' | 'spunbond' | 'both' | 'general';
export type CompanySize = 'small' | 'medium' | 'large' | 'enterprise';

export interface LeadContact {
  first_name: string;
  last_name: string;
  title: string;
  seniority: 'exec' | 'manager' | 'ic';
}

export interface LeadCandidate {
  company_name: string;
  country: string;
  country_code: string;
  website: string | null;
  industry: string;
  company_size: CompanySize | null;
  linkedin_url: string | null;
  description: string;
  product_category: ProductCategory;
  hs_code: string;
  /** 海关进口活跃度 0-100，仅 customs 来源有值 */
  import_signals: number;
  source_type: SourceType;
  source_ref: string;
  contacts: LeadContact[];
}

export interface SearchFilters {
  country?: string;
  product_category?: ProductCategory;
  industry?: string;
  size?: CompanySize;
  /** 关键词，匹配公司名/描述/行业 */
  keyword?: string;
}

// ============================================================
//  种子数据集 (与用户业务匹配的潜在买家库)
//  覆盖现有 11 国 + 扩张候选国，专注无纺布下游（卫生/医疗/包装/农业/擦拭/过滤）
// ============================================================
interface SeedCompany {
  company_name: string;
  country: string;
  country_code: string;
  website: string;
  industry: string;
  company_size: CompanySize;
  description: string;
  product_category: ProductCategory;
  contacts: LeadContact[];
  /** 海关进口活跃度（仅用于 customs 连接器） */
  import_signals: number;
}

const SEED: SeedCompany[] = [
  {
    company_name: 'HygienePro Manufacturing LLC', country: 'United States', country_code: 'US',
    website: 'hygienepro.com', industry: 'Baby & Adult Hygiene', company_size: 'large',
    description: '美国中西部婴儿纸尿裤与成人失禁用品制造商，月耗无纺布 400+ 吨。',
    product_category: 'both', import_signals: 82,
    contacts: [
      { first_name: 'Sarah', last_name: 'Mitchell', title: 'VP Procurement', seniority: 'exec' },
      { first_name: 'David', last_name: 'Chen', title: 'Sourcing Manager', seniority: 'manager' },
    ],
  },
  {
    company_name: 'MedGuard Supplies GmbH', country: 'Germany', country_code: 'DE',
    website: 'medguard.de', industry: 'Medical Disposables', company_size: 'large',
    description: '德国医疗耗材商，手术衣/口罩/敷料产线，认证齐全（CE/ISO13485）。',
    product_category: 'spunbond', import_signals: 76,
    contacts: [
      { first_name: 'Klaus', last_name: 'Bauer', title: 'Head of Sourcing', seniority: 'exec' },
      { first_name: 'Anna', last_name: 'Schulz', title: 'Supply Chain Lead', seniority: 'manager' },
    ],
  },
  {
    company_name: 'TemizWipe Sanayi A.Ş.', country: 'Turkey', country_code: 'TR',
    website: 'temizwipe.com.tr', industry: 'Wipes & Cleaning', company_size: 'medium',
    description: '土耳其湿巾与工业擦拭布制造商，出口欧洲与中东。',
    product_category: 'spunbond', import_signals: 71,
    contacts: [
      { first_name: 'Mehmet', last_name: 'Yilmaz', title: 'Procurement Director', seniority: 'exec' },
    ],
  },
  {
    company_name: 'SunCare Hygiene Pvt Ltd', country: 'India', country_code: 'IN',
    website: 'suncarehygiene.in', industry: 'Feminine Care', company_size: 'large',
    description: '印度女性护理与卫生巾制造商，本土+出口双线，扩产中。',
    product_category: 'both', import_signals: 68,
    contacts: [
      { first_name: 'Priya', last_name: 'Nair', title: 'Materials Manager', seniority: 'manager' },
      { first_name: 'Raj', last_name: 'Kumar', title: 'Founder & CEO', seniority: 'exec' },
    ],
  },
  {
    company_name: 'BioPack Brasil Ltda', country: 'Brazil', country_code: 'BR',
    website: 'biopack.com.br', industry: 'Packaging', company_size: 'medium',
    description: '巴西可降解包装与覆膜袋生产商，主打环保无纺布复合膜。',
    product_category: 'laminated', import_signals: 64,
    contacts: [
      { first_name: 'Lucas', last_name: 'Silva', title: 'Sourcing Manager', seniority: 'manager' },
    ],
  },
  {
    company_name: 'Limpieza Total S.A. de C.V.', country: 'Mexico', country_code: 'MX',
    website: 'limpiezatotal.mx', industry: 'Wipes & Cleaning', company_size: 'medium',
    description: '墨西哥家用与商用湿巾制造商，北美供应链。',
    product_category: 'spunbond', import_signals: 59,
    contacts: [
      { first_name: 'Jorge', last_name: 'Ramirez', title: 'Compras (Purchasing)', seniority: 'manager' },
    ],
  },
  {
    company_name: 'VinaNonwoven Co., Ltd', country: 'Vietnam', country_code: 'VN',
    website: 'vinanonwoven.vn', industry: 'Hygiene Convertor', company_size: 'large',
    description: '越南卫生用品代工与转换商，为国际品牌做纸尿裤/经期裤。',
    product_category: 'both', import_signals: 73,
    contacts: [
      { first_name: 'Linh', last_name: 'Tran', title: 'Supply Chain Director', seniority: 'exec' },
      { first_name: 'Hoa', last_name: 'Nguyen', title: 'Raw Material Buyer', seniority: 'ic' },
    ],
  },
  {
    company_name: 'GreenField Agro Indonesia', country: 'Indonesia', country_code: 'ID',
    website: 'greenfieldagro.id', industry: 'Agriculture', company_size: 'medium',
    description: '印尼农用覆膜与作物保护无纺布分销商，覆盖爪哇种植园。',
    product_category: 'laminated', import_signals: 55,
    contacts: [
      { first_name: 'Budi', last_name: 'Santoso', title: 'Procurement Head', seniority: 'manager' },
    ],
  },
  {
    company_name: 'PolHygienika Sp. z o.o.', country: 'Poland', country_code: 'PL',
    website: 'polhygienika.pl', industry: 'Baby & Adult Hygiene', company_size: 'large',
    description: '波兰卫生用品龙头，欧洲主要纸尿裤与失禁产品供应商。',
    product_category: 'both', import_signals: 78,
    contacts: [
      { first_name: 'Piotr', last_name: 'Nowak', title: 'Category Sourcing Manager', seniority: 'manager' },
      { first_name: 'Katarzyna', last_name: 'Wilk', title: 'Procurement Director', seniority: 'exec' },
    ],
  },
  {
    company_name: 'Higiene Iberia S.L.', country: 'Spain', country_code: 'ES',
    website: 'higieneiberia.es', industry: 'Feminine Care', company_size: 'medium',
    description: '西班牙女性护理与私护品牌商，南欧分销网络。',
    product_category: 'spunbond', import_signals: 61,
    contacts: [
      { first_name: 'Lucia', last_name: 'Garcia', title: 'Sourcing Lead', seniority: 'manager' },
    ],
  },
  {
    company_name: 'Nippon MediTex K.K.', country: 'Japan', country_code: 'JP',
    website: 'medi-tex.jp', industry: 'Medical Disposables', company_size: 'large',
    description: '日本高端医疗无纺布制品商，手术铺单与防护耗材。',
    product_category: 'spunbond', import_signals: 70,
    contacts: [
      { first_name: 'Kenji', last_name: 'Tanaka', title: '購買部長 (Procurement GM)', seniority: 'exec' },
    ],
  },
  {
    company_name: 'GulfCare Trading LLC', country: 'United Arab Emirates', country_code: 'AE',
    website: 'gulfcare.ae', industry: 'Distribution', company_size: 'medium',
    description: '阿联酋卫生与医疗用品分销商，GCC 六国渠道。',
    product_category: 'both', import_signals: 66,
    contacts: [
      { first_name: 'Omar', last_name: 'AlFarsi', title: 'Head of Imports', seniority: 'exec' },
    ],
  },
  {
    company_name: 'ItaliaSoft S.r.l.', country: 'Italy', country_code: 'IT',
    website: 'italiasoft.it', industry: 'Filtration', company_size: 'small',
    description: '意大利空气/液体过滤无纺布与滤材加工商。',
    product_category: 'spunbond', import_signals: 52,
    contacts: [
      { first_name: 'Marco', last_name: 'Rossi', title: 'Owner', seniority: 'exec' },
    ],
  },
  {
    company_name: 'CleanWave UK Ltd', country: 'United Kingdom', country_code: 'GB',
    website: 'cleanwave.co.uk', industry: 'Wipes & Cleaning', company_size: 'medium',
    description: '英国可持续湿巾与消毒擦拭品牌，零售+电商。',
    product_category: 'spunbond', import_signals: 57,
    contacts: [
      { first_name: 'Emma', last_name: 'Thompson', title: 'Head of Supply', seniority: 'manager' },
    ],
  },
  {
    company_name: 'KoreaHygiene Co., Ltd', country: 'South Korea', country_code: 'KR',
    website: 'koreahygiene.kr', industry: 'Baby & Adult Hygiene', company_size: 'large',
    description: '韩国卫生用品制造商，本土强势+亚洲出口。',
    product_category: 'both', import_signals: 74,
    contacts: [
      { first_name: 'Jiwoo', last_name: 'Park', title: 'Procurement Team Leader', seniority: 'manager' },
    ],
  },
  {
    company_name: 'NileCare Egypt Co.', country: 'Egypt', country_code: 'EG',
    website: 'nilecare.com.eg', industry: 'Medical Disposables', company_size: 'medium',
    description: '埃及医疗与卫生耗材制造商，北非与中东市场。',
    product_category: 'spunbond', import_signals: 60,
    contacts: [
      { first_name: 'Youssef', last_name: 'Hassan', title: 'Sourcing Manager', seniority: 'manager' },
    ],
  },
  {
    company_name: 'AfriPack Industries Ltd', country: 'Nigeria', country_code: 'NG',
    website: 'afripack.com.ng', industry: 'Packaging', company_size: 'medium',
    description: '尼日利亚包装与农业覆膜无纺布加工商，西非渠道。',
    product_category: 'laminated', import_signals: 48,
    contacts: [
      { first_name: 'Chidi', last_name: 'Okoro', title: 'Operations Director', seniority: 'exec' },
    ],
  },
  {
    company_name: 'Andina Wipes S.A.S.', country: 'Colombia', country_code: 'CO',
    website: 'andinawipes.co', industry: 'Wipes & Cleaning', company_size: 'small',
    description: '哥伦比亚湿巾与私护制造商，安第斯区域。',
    product_category: 'spunbond', import_signals: 51,
    contacts: [
      { first_name: 'Camila', last_name: 'Torres', title: 'Compras', seniority: 'ic' },
    ],
  },
  {
    company_name: 'ThaiNonwoven Convertor Co', country: 'Thailand', country_code: 'TH',
    website: 'thainonwoven.co.th', industry: 'Hygiene Convertor', company_size: 'large',
    description: '泰国卫生用品转换商，东南亚代工与自有品牌。',
    product_category: 'both', import_signals: 69,
    contacts: [
      { first_name: 'Somchai', last_name: 'Phan', title: 'Supply Chain Manager', seniority: 'manager' },
    ],
  },
  {
    company_name: 'FilterTech France SARL', country: 'France', country_code: 'FR',
    website: 'filtertech.fr', industry: 'Filtration', company_size: 'medium',
    description: '法国工业过滤无纺布与复合滤材开发商。',
    product_category: 'laminated', import_signals: 58,
    contacts: [
      { first_name: 'Sophie', last_name: 'Martin', title: 'Directrice Achats', seniority: 'exec' },
    ],
  },
  {
    company_name: 'BalticHygiene OÜ', country: 'Estonia', country_code: 'EE',
    website: 'baltichygiene.ee', industry: 'Feminine Care', company_size: 'small',
    description: '爱沙尼亚女性护理品牌商，波罗的海电商。',
    product_category: 'spunbond', import_signals: 44,
    contacts: [
      { first_name: 'Liis', last_name: 'Kask', title: 'Founder', seniority: 'exec' },
    ],
  },
  {
    company_name: 'Sahara Medical Supplies', country: 'Saudi Arabia', country_code: 'SA',
    website: 'saharamed.com.sa', industry: 'Medical Disposables', company_size: 'large',
    description: '沙特医疗耗材分销商与本地化生产，海湾渠道。',
    product_category: 'spunbond', import_signals: 67,
    contacts: [
      { first_name: 'Abdullah', last_name: 'AlQahtani', title: 'Import Manager', seniority: 'manager' },
    ],
  },
  {
    company_name: 'PacificWipes NZ Ltd', country: 'New Zealand', country_code: 'NZ',
    website: 'pacificwipes.nz', industry: 'Wipes & Cleaning', company_size: 'small',
    description: '新西兰天然成分湿巾品牌，澳新市场。',
    product_category: 'spunbond', import_signals: 46,
    contacts: [
      { first_name: 'Olivia', last_name: 'Bennett', title: 'Operations Manager', seniority: 'manager' },
    ],
  },
  {
    company_name: 'Maghreb Hygiene Group', country: 'Morocco', country_code: 'MA',
    website: 'maghrebhg.ma', industry: 'Baby & Adult Hygiene', company_size: 'medium',
    description: '摩洛哥卫生用品制造商，北非与南欧出口。',
    product_category: 'both', import_signals: 63,
    contacts: [
      { first_name: 'Yasmin', last_name: 'Bennani', title: 'Achats (Purchasing)', seniority: 'manager' },
    ],
  },
  {
    company_name: 'Caspian Filter Co.', country: 'Iran', country_code: 'IR',
    website: 'caspianfilter.ir', industry: 'Filtration', company_size: 'medium',
    description: '伊朗工业与汽车过滤无纺布制造商。',
    product_category: 'laminated', import_signals: 50,
    contacts: [
      { first_name: 'Reza', last_name: 'Ahmadi', title: 'Procurement Chief', seniority: 'exec' },
    ],
  },
  {
    company_name: 'AndesPack Peru S.A.C.', country: 'Peru', country_code: 'PE',
    website: 'andespack.pe', industry: 'Packaging', company_size: 'small',
    description: '秘鲁农业覆膜与包装无纺布分销商，安第斯区域。',
    product_category: 'laminated', import_signals: 47,
    contacts: [
      { first_name: 'Diego', last_name: 'Quispe', title: 'Gerente de Compras', seniority: 'manager' },
    ],
  },
  {
    company_name: 'UkraineMedTrade', country: 'Ukraine', country_code: 'UA',
    website: 'uamedtrade.ua', industry: 'Medical Disposables', company_size: 'medium',
    description: '乌克兰医疗耗材进口与分销，东欧重建需求。',
    product_category: 'spunbond', import_signals: 54,
    contacts: [
      { first_name: 'Olena', last_name: 'Kovalenko', title: 'Import Specialist', seniority: 'ic' },
    ],
  },
  {
    company_name: 'Balkan Hygiene DOO', country: 'Serbia', country_code: 'RS',
    website: 'balkanhygiene.rs', industry: 'Baby & Adult Hygiene', company_size: 'small',
    description: '塞尔维亚卫生用品制造商，巴尔干市场。',
    product_category: 'both', import_signals: 49,
    contacts: [
      { first_name: 'Marko', last_name: 'Jovic', title: 'Owner', seniority: 'exec' },
    ],
  },
  {
    company_name: 'LankaNonwoven Pvt Ltd', country: 'Sri Lanka', country_code: 'LK',
    website: 'lankanonwoven.lk', industry: 'Hygiene Convertor', company_size: 'medium',
    description: '斯里兰卡卫生用品转换商，南亚出口。',
    product_category: 'both', import_signals: 56,
    contacts: [
      { first_name: 'Nimal', last_name: 'Perera', title: 'Sourcing Lead', seniority: 'manager' },
    ],
  },
  {
    company_name: 'CaribPack Jamaica Ltd', country: 'Jamaica', country_code: 'JM',
    website: 'caribpack.jm', industry: 'Packaging', company_size: 'small',
    description: '牙买加农业覆膜与包装无纺布进口商，加勒比渠道。',
    product_category: 'laminated', import_signals: 43,
    contacts: [
      { first_name: 'Shanique', last_name: 'Brown', title: 'Procurement Officer', seniority: 'ic' },
    ],
  },
  {
    company_name: 'Nordic EcoWipe AB', country: 'Sweden', country_code: 'SE',
    website: 'ecoewipe.se', industry: 'Wipes & Cleaning', company_size: 'medium',
    description: '瑞典可持续湿巾品牌，北欧零售与电商。',
    product_category: 'spunbond', import_signals: 62,
    contacts: [
      { first_name: 'Erik', last_name: 'Lindberg', title: 'Head of Sourcing', seniority: 'manager' },
    ],
  },
  {
    company_name: 'MenaFilter Trading', country: 'Jordan', country_code: 'JO',
    website: 'menafilter.jo', industry: 'Filtration', company_size: 'small',
    description: '约旦工业过滤无纺布贸易商，中东渠道。',
    product_category: 'laminated', import_signals: 45,
    contacts: [
      { first_name: 'Layla', last_name: 'Haddad', title: 'General Manager', seniority: 'exec' },
    ],
  },
];

// ============================================================
//  连接器
// ============================================================

function applyFilters(list: SeedCompany[], f: SearchFilters): SeedCompany[] {
  return list.filter((c) => {
    if (f.country && c.country !== f.country && c.country_code !== f.country) return false;
    if (f.product_category) {
      if (f.product_category === 'both') {
        if (c.product_category !== 'both') return false;
      } else if (c.product_category !== f.product_category && c.product_category !== 'both') {
        return false;
      }
    }
    if (f.industry && c.industry !== f.industry) return false;
    if (f.size && c.company_size !== f.size) return false;
    if (f.keyword) {
      const kw = f.keyword.toLowerCase();
      const hay = (c.company_name + ' ' + c.description + ' ' + c.industry).toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

function toCandidate(c: SeedCompany, source_type: SourceType, source_ref: string): LeadCandidate {
  return {
    company_name: c.company_name,
    country: c.country,
    country_code: c.country_code,
    website: c.website,
    industry: c.industry,
    company_size: c.company_size,
    linkedin_url: null,
    description: c.description,
    product_category: c.product_category,
    hs_code: '5603.93',
    import_signals: source_type === 'customs' ? c.import_signals : 0,
    source_type,
    source_ref,
    // directory 来源只给公司级信息；linkedin/customs 带联系人
    contacts: source_type === 'directory' ? [] : c.contacts,
  };
}

/**
 * 贸易目录连接器
 * 真实接入点：Europages/Go4WorldBusiness/Kompass 等目录的搜索 API 或抓取层。
 * 生产环境把下面 SEED 替换为 fetch(目录 API) 即可，返回结构需归一化为 LeadCandidate。
 */
export async function directoryConnector(filters: SearchFilters): Promise<LeadCandidate[]> {
  // TODO(prod): const res = await fetch(`https://api.europages.com/v1/companies?...&apikey=${ENV.DIRECTORY_API_KEY}`);
  const matched = applyFilters(SEED, filters);
  return matched.map((c) => toCandidate(c, 'directory', 'trade_directory'));
}

/**
 * LinkedIn 连接器
 * 真实接入点：LinkedIn / Sales Navigator 导出，或 Phantombuster/Zoominfo 类工具。
 * 重点产出「带职位的联系人」，便于后续外联自动化触达具体人。
 */
export async function linkedinConnector(filters: SearchFilters): Promise<LeadCandidate[]> {
  // TODO(prod): 通过 LinkedIn 营销 API / 数据供应商拉取「公司 + 采购/寻源联系人」
  const matched = applyFilters(SEED, filters);
  return matched.map((c) => {
    const cand = toCandidate(c, 'linkedin', 'linkedin_search');
    cand.linkedin_url = `https://www.linkedin.com/company/${c.website.replace(/\./g, '')}`;
    return cand;
  });
}

/**
 * 海关数据连接器
 * 真实接入点：ImportGenius / Panjiva / 海关数据供应商，按 HS 5603 查询中国出口到目标国的进口商。
 * 重点产出 import_signals（进口频次/吨位归一化），是评分里权重最高信号之一。
 */
export async function customsConnector(filters: SearchFilters): Promise<LeadCandidate[]> {
  // TODO(prod): const res = await fetch(`https://api.importgenius.com/v1/imports?hs_code=5603.93&dest=${...}&key=${ENV.CUSTOMS_API_KEY}`);
  const matched = applyFilters(SEED, filters);
  // customs 来源按进口活跃度排序，越高越优先
  return matched
    .sort((a, b) => b.import_signals - a.import_signals)
    .map((c) => toCandidate(c, 'customs', 'customs_data'));
}

export const CONNECTORS: Record<SourceType, (f: SearchFilters) => Promise<LeadCandidate[]>> = {
  directory: directoryConnector,
  linkedin: linkedinConnector,
  customs: customsConnector,
};

export function getSourceLabel(t: SourceType): string {
  return { directory: '贸易目录', linkedin: 'LinkedIn', customs: '海关数据' }[t];
}
