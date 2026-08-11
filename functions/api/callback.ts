// Decap CMS GitHub OAuth 回调（Cloudflare Pages Function）
// GitHub 授权后带着 code 回到 /api/callback，这里用 client_id/secret 换 access_token，
// 再把 token 通过 postMessage 回传给打开的 Decap 弹窗。
export async function onRequest(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const ghError = url.searchParams.get('error');

  if (ghError) {
    return renderBody('error', { error: ghError });
  }
  if (!code) {
    return renderBody('error', { error: 'missing code parameter' });
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'cloudflare-decap-oauth',
        accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const result = await response.json();
    if (result.error) {
      return renderBody('error', { error: result.error_description || result.error });
    }
    return renderBody('success', { token: result.access_token, provider: 'github' });
  } catch (error: any) {
    return renderBody('error', { error: error?.message ?? 'callback error' });
  }
}

function renderBody(status: string, content: any) {
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  const html = `<!doctype html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <script>
      (function () {
        var msg = ${JSON.stringify(message)};
        if (window.opener) {
          // 优先发给父窗口的来源，兜底用 '*'（兼容旧版 Decap）
          try { window.opener.postMessage(msg, window.opener.location.origin); } catch (e) {}
          window.opener.postMessage(msg, '*');
        }
        setTimeout(function () { window.close(); }, 800);
      })();
    </script>
  </body>
</html>`;
  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  });
}
