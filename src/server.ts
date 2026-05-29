import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { MENU_FIXTURE } from './app/menu/state/menu.fixture';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Resolve the canonical site origin used in sitemap/robots URLs.
 * Prefers `PUBLIC_ORIGIN` (a trusted, operator-configured value) over the
 * incoming `Host` header, which is attacker-controllable and would otherwise
 * let a single poisoned request taint a long-lived public cache entry
 * (Host Header Injection → Cache Poisoning).
 */
function canonicalOrigin(req: express.Request): string {
  const configured = process.env['PUBLIC_ORIGIN'];
  if (configured) return configured.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

/**
 * Minimal XML text escaper. Used for every value interpolated into the
 * sitemap so a malicious CMS response (e.g. a slug containing `<` or `&`)
 * can't break out of an element and inject markup.
 */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

app.get('/api/menu', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json(MENU_FIXTURE);
});

/**
 * Set Cache-Control headers based on the final response status code.
 * Placed before static-file and Angular handlers so it captures all responses.
 */
app.use((req, res, next) => {
  const originalEnd = res.end.bind(res);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res as any).end = function (...args: unknown[]) {
    if (!res.headersSent) {
      if (res.statusCode === 200) {
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
      } else if (res.statusCode === 404) {
        res.setHeader('Cache-Control', 'public, s-maxage=10');
      }
      res.setHeader('Vary', 'Accept-Encoding');
    }
    return originalEnd(...(args as []));
  };
  next();
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Serve robots.txt.
 */
app.get('/robots.txt', (req, res) => {
  const origin = canonicalOrigin(req);
  const disallow = process.env['ROBOTS_DISALLOW_ALL'] === 'true' ? 'Disallow: /\n' : '';
  res.setHeader('Cache-Control', 'public, s-maxage=300');
  // When PUBLIC_ORIGIN is not set we fall back to the Host header — vary the
  // cache key on it so a poisoned request can't leak to other hosts.
  if (!process.env['PUBLIC_ORIGIN']) res.setHeader('Vary', 'Host');
  res.type('text/plain').send(
    `User-agent: *\n${disallow}Sitemap: ${origin}/sitemap.xml\n`,
  );
});

/**
 * Serve sitemap.xml, proxied from the CMS API.
 */
app.get('/sitemap.xml', async (req, res) => {
  try {
    const base = process.env['CMS_BASE_URL'] ?? '';
    const upstream = await fetch(`${base}/api/sitemap`);
    if (!upstream.ok) {
      res.status(502).type('text/plain').send('Bad upstream');
      return;
    }
    const entries = (await upstream.json()) as {
      slug: string;
      lastmod?: string;
      priority?: number;
    }[];
    const origin = canonicalOrigin(req);
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      entries
        .map((e) => {
          const loc = xmlEscape(`${origin}${e.slug ?? ''}`);
          const lastmod = e.lastmod
            ? `<lastmod>${xmlEscape(e.lastmod)}</lastmod>`
            : '';
          const prio =
            typeof e.priority === 'number' && Number.isFinite(e.priority)
              ? `<priority>${Math.max(0, Math.min(1, e.priority)).toFixed(2)}</priority>`
              : '';
          return `  <url><loc>${loc}</loc>${lastmod}${prio}</url>`;
        })
        .join('\n') +
      `\n</urlset>\n`;
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    if (!process.env['PUBLIC_ORIGIN']) res.setHeader('Vary', 'Host');
    res.type('application/xml').send(xml);
  } catch {
    res.status(500).type('text/plain').send('Failed to build sitemap');
  }
});

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req, { response: res })
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
