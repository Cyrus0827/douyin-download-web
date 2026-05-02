const https = require('https');
const http = require('http');

function fetchUrl(srcUrl, headers) {
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
        fetchUrl(res.headers.location, opts.headers).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(chunks), headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    if (pathname === '/api/proxy') {
      const srcUrl = url.searchParams.get('url');
      if (!srcUrl) {
        res.status(400).json({ code: 400, msg: 'no url' });
        return;
      }

      const apiUrl = `https://api.bugpk.com/api/douyin?url=${encodeURIComponent(srcUrl)}`;
      const result = await fetchUrl(apiUrl);

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      res.status(200).send(result.data.toString());
      return;
    }

    if (pathname === '/api/download') {
      const videoUrl = url.searchParams.get('url');
      const filename = url.searchParams.get('name') || 'video.mp4';
      if (!videoUrl) {
        res.status(400).send('no url');
        return;
      }

      const result = await fetchUrl(videoUrl);

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Content-Length', result.data.length);
      res.status(200).send(result.data);
      return;
    }

    res.status(404).send('Not found');
  } catch (e) {
    res.status(502).send('error: ' + e.message);
  }
};