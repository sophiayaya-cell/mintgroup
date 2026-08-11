import type { Locale } from './ui';

// 新增的界面标签（导航 / 版块标题等），与 ui.ts 结构一致，覆盖全部 9 个语种。
// 新增语言时在此同步扩展即可。
export const LABELS: Record<Locale, {
  news: string;
  team: string;
  latestNews: string;
  readMore: string;
  backToProducts: string;
  features: string;
  specifications: string;
  inquiry: string;
  ourTeam: string;
  teamIntro: string;
  allNews: string;
}> = {
  zh: {
    news: '新闻动态',
    team: '团队介绍',
    latestNews: '最新动态',
    readMore: '阅读全文',
    backToProducts: '返回产品中心',
    features: '产品特性',
    specifications: '产品规格',
    inquiry: '立即咨询',
    ourTeam: '我们的团队',
    teamIntro: '我们是一支专注卫生用品研发与制造的团队，以严谨的品控与持续创新，守护每一位用户的健康与安心。',
    allNews: '全部动态',
  },
  en: {
    news: 'News',
    team: 'Team',
    latestNews: 'Latest News',
    readMore: 'Read more',
    backToProducts: 'Back to Products',
    features: 'Features',
    specifications: 'Specifications',
    inquiry: 'Contact Us',
    ourTeam: 'Our Team',
    teamIntro: 'We are a team dedicated to R&D and manufacturing of hygiene products, safeguarding the health and peace of mind of every user with rigorous quality control and continuous innovation.',
    allNews: 'All News',
  },
  es: {
    news: 'Noticias',
    team: 'Equipo',
    latestNews: 'Últimas noticias',
    readMore: 'Leer más',
    backToProducts: 'Volver a productos',
    features: 'Características',
    specifications: 'Especificaciones',
    inquiry: 'Contáctanos',
    ourTeam: 'Nuestro equipo',
    teamIntro: 'Somos un equipo dedicado a la I+D y fabricación de productos de higiene, protegiendo la salud de cada usuario con un riguroso control de calidad y una innovación continua.',
    allNews: 'Todas las noticias',
  },
  ar: {
    news: 'الأخبار',
    team: 'الفريق',
    latestNews: 'أحدث الأخبار',
    readMore: 'اقرأ المزيد',
    backToProducts: 'العودة إلى المنتجات',
    features: 'الميزات',
    specifications: 'المواصفات',
    inquiry: 'تواصل معنا',
    ourTeam: 'فريقنا',
    teamIntro: 'نحن فريق متخصص في البحث والتطوير وتصنيع المنتجات الصحية، نحمي صحة كل مستخدم بنظام صارم لضبط الجودة وابتكار مستمر.',
    allNews: 'كل الأخبار',
  },
  de: {
    news: 'Neuigkeiten',
    team: 'Team',
    latestNews: 'Neueste Nachrichten',
    readMore: 'Mehr lesen',
    backToProducts: 'Zurück zu Produkten',
    features: 'Merkmale',
    specifications: 'Spezifikationen',
    inquiry: 'Kontaktieren Sie uns',
    ourTeam: 'Unser Team',
    teamIntro: 'Wir sind ein Team, das sich der Forschung, Entwicklung und Herstellung von Hygieneprodukten widmet und die Gesundheit jedes Anwenders mit strenger Qualitätskontrolle und kontinuierlicher Innovation schützt.',
    allNews: 'Alle Nachrichten',
  },
  fr: {
    news: 'Actualités',
    team: 'Équipe',
    latestNews: 'Dernières actualités',
    readMore: 'Lire la suite',
    backToProducts: 'Retour aux produits',
    features: 'Caractéristiques',
    specifications: 'Spécifications',
    inquiry: 'Nous contacter',
    ourTeam: 'Notre équipe',
    teamIntro: 'Nous sommes une équipe dédiée à la R&D et à la fabrication de produits d\'hygiène, protégeant la santé de chaque utilisateur grâce à un contrôle qualité rigoureux et à une innovation continue.',
    allNews: 'Toutes les actualités',
  },
  ja: {
    news: 'お知らせ',
    team: 'チーム',
    latestNews: '最新情報',
    readMore: '続きを読む',
    backToProducts: '製品一覧へ',
    features: '製品の特長',
    specifications: '仕様',
    inquiry: 'お問い合わせ',
    ourTeam: '私たちのチーム',
    teamIntro: '私たちは衛生用品の研究開発・製造に携わるチームです。厳格な品質管理と継続的な技術革新で、すべての人々の健康を守ります。',
    allNews: 'すべてのお知らせ',
  },
  ko: {
    news: '뉴스',
    team: '팀',
    latestNews: '최신 소식',
    readMore: '더 보기',
    backToProducts: '제품으로 돌아가기',
    features: '제품 특징',
    specifications: '사양',
    inquiry: '문의하기',
    ourTeam: '우리 팀',
    teamIntro: '우리는 위생용품 연구개발 및 제조에 전념하는 팀으로, 엄격한 품질 관리와 지속적인 기술 혁신으로 모든 사용자의 건강을 지킵니다.',
    allNews: '모든 소식',
  },
  ru: {
    news: 'Новости',
    team: 'Команда',
    latestNews: 'Последние новости',
    readMore: 'Читать далее',
    backToProducts: 'К продукции',
    features: 'Особенности',
    specifications: 'Характеристики',
    inquiry: 'Связаться с нами',
    ourTeam: 'Наша команда',
    teamIntro: 'Мы — команда, преданная НИОКР и производству гигиенической продукции, защищающая здоровье каждого пользователя строгим контролем качества и постоянными инновациями.',
    allNews: 'Все новости',
  },
};
