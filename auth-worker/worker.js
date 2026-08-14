// mintgroup-auth Worker
// Decap CMS 的 GitHub OAuth 代理：/api/auth -> GitHub 授权 -> /api/callback -> 回传 token 给后台
// 通过路由规则绑定到 www.mint-gp.com/api/*，其余请求仍由 mintgroup(Pages) 处理。
//
// 环境变量（在 mintgroup-auth Worker 上用 `wrangler secret put` 配置）：
//   GITHUB_CLIENT_ID     GitHub OAuth App 的 Client ID
//   GITHUB_CLIENT_SECRET GitHub OAuth App 的 Client Secret
//
// GitHub OAuth App 设置：
//   Authorization callback URL = https://www.mint-gp.com/api/callback  （必须精确一致）
//
// 关键：scope 必须是 repo，Decap 才能往仓库提交；只读 scope 会导致登录成功但保存 403。

const OAUTH_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const OAUTH_TOKEN = 'https://github.com/login/oauth/access_token';
const SCOPE = 'repo';
const COOKIE_NAME = 'github_oauth_state';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const p = path.replace(/\/+$/, '') || '/';
    if (p === '/api/auth') return handleAuth(request, env);
    if (p === '/api/callback') return handleCallback(request, env);
    if (p.startsWith('/api/gh/')) return handleGithubApi(request, env);
    if (p === '/api/logout') {
      return new Response('OK', { status: 200 });
    }

    // 非 /api/* 路径不应走到这里（路由只匹配 /api/*），返回 404 兜底
    return new Response('Not Found', { status: 404 });
  },
};

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const found = header
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + '='));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

function handleAuth(request, env) {
  const url = new URL(request.url);
  const origin = url.origin; // https://www.mint-gp.com
  const redirectUri = `${origin}/api/callback`;
  const state = crypto.randomUUID();

  const authorizeUrl = new URL(OAUTH_AUTHORIZE);
  authorizeUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', SCOPE);
  authorizeUrl.searchParams.set('state', state);

  // 把 state 写入 HttpOnly cookie，回调时校验，防止 CSRF。
  // SameSite=Lax 允许 GitHub 重定向回来的顶级导航带上该 cookie（同源）。
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.toString(),
      'Set-Cookie': `${COOKIE_NAME}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code) {
    return new Response('Missing code parameter', { status: 400 });
  }

  // 校验 state：必须存在且与 cookie 一致
  const savedState = getCookie(request, COOKIE_NAME);
  if (!savedState || savedState !== state) {
    return new Response('State mismatch (possible CSRF)', { status: 400 });
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

  // 把 token 回传给打开 popup 的 Decap 后台页面。
  // 关键（Decap CMS 3.x）：GitHub 代理走「握手协议」——
  //   1) 弹窗先向后台发 'authorizing:github'；
  //   2) 后台收到后回一条消息确认 origin；
  //   3) 弹窗收到回执，再用同源 origin 回传 'authorization:github:success:' + JSON.stringify({token, provider})。
  // 一次性直接 postMessage token 在 3.x 下会被忽略（弹窗关了却没登录）。
  // 同时保留 1s 兜底：若后台未回握手消息，直接同源回传，兼容旧版/异常场景。
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Authorizing…</title></head>
<body>
<script>
  (function () {
    var token = ${JSON.stringify(token)};
    if (!token) { document.body.textContent = 'No token received.'; return; }
    if (!window.opener) {
      document.body.textContent = 'Authorization complete. You may close this window.';
      return;
    }
    var sent = false;
    function sendToken(targetOrigin) {
      if (sent) return;
      sent = true;
      var msg = 'authorization:github:success:' + JSON.stringify({ token: token, provider: 'github' });
      window.opener.postMessage(msg, targetOrigin);
      // 稍等确保消息已派发再关窗
      setTimeout(function () { window.close(); }, 200);
    }
    // 监听后台握手回执，用其 origin 回传 token（Decap 3.x 要求）
    window.addEventListener('message', function (e) {
      if (e.origin !== window.location.origin) return;
      sendToken(e.origin);
    });
    // 发起握手
    window.opener.postMessage('authorizing:github', '*');
    // 兜底：1 秒后若后台未回执，直接同源回传
    setTimeout(function () { sendToken(window.location.origin); }, 1000);
  })();
</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // 用完即焚，清除 state cookie
      'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
}

// GitHub API 代理端点（/api/gh/*）
// Decap 的 api_root 指向 https://www.mint-gp.com/api/gh，
// 浏览器（与 admin 同源）请求此端点，由 Worker 服务器端转发到 https://api.github.com，
// 规避中国大陆浏览器直连 api.github.com 超时（Failed to fetch / ERR_TIMED_OUT）的问题。
// 请求头里的 Authorization（Decap 附带的 token）原样透传，不转发本站的 oauth cookie。
async function handleGithubApi(request, env) {
  const url = new URL(request.url);
  const ghPath = url.pathname.replace(/^\/api\/gh/, ''); // /user, /repos/...
  const target = new URL('https://api.github.com' + ghPath + url.search);

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('cookie'); // 不要把 mintgroup-auth 的 oauth cookie 透传给 GitHub
  if (!headers.has('User-Agent')) headers.set('User-Agent', 'decap-cms');

  const resp = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'follow',
  });

  // 同源请求（admin 与 /api/gh 同属 www.mint-gp.com），浏览器侧无 CORS 限制；直接透传响应
  return new Response(resp.body, {
    status: resp.status,
    headers: resp.headers,
  });
}
