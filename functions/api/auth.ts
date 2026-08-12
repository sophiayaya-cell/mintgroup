// Cloudflare Pages Functions — Decap CMS GitHub OAuth 第一步：重定向到 GitHub 授权页
// 通过 context.env 读取 Pages 项目环境变量 GITHUB_CLIENT_ID
export async function onRequest(
  context: { request: Request; env: Record<string, string> }
): Promise<Response> {
  const { request, env } = context;
  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return new Response('Missing GITHUB_CLIENT_ID environment variable', {
      status: 500,
    });
  }
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'repo',
  });
  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  return new Response(null, {
    status: 302,
    headers: { Location: authUrl },
  });
}
