import crypto from 'crypto';
import { getCache, setCache } from '../../lib/redis.js';

const CACHE_TTL = 86400; // 24 hours
const FETCH_TIMEOUT = 5000;
const MAX_BODY = 512 * 1024; // 512KB

export interface OgData {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
  siteName: string | null;
  ogType: string | null;
}

function cacheKey(url: string): string {
  const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 32);
  return `og:${hash}`;
}

function extractMeta(html: string, property: string): string | null {
  // Match <meta property="og:..." content="..."> or <meta name="..." content="...">
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

function extractFavicon(html: string, baseUrl: string): string | null {
  const m = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:icon|shortcut icon)["']/i);
  if (!m) {
    try {
      const u = new URL(baseUrl);
      return `${u.origin}/favicon.ico`;
    } catch {
      return null;
    }
  }
  try {
    return new URL(m[1], baseUrl).href;
  } catch {
    return m[1];
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

export async function scrapeOg(url: string): Promise<OgData | null> {
  // Check cache
  const cached = await getCache(cacheKey(url));
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // ignore corrupt cache
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'crab.ac/1.0 (link preview bot)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;

    // Read limited body
    const reader = res.body?.getReader();
    if (!reader) return null;

    let html = '';
    let bytesRead = 0;
    const decoder = new TextDecoder();

    while (bytesRead < MAX_BODY) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      html += decoder.decode(value, { stream: true });
      // Stop early if we've passed </head>
      if (html.includes('</head>')) break;
    }
    reader.cancel().catch(() => {});

    const ogTitle = extractMeta(html, 'og:title');
    const ogDesc = extractMeta(html, 'og:description');
    const ogImage = extractMeta(html, 'og:image');
    const ogSiteName = extractMeta(html, 'og:site_name');
    const ogType = extractMeta(html, 'og:type');
    const twitterTitle = extractMeta(html, 'twitter:title');
    const twitterDesc = extractMeta(html, 'twitter:description');
    const twitterImage = extractMeta(html, 'twitter:image');
    const metaDesc = extractMeta(html, 'description');

    const title = ogTitle || twitterTitle || extractTitle(html);
    const description = ogDesc || twitterDesc || metaDesc;

    // If no useful data at all, don't store an embed
    if (!title && !description && !ogImage && !twitterImage) return null;

    let imageUrl = ogImage || twitterImage || null;
    if (imageUrl) {
      try {
        imageUrl = new URL(imageUrl, url).href;
      } catch { /* keep as-is */ }
    }

    const data: OgData = {
      url,
      title: title ? decodeHtmlEntities(title) : null,
      description: description ? decodeHtmlEntities(description).slice(0, 500) : null,
      imageUrl,
      faviconUrl: extractFavicon(html, url),
      siteName: ogSiteName ? decodeHtmlEntities(ogSiteName) : null,
      ogType: ogType || null,
    };

    await setCache(cacheKey(url), JSON.stringify(data), CACHE_TTL);
    return data;
  } catch {
    return null;
  }
}

/** Extract HTTP(S) URLs from text. Max 5, deduplicated. */
export function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>"')\]]+/gi;
  const matches = text.match(re);
  if (!matches) return [];
  const unique = [...new Set(matches)];
  return unique.slice(0, 5);
}
