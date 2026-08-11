// 界面文案字典：新增语言只需在此扩展，并同步 astro.config.mjs 的 locales
export type Locale = 'zh' | 'en' | 'es' | 'ar' | 'de' | 'fr' | 'ja' | 'ko' | 'ru';

// 全量语种列表（供动态路由 getStaticPaths 使用，保持与上方类型一致）
export const LOCALES = ['zh', 'en', 'es', 'ar', 'de', 'fr', 'ja', 'ko', 'ru'] as const;

export const UI = {
  zh: {
    home: '首页',
    about: '关于我们',
    products: '产品中心',
    contact: '联系我们',
    switchLabel: 'EN',
    language: '语言',

    heroTitle: '自然呵护 · 净在点滴',
    heroSubtitle: '淄博鹏旭卫生用品有限公司<br/>专注高品质卫生用品',
    ctaProducts: '查看产品',
    ctaContact: '联系我们',

    introTitle: '关于鹏旭',
    introText:
      '淄博鹏旭卫生用品有限公司专注于高品质卫生用品的研发与制造，秉持"自然呵护"的理念，为全球客户提供安全、环保、舒适的产品解决方案。',

    aboutTitle: '关于我们',
    aboutText:
      '我们集研发、生产、品控于一体，产品覆盖医用护理、母婴与成人护理等场景。以严谨的品控体系和持续的工艺创新，守护每一位用户的健康与安心。',

    productsTitle: '产品中心',
    product1Name: '医用护理垫',
    product1Desc: '柔软亲肤、高吸收，适用于医疗与家庭护理场景。',
    product2Name: '婴儿纸尿裤',
    product2Desc: '透气干爽，呵护宝宝娇嫩肌肤。',
    product3Name: '成人失禁用品',
    product3Desc: '舒适贴身，为长者提供安心保障。',

    contactTitle: '联系我们',

    rights: '保留所有权利。',
  },
  en: {
    home: 'Home',
    about: 'About',
    products: 'Products',
    contact: 'Contact',
    switchLabel: '中文',
    language: 'Language',

    heroTitle: 'Pure Care · Naturally Delivered',
    heroSubtitle: 'ZIBO MINT HYGIENE PRODUCTS CO., LTD.<br/>Quality Hygiene Products',
    ctaProducts: 'View Products',
    ctaContact: 'Contact Us',

    introTitle: 'About MINT',
    introText:
      'ZIBO MINT HYGIENE PRODUCTS CO., LTD. specializes in R&D and manufacturing of high-quality hygiene products, guided by the philosophy of "Pure Care, Naturally Delivered", serving global customers with safe, eco-friendly and comfortable solutions.',

    aboutTitle: 'About Us',
    aboutText:
      'We integrate R&D, production and quality control. Our products cover medical care, baby and adult care. With a rigorous QC system and continuous process innovation, we protect the health and peace of mind of every user.',

    productsTitle: 'Products',
    product1Name: 'Medical Care Pads',
    product1Desc: 'Soft, skin-friendly and highly absorbent for medical and home care.',
    product2Name: 'Baby Diapers',
    product2Desc: 'Breathable and dry, gentle on delicate baby skin.',
    product3Name: 'Adult Incontinence Care',
    product3Desc: 'Comfortable fit, providing peace of mind for seniors.',

    contactTitle: 'Contact Us',

    rights: 'All rights reserved.',
  },
  es: {
    home: 'Inicio',
    about: 'Sobre nosotros',
    products: 'Productos',
    contact: 'Contacto',
    switchLabel: '中文',
    language: 'Idioma',

    heroTitle: 'Cuidado puro · naturalmente entregado',
    heroSubtitle: 'ZIBO MINT HYGIENE PRODUCTS CO., LTD.<br/>Productos de higiene de calidad',
    ctaProducts: 'Ver productos',
    ctaContact: 'Contáctanos',

    introTitle: 'Sobre MINT',
    introText:
      'ZIBO MINT HYGIENE PRODUCTS CO., LTD. se especializa en I+D y fabricación de productos de higiene de alta calidad, bajo la filosofía de "Cuidado puro, naturalmente entregado", ofreciendo a clientes globales soluciones seguras, ecológicas y confortables.',

    aboutTitle: 'Sobre nosotros',
    aboutText:
      'Integramos I+D, producción y control de calidad. Nuestros productos cubren el cuidado médico, infantil y de adultos. Con un riguroso sistema de control de calidad y una innovación continua, protegemos la salud y la tranquilidad de cada usuario.',

    productsTitle: 'Productos',
    product1Name: 'Toallas de cuidado médico',
    product1Desc: 'Suaves, hipoalergénicas y altamente absorbentes para cuidado médico y doméstico.',
    product2Name: 'Pañales para bebés',
    product2Desc: 'Transpirables y secas, suaves con la piel delicada del bebé.',
    product3Name: 'Cuidado de incontinencia para adultos',
    product3Desc: 'Ajuste cómodo, brindando tranquilidad a los adultos mayores.',

    contactTitle: 'Contáctanos',

    rights: 'Todos los derechos reservados.',
  },
  ar: {
    home: 'الرئيسية',
    about: 'من نحن',
    products: 'المنتجات',
    contact: 'اتصل بنا',
    switchLabel: '中文',
    language: 'اللغة',

    heroTitle: 'عناية نقية · تُقدَّم طبيعياً',
    heroSubtitle: 'شركة زيبو مينت للمنتجات الصحية ذ.م.م<br/>منتجات صحية عالية الجودة',
    ctaProducts: 'استعرض المنتجات',
    ctaContact: 'اتصل بنا',

    introTitle: 'عن مينت',
    introText:
      'تتخصص شركة زيبو مينت للمنتجات الصحية في البحث والتطوير وتصنيع منتجات العناية الصحية عالية الجودة، انطلاقاً من شعار "عناية نقية، تُقدَّم طبيعياً"، لتقديم حلول آمنة وصديقة للبيئة ومريحة لعملاء حول العالم.',

    aboutTitle: 'من نحن',
    aboutText:
      'نجمع بين البحث والتطوير والإنتاج وضبط الجودة. تغطي منتجاتنا الرعاية الطبية ورعاية الأطفال والبالغين. ومن خلال نظام صارم لضبط الجودة وابتكار مستمر، نحمي صحة وراحة كل مستخدم.',

    productsTitle: 'المنتجات',
    product1Name: 'فوط العناية الطبية',
    product1Desc: 'ناعمة ولطيفة على البشرة وعالية الامتصاص للرعاية الطبية والمنزلية.',
    product2Name: 'حفاضات الأطفال',
    product2Desc: 'شديدة التهوية وجافة، لطيفة على بشرة الطفل الحساسة.',
    product3Name: 'منتجات رعاية سلس البول للبالغين',
    product3Desc: 'ملائمة مريحة توفر الطمأنينة لكبار السن.',

    contactTitle: 'اتصل بنا',

    rights: 'جميع الحقوق محفوظة.',
  },
  de: {
    home: 'Startseite',
    about: 'Über uns',
    products: 'Produkte',
    contact: 'Kontakt',
    switchLabel: '中文',
    language: 'Sprache',

    heroTitle: 'Reine Pflege · auf natürliche Weise',
    heroSubtitle: 'ZIBO MINT HYGIENE PRODUCTS CO., LTD.<br/>Hochwertige Hygieneprodukte',
    ctaProducts: 'Produktübersicht',
    ctaContact: 'Kontakt',

    introTitle: 'Über MINT',
    introText:
      'ZIBO MINT HYGIENE PRODUCTS CO., LTD. ist auf Forschung, Entwicklung und Herstellung hochwertiger Hygieneprodukte spezialisiert. Unter dem Leitgedanken „Reine Pflege – auf natürliche Weise" bieten wir Kunden weltweit sichere, umweltfreundliche und komfortable Lösungen.',

    aboutTitle: 'Über uns',
    aboutText:
      'Wir vereinen Forschung, Entwicklung, Produktion und Qualitätskontrolle unter einem Dach. Unser Produktsortiment umfasst medizinische Pflegeartikel sowie Produkte für Baby- und Erwachsenenpflege. Mit strengen Qualitätsstandards und kontinuierlicher Innovation gewährleisten wir die Gesundheit und Zufriedenheit jedes Anwenders.',

    productsTitle: 'Produkte',
    product1Name: 'Medizinische Unterlagen',
    product1Desc: 'Weiche, hautfreundliche Vliesqualität mit hoher Saugkraft – ideal für Kliniken und häusliche Pflege.',
    product2Name: 'Babywindeln',
    product2Desc: 'Atmungsaktives Material, trocken und hautschonend – speziell für empfindliche Babyhaut entwickelt.',
    product3Name: 'Inkontinenzhilfen',
    product3Desc: 'Diskret, bequem und zuverlässig – für Sicherheit und Lebensqualität im Alter.',

    contactTitle: 'Kontakt',

    rights: 'Alle Rechte vorbehalten.',
  },
  fr: {
    home: 'Accueil',
    about: 'À propos',
    products: 'Produits',
    contact: 'Contact',
    switchLabel: '中文',
    language: 'Langue',

    heroTitle: 'Soin pur · naturellement vôtre',
    heroSubtitle: 'ZIBO MINT HYGIENE PRODUCTS CO., LTD.<br/>Produits d\'hygiène de qualité',
    ctaProducts: 'Voir les produits',
    ctaContact: 'Nous contacter',

    introTitle: 'À propos de MINT',
    introText:
      'ZIBO MINT HYGIENE PRODUCTS CO., LTD. est spécialisée dans la R&D et la fabrication de produits d\'hygiène de haute qualité, guidée par la philosophie « Soin pur, naturellement vôtre », en servant des clients dans le monde entier avec des solutions sûres, écologiques et confortables.',

    aboutTitle: 'À propos de nous',
    aboutText:
      'Nous intégrons la R&D, la production et le contrôle qualité. Nos produits couvrent les soins médicaux, les soins pour bébés et adultes. Grâce à un système rigoureux de contrôle qualité et à une innovation continue, nous protégeons la santé et la sérénité de chaque utilisateur.',

    productsTitle: 'Produits',
    product1Name: 'Alèses médicales',
    product1Desc: 'Doux, hypoallergéniques et très absorbants pour les soins médicaux et à domicile.',
    product2Name: 'Couches pour bébés',
    product2Desc: 'Respirantes et sèches, douces pour la peau délicate des bébés.',
    product3Name: 'Produits d\'incontinence pour adultes',
    product3Desc: 'Ajustement confortable pour la tranquillité des personnes âgées.',

    contactTitle: 'Nous contacter',

    rights: 'Tous droits réservés.',
  },
  ja: {
    home: 'ホーム',
    about: '会社概要',
    products: '製品',
    contact: 'お問い合わせ',
    switchLabel: '中文',
    language: '言語',

    heroTitle: 'ピュアケア · 自然に輝く',
    heroSubtitle: '淄博 MINT 衛生用品有限公司<br/>高品質衛生用品',
    ctaProducts: '製品を見る',
    ctaContact: 'お問い合わせ',

    introTitle: 'MINTについて',
    introText:
      '淄博鹏旭衛生用品有限公司は「ピュアケア · 自然に輝く」の理念の下、高品質な衛生用品の研究開発・製造に特化し、世界中のクライアントに安全で環境に優しく快適な製品ソリューションを提供しています。',

    aboutTitle: '会社概要',
    aboutText:
      '研究開発・生産・品質管理を一体化し、医用ケア、ベビーケア、成人ケアの製品群をカバーしています。厳格な品質管理システムと継続的な技術革新で、すべての人々の健康と安心を守ります。',

    productsTitle: '製品',
    product1Name: '医療用ケアパッド',
    product1Desc: '柔らかく肌に優しく、吸収性が高く、医療とホームケアのシーンに適しています。',
    product2Name: 'ベビーパンツ',
    product2Desc: '通気性が高く乾式で敏感な赤ちゃんの肌を守ります。',
    product3Name: '成人用紙おむつ',
    product3Desc: '快適で肌に優しく、高齢者の安心快適な生活を支えます。',

    contactTitle: 'お問い合わせ',

    rights: '全著作権所有。',
  },
  ko: {
    home: '홈',
    about: '회사 소개',
    products: '제품',
    contact: '문의',
    switchLabel: '中文',
    language: '언어',

    heroTitle: '순수한 케어 · 자연스럽게',
    heroSubtitle: '더보팽서위생용품유한회사<br/>고품질 위생용품',
    ctaProducts: '제품 보기',
    ctaContact: '문의하기',

    introTitle: 'MINT 소개',
    introText:
      '더보팽서위생용품유한회사는 "순수한 케어 · 자연스럽게" 철학에 따라 고품질 위생용품의 연구개발 및 제조에 전념하며, 전 세계 고객에게 안전하고 친환경적이며 쾌적한 제품 솔루션을 제공합니다.',

    aboutTitle: '회사 소개',
    aboutText:
      '연구개발·생산·품질관리를 통합하며, 의료护理, 영유아 및 성인护理 제품을 제공하고 있습니다. 엄격한 품질 관리 시스템과 지속적인 기술 혁신으로 모든 사용자의 건강과 안심을 지키겠습니다.',

    productsTitle: '제품',
    product1Name: '의료용 케어 패드',
    product1Desc: '부드럽고 피부에 친절하며 흡수력이 높아 의료 및 가정간호에 적합합니다.',
    product2Name: '영유아 기저귀',
    product2Desc: '통기성이 뛰어나고 건조하며 민감한 영유아 피부를 보호합니다.',
    product3Name: '성인 요실금 제품',
    product3Desc: '편안하고 피부에 밀착되며, 노인의 안심을 보장합니다.',

    contactTitle: '문의',

    rights: '모든 권리 보유.',
  },
  ru: {
    home: 'Главная',
    about: 'О нас',
    products: 'Продукция',
    contact: 'Контакты',
    switchLabel: '中文',
    language: 'Язык',

    heroTitle: 'Чистый уход · Природное совершенство',
    heroSubtitle: 'ООО ЦЗИБО МИНТ ГИДЖИН ПРОДАКТС<br/>Качественная гигиеническая продукция',
    ctaProducts: 'Смотреть продукцию',
    ctaContact: 'Контакты',

    introTitle: 'О MINT',
    introText:
      'ООО ЦЗИБО МИНТ ГИДЖИН ПРОДАКТС специализируется на НИОКР и производстве высококачественной гигиенической продукции под девизом «Чистый уход · Природное совершенство», предлагая клиентам по всему миру безопасные, экологичные и комфортные решения.',

    aboutTitle: 'О нас',
    aboutText:
      'Мы объединяем исследования, производство и контроль качества. Наша продукция охватывает медицинский уход, уход за детьми и взрослыми. Благодаря строгой системе контроля качества и постоянному технологическому совершенствованию мы обеспечиваем здоровье и спокойствие каждого пользователя.',

    productsTitle: 'Продукция',
    product1Name: 'Медицинские простыни',
    product1Desc: 'Мягкие, гипоаллергенные, высокой впитываемости — для медицинских и домашних условий.',
    product2Name: 'Детские подгузники',
    product2Desc: 'Дышащие и сухие, бережно защищают нежную кожу малышей.',
    product3Name: 'Средства при недержании для взрослых',
    product3Desc: 'Комфортная посадка, обеспечивающая уверенность и спокойствие для пожилых людей.',

    contactTitle: 'Контакты',

    rights: 'Все права защищены.',
  },
} as const;
