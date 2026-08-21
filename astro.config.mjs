import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 多语言企业展示站配置（中 / 英 / 西 / 阿 / 德 / 法 / 日 / 韩 / 俄）
// 真实域名已配置：www.mint-gp.com（影响 sitemap / canonical / OG 绝对地址）
// 纯静态站（output 默认 static）。Decap CMS 的 GitHub OAuth 端点由
// 仓库根目录 functions/api/*.ts（Cloudflare Pages Functions 原生函数）提供，
// 与静态构建完全解耦，部署用 `wrangler pages deploy dist`。
export default defineConfig({
  site: 'https://www.mint-gp.com',
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en', 'es', 'ar', 'de', 'fr', 'ja', 'ko', 'ru', 'vi', 'pt'],
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
          vi: 'vi', pt: 'pt',
        },
      },
    }),
  ],
  server: {
    port: 4321,
  },
});
