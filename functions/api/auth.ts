// Decap CMS GitHub OAuth 授权跳转（Cloudflare Pages Function）
// 访问 /api/auth 时，把用户重定向到 GitHub 授权页；
// GitHub 回调到 /api/callback（见 callback.ts）完成 token 交换。
export async function onRequest(context: any) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const redirectUrl = new URL('https://github.com/login/oauth/authorize');
    redirectUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    redirectUrl.searchParams.set('redirect_uri', url.origin + '/api/callback');
    redirectUrl.searchParams.set('scope', 'repo');
    redirectUrl.searchParams.set(
      'state',
      Array.from(crypto.getRandomValues(new Uint8Array(12))).join('')
    );
    return Response.redirect(redirectUrl.href, 302);
  } catch (error: any) {
    return new Response(error?.message ?? 'auth error', { status: 500 });
  }
}
