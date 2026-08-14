// mintgroup-auth Worker
// 只负责 Decap CMS 的 GitHub OAuth 代理：/api/auth -> /api/callback -> /api/logout
// 通过路由规则绑定到 www.mint-gp.com/api/* ，其余请求仍由 mintgroup(Pages) 处理。
//
// 依赖的环境变量 / 密钥（在 mintgroup-auth Worker 上配置）：
//   GITHUB_CLIENT_ID     GitHub OAuth App 的 Client ID
//   GITHUB_CLIENT_SECRET GitHub OAuth App 的 Client Secret
//
// 前置条件：GitHub OAuth App 的 Authorization callback URL 必须设为
//   https://www.mint-gp.com/api/callback

const OAUTH_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const OAUTH_TOKEN = 'https://github.com/login/oauth/access_token';
// Decap 写回仓库需要 repo 权限；若仓库为公开，可改为 public_repo
const SCOPE = 'repo';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/auth') {
      return handleAuth(url, env);
    }
    if (path === '/api/callback') {
      return handleCallback(url, env);
    }
    if (path === '/api/logout') {
      return new Response('OK', { status: 200 });
    }

    // 非 /api/* 路径不应走到这里（路由只匹配 /api/*），返回 404 兜底
    return new Response('Not Found', { status: 404 });
  },
};

function handleAuth(url, env) {
  const origin = url.origin; // https://www.mint-gp.com
  const redirectUri = `${origin}/api/callback`;
  const state = crypto.randomUUID();

  const authorizeUrl = new URL(OAUTH_AUTHORIZE);
  authorizeUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', SCOPE);
  authorizeUrl.searchParams.set('state', state);

  return Response.redirect(authorizeUrl.toString(), 302);
}

async function handleCallback(url, env) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // 透传，简单代理不做服务端校验
  if (!code) {
    return new Response('Missing code parameter', { status: 400 });
  }

  const origin = url.origin;
  const redirectUri = `${origin}/api/callback`;

  const tokenResp = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      state: state || undefined,
    }),
  });

  const data = await tokenResp.json();
  const token = data.access_token;
  if (!token) {
    return new Response(
      'Token exchange failed: ' + JSON.stringify(data),
      { status: 400 }
    );
  }

  // 把 token 回传给打开 popup 的 Decap 后台页面（同源，postMessage 安全）
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Authorizing…</title></head>
<body>
<script>
  (function () {
    var token = ${JSON.stringify(token)};
    if (window.opener) {
      window.opener.postMessage({ token: token, provider: 'github' }, window.opener.origin);
      window.close();
    } else {
      document.body.textContent = 'Authorization complete. You may close this window.';
    }
  })();
</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
