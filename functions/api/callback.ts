// Cloudflare Pages Functions — Decap CMS GitHub OAuth 第二步：
// 用 code 换取 access_token，再把 token 通过 postMessage 回传给 Decap 后台弹窗
export async function onRequest(
  context: { request: Request; env: Record<string, string> }
): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;

  if (!code || !clientId || !clientSecret) {
    return new Response('Missing OAuth parameters or environment variables', {
      status: 400,
    });
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${url.origin}/api/callback`,
    }),
  });
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  const token = tokenData.access_token;
  if (!token) {
    return new Response('Failed to obtain access token from GitHub', {
      status: 401,
    });
  }

  // 安全地嵌入 token：GitHub token 仅含字母数字与下划线，不会破坏脚本字符串
  const safeToken = token.replace(/[^a-zA-Z0-9_]/g, '');
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Authenticating...</title></head>
<body>
<script>
(function () {
  function receiveMessage(e) {
    window.opener.postMessage({ token: '${safeToken}', provider: 'github' }, e.origin);
    window.close();
  }
  window.addEventListener('message', receiveMessage, false);
  window.opener.postMessage('authorizing: ' + window.location.toString(), '*');
})();
</script>
</body>
</html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
