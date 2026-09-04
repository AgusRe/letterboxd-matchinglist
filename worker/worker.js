/**
 * Cloudflare Worker — Letterboxd & TMDB Reverse Proxy Reference
 *
 * This Worker serves two purposes:
 * 1. Letterboxd CORS Proxy: Relays Letterboxd HTML pages server-side (`/?url=https://letterboxd.com/...`).
 * 2. TMDB Secure Reverse Proxy: Relays requests to TMDB v3 API (`/tmdb/*`) and injects the
 *    TMDB_API_KEY secret server-side, protecting the credential from client exposure.
 *
 * Deployment (standalone outside this repository):
 *   npx wrangler deploy
 *   npx wrangler secret put TMDB_API_KEY --name letterboxd-proxy
 */

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/agusre\.github\.io$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/
];

function isOriginAllowed(origin) {
  if (!origin) return true; // allow server-to-server, curl, and tools without origin header
  return ALLOWED_ORIGIN_PATTERNS.some(pattern => pattern.test(origin));
}

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowOrigin = isOriginAllowed(origin) ? (origin || '*') : 'https://agusre.github.io';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

export default {
  async fetch(request, env) {
    // ── Handle CORS Preflight ────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request)
      });
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: getCorsHeaders(request)
      });
    }

    const requestUrl = new URL(request.url);
    const corsHeaders = getCorsHeaders(request);

    // ── Validate Origin / Referer ────────────────────────────────────────────
    const origin = request.headers.get('Origin') || '';
    const referer = request.headers.get('Referer') || '';
    let refererOrigin = '';
    try {
      if (referer) refererOrigin = new URL(referer).origin;
    } catch {}

    const isValidOrigin = isOriginAllowed(origin) && (!referer || isOriginAllowed(refererOrigin));

    if (!isValidOrigin) {
      return new Response(JSON.stringify({ error: 'Forbidden: unauthorized origin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Route 1: TMDB Reverse Proxy (/tmdb/*) ────────────────────────────────
    if (requestUrl.pathname.startsWith('/tmdb/')) {
      const tmdbPath = requestUrl.pathname.replace(/^\/tmdb/, '');

      // Whitelist allowed TMDB endpoints
      const isSearchMovie = tmdbPath === '/search/movie';
      const isWatchProviders = /^\/movie\/\d+\/watch\/providers$/.test(tmdbPath);

      if (!isSearchMovie && !isWatchProviders) {
        return new Response(JSON.stringify({ error: 'Endpoint not allowed in TMDB proxy' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const apiKey = env.TMDB_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({
          error: 'TMDB_API_KEY secret is not configured on Worker',
          message: 'Configure TMDB_API_KEY secret in Cloudflare Dashboard (Settings -> Variables and Secrets) or via `wrangler secret put TMDB_API_KEY`'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Build target URL to TMDB API v3
      const targetUrl = new URL(`https://api.themoviedb.org/3${tmdbPath}`);

      // Forward query parameters (query, year, language, region, page, etc.)
      for (const [key, value] of requestUrl.searchParams.entries()) {
        if (key !== 'api_key') {
          targetUrl.searchParams.set(key, value);
        }
      }

      // Sanitize secret: trim whitespace/newlines, surrounding quotes and optional 'Bearer ' prefix
      const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '').trim().replace(/^Bearer\s+/i, '').trim();
      const isBearer = cleanKey.startsWith('ey') || cleanKey.length > 60;
      const fetchHeaders = {
        'Accept': 'application/json',
        'User-Agent': 'LetterboxdMatch-WorkerProxy/1.0'
      };

      if (isBearer) {
        fetchHeaders['Authorization'] = `Bearer ${cleanKey}`;
      } else {
        targetUrl.searchParams.set('api_key', cleanKey);
      }

      try {
        const tmdbResponse = await fetch(targetUrl.toString(), {
          method: 'GET',
          headers: fetchHeaders
        });

        const body = await tmdbResponse.text();
        return new Response(body, {
          status: tmdbResponse.status,
          headers: {
            ...corsHeaders,
            'Content-Type': tmdbResponse.headers.get('Content-Type') || 'application/json',
            'Cache-Control': 'public, max-age=1800' // 30 min edge cache
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Error fetching from TMDB', message: err.message }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ── Route 2: Letterboxd CORS Proxy (/?url=<letterboxd_url>) ──────────────
    const targetUrl = requestUrl.searchParams.get('url');
    if (!targetUrl) {
      return new Response('Missing ?url= parameter or /tmdb/* endpoint', {
        status: 400,
        headers: corsHeaders
      });
    }

    let parsedTarget;
    try {
      parsedTarget = new URL(targetUrl);
    } catch {
      return new Response('Invalid target URL', { status: 400, headers: corsHeaders });
    }

    if (parsedTarget.hostname !== 'letterboxd.com' && !parsedTarget.hostname.endsWith('.letterboxd.com')) {
      return new Response('Forbidden: only letterboxd.com URLs are allowed', {
        status: 403,
        headers: corsHeaders
      });
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });

      const body = await response.text();
      return new Response(body, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': response.headers.get('Content-Type') || 'text/html; charset=utf-8'
        }
      });
    } catch (err) {
      return new Response(`Proxy error: ${err.message}`, {
        status: 502,
        headers: corsHeaders
      });
    }
  }
};
