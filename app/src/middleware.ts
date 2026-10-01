import { defineMiddleware } from 'astro:middleware';
import { externalLinks } from './lib/external-links.mjs';

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (!response.headers.get('content-type')?.includes('text/html')) return response;
  const html = externalLinks(await response.text(), context.url.href, context.site?.href);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
});
