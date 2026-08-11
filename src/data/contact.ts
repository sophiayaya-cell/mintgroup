import type { Locale } from '../i18n/ui';

// 公司联系信息（集中管理，9 语种联系页统一读取）
export const CONTACT = {
  address: {
    zh: '山东省淄博市张店区宏程国际广场17号楼1604室',
    en: 'Room 1604, Building 17, Hongcheng International Plaza, Zhangdian District, Zibo City, Shandong Province, China',
    es: 'Habitación 1604, Edificio 17, Plaza Internacional Hongcheng, Distrito de Zhangdian, Ciudad de Zibo, Provincia de Shandong, China',
    ar: 'الغرفة 1604، المبنى 17، بلازا هونغتشنغ الدولية، حي تشانغديان، مدينة زيبو، مقاطعة شاندونغ، الصين',
    de: 'Zimmer 1604, Gebäude 17, Hongcheng International Plaza, Bezirk Zhangdian, Stadt Zibo, Provinz Shandong, China',
    fr: 'Salle 1604, Bâtiment 17, Hongcheng International Plaza, District de Zhangdian, Ville de Zibo, Province du Shandong, Chine',
    ja: '中国山東省淄博市張店区宏程国際広場17号館1604室',
    ko: '중국 산동성 자보시 장뎬구 훙청 국제광장 17동 1604호',
    ru: 'комната 1604, здание 17, пл. Хунчэн Интернэшнл, район Чжандянь, город Цзыбо, провинция Шаньдун, Китай',
  },
  phone: '+86 18053308111',
  email: 'sophia.wang@mint-gp.com',
  whatsapp: '+86 18053308111',
  wechat: '+86 18053308111',
  website: 'https://www.mint-gp.com',
  // Facebook：username 用于拼接链接，name 用于展示
  facebook: 'MINTGROUP',
  facebookName: 'MINT GROUP',
  // 询盘表单：Web3Forms 免费接入（把线索直接发到你邮箱，无需后端）
  // 获取方式：打开 https://web3forms.com ，用 sophia.wang@mint-gp.com 注册即可得到 access key（免费、无需绑卡）
  // 拿到后把下面这串占位符替换成你的真实 key 即可，表单即刻生效。
  web3formsKey: '65e7cfcf-7f44-429e-98e9-04406ea5fe5a',
} as const;

export type ContactData = typeof CONTACT;
