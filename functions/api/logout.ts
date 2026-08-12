// Cloudflare Pages Functions — Decap CMS 退出（GitHub token 为无状态，
// 无法在服务端吊销，这里仅返回 200 让前端关闭会话）
export async function onRequest(): Promise<Response> {
  return new Response('OK', { status: 200 });
}
