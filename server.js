const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
};

function proxyFetch(srcUrl, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(srcUrl);
    const mod = parsed.protocol === 'https:' ? https : http;
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.iesdouyin.com/',
        ...headers,
      }
    };
    const req = mod.get(srcUrl, opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        proxyFetch(res.headers.location, opts.headers).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (pathname === '/proxy') {
    const srcUrl = url.searchParams.get('url');
    if (!srcUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end('{"code":400,"msg":"no url"}');
      return;
    }

    const apiUrl = `https://api.bugpk.com/api/douyin?url=${encodeURIComponent(srcUrl)}`;

    https.get(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (prxRes) => {
      let data = '';
      prxRes.on('data', chunk => data += chunk);
      prxRes.on('end', () => {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(data);
      });
    }).on('error', (e) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(`{"code":502,"msg":"proxy error: ${e.message}"}`);
    });
    return;
  }

  if (pathname === '/download') {
    const videoUrl = url.searchParams.get('url');
    const filename = url.searchParams.get('name') || 'video.mp4';
    if (!videoUrl) {
      res.writeHead(400);
      res.end('no url');
      return;
    }

    log('代理下载: ' + videoUrl.slice(0, 80));

    proxyFetch(videoUrl).then(buf => {
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': buf.length,
      });
      res.end(buf);
    }).catch(e => {
      res.writeHead(502);
      res.end('download error: ' + e.message);
    });
    return;
  }

  let filePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.join(__dirname, filePath);
  const ext = path.extname(fullPath);

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(content);
  });
}).listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});

let log = (...args) => console.log(...args);