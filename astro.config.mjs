import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

// 多语言企业展示站配置（中 / 英 / 西 / 阿 / 德 / 法 / 日 / 韩 / 俄）
// 真实域名已配置：www.mint-gp.com（影响 sitemap / canonical / OG 绝对地址）
// output: 'static'（Astro 5 默认）+ Cloudflare 适配器：静态页照常预渲染，
// src/pages/api/* 端点加 prerender=false 即编译为 Pages Functions（按需运行，读取 env）
// （Decap CMS 的 GitHub OAuth 代理 auth/callback/logout 由此提供 /api/* 端点）
export default defineConfig({
  site: 'https://www.mint-gp.com',
  output: 'static',
  adapter: cloudflare(),
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
