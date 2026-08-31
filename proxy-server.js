/* ================================================================
   LETTERBOXD MATCH — Local CORS Proxy
   
   Simple Node.js proxy that fetches Letterboxd pages server-side
   and returns the HTML with proper CORS headers.
   
   This eliminates ALL dependency on third-party CORS proxy services
   (which are unreliable, rate-limited, and frequently go offline).
   
   Usage:
     node proxy-server.js
   
   Then open http://localhost:3000 (serves the app AND proxies requests)
   ================================================================ */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const STATIC_DIR = __dirname;

// ── MIME types for static file serving ───────────────────────────────────────
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

// ── CORS headers applied to ALL responses ────────────────────────────────────
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Proxy: fetch a URL server-side and return the HTML ───────────────────────
function proxyRequest(targetUrl, res) {
  const startTime = Date.now();
  
  const parsedUrl = new URL(targetUrl);
  if (parsedUrl.hostname !== 'letterboxd.com') {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden: only letterboxd.com URLs are allowed');
    return;
  }

  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
      'Accept-Encoding': 'identity',  // no compression for simplicity
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    // Follow redirects (Letterboxd sometimes redirects)
    if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
      const redirectUrl = new URL(proxyRes.headers.location, targetUrl).toString();
      console.log(`  ↳ Redirect ${proxyRes.statusCode} → ${redirectUrl}`);
      proxyRequest(redirectUrl, res);
      return;
    }

    setCorsHeaders(res);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.writeHead(proxyRes.statusCode);

    let body = '';
    proxyRes.on('data', chunk => { body += chunk; });
    proxyRes.on('end', () => {
      const elapsed = Date.now() - startTime;
      console.log(`  ✅ ${proxyRes.statusCode} — ${body.length} chars — ${elapsed}ms`);
      res.end(body);
    });
  });

  proxyReq.on('error', (err) => {
    console.error(`  ❌ Proxy error: ${err.message}`);
    setCorsHeaders(res);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`Proxy error: ${err.message}`);
  });

  proxyReq.setTimeout(15000, () => {
    proxyReq.destroy();
    setCorsHeaders(res);
    res.writeHead(504, { 'Content-Type': 'text/plain' });
    res.end('Proxy timeout (15s)');
  });

  proxyReq.end();
}

// ── Static file server ───────────────────────────────────────────────────────
function serveStaticFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    setCorsHeaders(res);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// ── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);

  // ── Proxy endpoint: /proxy?url=<encoded_letterboxd_url> ────────────────
  if (parsedUrl.pathname === '/proxy') {
    const targetUrl = parsedUrl.query.url;
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing ?url= parameter');
      return;
    }
    console.log(`[Proxy] ${targetUrl}`);
    proxyRequest(targetUrl, res);
    return;
  }

  // ── Static files ───────────────────────────────────────────────────────
  let reqPath = parsedUrl.pathname;
  let filePath = path.join(STATIC_DIR, reqPath);

  // If path is directory or root, look for index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // Security: prevent path traversal
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  serveStaticFile(filePath, res);
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║   🎬 LetterboxdMatch — Server running       ║');
  console.log(`  ║   → http://localhost:${PORT}                    ║`);
  console.log('  ║                                              ║');
  console.log('  ║   Proxy endpoint:                            ║');
  console.log(`  ║   → http://localhost:${PORT}/proxy?url=...       ║`);
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
});
