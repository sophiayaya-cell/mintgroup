import type { I18n } from '../i18n/util';

export interface ProductI18n {
  name: string;
  tagline: string;
  description: string;
  features: string[];
  specs: { label: string; value: string }[];
}

export interface Product {
  slug: string;
  i18n: I18n<ProductI18n>;
}

export const PRODUCTS: Product[] = [
  {
    slug: 'medical-care-pads',
    i18n: {
      zh: {
        name: '医用护理垫',
        tagline: '柔软亲肤 · 高吸收，医疗与家庭护理的理想之选',
        description:
          '医用护理垫采用亲肤无纺布表层与高分子吸收芯体，快速锁液、不反渗，为医疗机构、家庭护理及术后康复场景提供安全、舒适的护理保障。',
        features: [
          '高吸收芯体，快速锁液不反渗',
          '亲肤无纺布表层，温和不刺激',
          '透气底膜，干爽不闷热',
          '医用级品控，安全放心',
        ],
        specs: [
          { label: '材质', value: '亲肤无纺布 + 高分子吸收芯' },
          { label: '适用场景', value: '医疗机构 / 家庭护理 / 术后康复' },
          { label: '认证', value: 'ISO 9001 / ISO 13485（示例）' },
        ],
      },
      en: {
        name: 'Medical Care Pads',
        tagline: 'Soft, skin-friendly and highly absorbent for medical and home care',
        description:
          'Our medical care pads combine a skin-friendly non-woven top sheet with a high-polymer absorbent core that locks liquid quickly without backflow, delivering safe and comfortable protection for clinics, home care and post-operative recovery.',
        features: [
          'High-polymer core locks liquid fast, no backflow',
          'Skin-friendly non-woven top sheet, gentle on skin',
          'Breathable backsheet keeps skin dry and fresh',
          'Medical-grade quality control for peace of mind',
        ],
        specs: [
          { label: 'Material', value: 'Soft non-woven + polymer absorbent core' },
          { label: 'Application', value: 'Clinics / Home care / Post-op recovery' },
          { label: 'Certification', value: 'ISO 9001 / ISO 13485 (sample)' },
        ],
      },
    },
  },
  {
    slug: 'baby-diapers',
    i18n: {
      zh: {
        name: '婴儿纸尿裤',
        tagline: '透气干爽，呵护宝宝娇嫩肌肤',
        description:
          '婴儿纸尿裤采用超薄透气结构与 3D 立体防漏隔边，配合瞬吸干爽表层，让宝宝远离红屁屁，活动更自在，整夜安睡无忧。',
        features: [
          '超薄透气，宝宝活动更自在',
          '3D 立体防漏隔边',
          '瞬吸干爽表层，远离红屁屁',
          '柔软魔术贴，反复粘贴',
        ],
        specs: [
          { label: '材质', value: '透气无纺布 + 瞬吸芯体' },
          { label: '适用场景', value: '婴幼儿日常 / 夜间护理' },
          { label: '认证', value: 'ISO 9001（示例）' },
        ],
      },
      en: {
        name: 'Baby Diapers',
        tagline: 'Breathable and dry, gentle on delicate baby skin',
        description:
          'Our baby diapers feature an ultra-thin breathable structure with 3D leak-guard barriers and a fast-absorbing dry top sheet that helps protect delicate skin from rashes, keeping babies comfortable and sleeping soundly through the night.',
        features: [
          'Ultra-thin and breathable for free movement',
          '3D leak-guard barriers',
          'Fast-absorbing dry top sheet, no rashes',
          'Soft refastenable magic tape',
        ],
        specs: [
          { label: 'Material', value: 'Breathable non-woven + quick-absorb core' },
          { label: 'Application', value: 'Daily / Overnight infant care' },
          { label: 'Certification', value: 'ISO 9001 (sample)' },
        ],
      },
    },
  },
  {
    slug: 'adult-incontinence',
    i18n: {
      zh: {
        name: '成人失禁用品',
        tagline: '舒适贴身，为长者提供安心保障',
        description:
          '成人失禁用品以舒适贴身的高容量吸收设计，配合亲肤防漏结构，守护长者尊严，让日常活动与整夜休息都更安心。',
        features: [
          '舒适贴身，活动无负担',
          '高容量吸收，整夜安心',
          '亲肤防漏，呵护尊严',
          '易穿脱设计，关爱长者',
        ],
        specs: [
          { label: '材质', value: '亲肤无纺布 + 高容量吸收芯' },
          { label: '适用场景', value: '成人护理 / 养老机构 / 居家' },
          { label: '认证', value: 'ISO 9001 / ISO 13485（示例）' },
        ],
      },
      en: {
        name: 'Adult Incontinence Care',
        tagline: 'Comfortable fit, providing peace of mind for seniors',
        description:
          'Our adult incontinence care products feature a comfortable, body-hugging high-capacity design with a skin-friendly leak-proof structure that protects dignity and brings confidence to daily activities and restful nights.',
        features: [
          'Comfortable body-hugging fit, no burden',
          'High-capacity absorbency for all-night security',
          'Skin-friendly leak-proof design, protects dignity',
          'Easy to put on and take off, caring for seniors',
        ],
        specs: [
          { label: 'Material', value: 'Soft non-woven + high-capacity core' },
          { label: 'Application', value: 'Adult care / Nursing homes / Home' },
          { label: 'Certification', value: 'ISO 9001 / ISO 13485 (sample)' },
        ],
      },
    },
  },
];
