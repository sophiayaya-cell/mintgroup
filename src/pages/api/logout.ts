import type { APIRoute } from 'astro';

export const prerender = false;

// Decap CMS GitHub OAuth — 退出：GitHub token 无法在服务端吊销，
// 实际清除在 Decap 客户端完成；这里仅把用户重定向回站点首页。
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  return new Response(null, { status: 302, headers: { Location: `${url.origin}/` } });
};
