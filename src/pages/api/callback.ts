import type { APIRoute } from 'astro';

export const prerender = false;

type CloudflareEnv = {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
};

function getEnv(locals: unknown): CloudflareEnv {
  const runtime = (locals as { runtime?: { env?: CloudflareEnv } }).runtime;
  return (runtime?.env ?? {}) as CloudflareEnv;
}

// Decap CMS GitHub OAuth — 第二步：用 code 换取 access_token，再把 token 回传给后台
export const GET: APIRoute = async ({ request, locals }) => {
  const env = getEnv(locals);
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new Response('Missing GitHub OAuth environment variables', { status: 500 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) {
    return new Response('Missing code parameter', { status: 400 });
  }
  const redirectUri = `${url.origin}/api/callback`;

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    return new Response('Failed to obtain access token from GitHub', { status: 401 });
  }

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Authorizing…</title></head>
<body>
<script>
  (function () {
    var payload = ${JSON.stringify({ token: accessToken, provider: 'github' })};
    if (window.opener) {
      window.opener.postMessage(payload, window.location.origin);
    }
    window.close();
  })();
</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};
