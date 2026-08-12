import type { APIRoute } from 'astro';

export const prerender = false;

type CloudflareEnv = {
  GITHUB_CLIENT_ID?: string;
};

function getEnv(locals: unknown): CloudflareEnv {
  const runtime = (locals as { runtime?: { env?: CloudflareEnv } }).runtime;
  return (runtime?.env ?? {}) as CloudflareEnv;
}

// Decap CMS GitHub OAuth — 第一步：把用户重定向到 GitHub 授权页
export const GET: APIRoute = async ({ request, locals }) => {
  const env = getEnv(locals);
  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return new Response('Missing GITHUB_CLIENT_ID environment variable', { status: 500 });
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
  return new Response(null, { status: 302, headers: { Location: authUrl } });
};
