import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 多语言企业展示站配置（中 / 英 / 西 / 阿 / 德 / 法 / 日 / 韩 / 俄）
// 真实域名已配置：www.mint-gp.com（影响 sitemap / canonical / OG 绝对地址）
export default defineConfig({
  site: 'https://www.mint-gp.com',
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en', 'es', 'ar', 'de', 'fr', 'ja', 'ko', 'ru'],
    routing: {
      prefixDefaultLocale: true,
    },
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'zh',
        locales: {
          zh: 'zh', en: 'en', es: 'es', ar: 'ar',
          de: 'de', fr: 'fr', ja: 'ja', ko: 'ko', ru: 'ru',
        },
      },
    }),
  ],
  server: {
    port: 4321,
  },
});
