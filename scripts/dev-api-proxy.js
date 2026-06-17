const http = require('http');
const https = require('https');

const PORT = Number(process.env.AKYL_API_PROXY_PORT || 8090);
const TARGET_ORIGIN = process.env.AKYL_API_PROXY_TARGET || 'https://akyl-cheshmesi.ru';
const target = new URL(TARGET_ORIGIN);

const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || 'http://localhost:8081';
  const requestHeaders = req.headers['access-control-request-headers'];

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    requestHeaders || 'Authorization, Content-Type, Accept, X-Requested-With',
  );
  res.setHeader('Access-Control-Max-Age', '86400');
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function copyHeaders(req) {
  const headers = {};

  Object.entries(req.headers).forEach(([key, value]) => {
    if (!hopByHopHeaders.has(key.toLowerCase()) && value !== undefined) {
      headers[key] = value;
    }
  });

  headers.host = target.host;
  return headers;
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!req.url || !req.url.startsWith('/api/')) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ detail: 'Proxy only forwards /api/* requests' }));
    return;
  }

  try {
    const body = await collectBody(req);
    const upstreamPath = `${req.url}`;

    const upstreamReq = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        method: req.method,
        path: upstreamPath,
        headers: {
          ...copyHeaders(req),
          'content-length': body.length,
        },
      },
      upstreamRes => {
        res.statusCode = upstreamRes.statusCode || 500;

        Object.entries(upstreamRes.headers).forEach(([key, value]) => {
          if (!hopByHopHeaders.has(key.toLowerCase()) && value !== undefined) {
            res.setHeader(key, value);
          }
        });

        setCorsHeaders(req, res);
        upstreamRes.pipe(res);
      },
    );

    upstreamReq.on('error', error => {
      console.error('[api-proxy] upstream error:', error.message);
      if (!res.headersSent) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
      }
      res.end(JSON.stringify({ detail: 'API proxy upstream error' }));
    });

    if (body.length > 0) {
      upstreamReq.write(body);
    }

    upstreamReq.end();
  } catch (error) {
    console.error('[api-proxy] request error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ detail: 'API proxy error' }));
  }
});

server.listen(PORT, () => {
  console.log(`[api-proxy] http://localhost:${PORT}/api -> ${TARGET_ORIGIN}/api`);
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.log(`[api-proxy] port ${PORT} is already in use, continuing without starting another proxy`);
    return;
  }

  console.error('[api-proxy] failed:', error);
  process.exitCode = 1;
});
