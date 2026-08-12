// Post-build step: override Astro Cloudflare adapter's auto-generated _routes.json
// so that ONLY /api/* is routed to the Functions worker. Everything else (homepage
// redirect, locale pages, sitemap, static assets, /admin) is served statically.
// Without this, the adapter's `include: ["/*"]` would send the root `/` and
// `/sitemap-*.xml` to the worker, which only handles /api/* -> those would 404.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, '..', 'dist');

const routes = {
  version: 1,
  include: ['/api/*'],
  exclude: [],
};

writeFileSync(
  join(distDir, '_routes.json'),
  JSON.stringify(routes, null, 2) + '\n'
);
console.log('[fix-routes] _routes.json -> include: ["/api/*"] (only API endpoints hit the worker)');
