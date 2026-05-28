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
  const origin = `${req.protocol}://${req.get('host')}`;
  const disallow = process.env['ROBOTS_DISALLOW_ALL'] === 'true' ? 'Disallow: /\n' : '';
  res.setHeader('Cache-Control', 'public, s-maxage=300');
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
    const origin = `${req.protocol}://${req.get('host')}`;
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      entries
        .map((e) => {
          const loc = `${origin}${e.slug}`;
          const lastmod = e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : '';
          const prio = e.priority != null ? `<priority>${e.priority}</priority>` : '';
          return `  <url><loc>${loc}</loc>${lastmod}${prio}</url>`;
        })
        .join('\n') +
      `\n</urlset>\n`;
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
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
    .handle(req)
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
