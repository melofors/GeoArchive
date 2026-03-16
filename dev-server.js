const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const chokidar = require('chokidar');

const PORT = 5500;
const WS_PORT = 35729;
const CLIENT_DIR = path.join(__dirname, 'client');

// WebSocket server for live reload
const wss = new WebSocket.Server({ port: WS_PORT });
wss.on('connection', (ws) => {
  console.log('🔌 Browser connected for live reload');
});

// Watch for file changes with POLLING (fixes WSL issue)
const watcher = chokidar.watch(CLIENT_DIR, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  usePolling: true,        // ADD THIS - fixes WSL
  interval: 300,           // ADD THIS - check every 300ms
  ignoreInitial: true
});

watcher.on('change', (filepath) => {
  const relative = path.relative(CLIENT_DIR, filepath);
  console.log(`🔄 File changed: ${relative}`);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send('reload');
    }
  });
});

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf'
};

const LIVE_RELOAD_SCRIPT = `
<script>
(function() {
  const ws = new WebSocket('ws://localhost:${WS_PORT}');
  ws.onopen = () => console.log('🔄 Live reload connected');
  ws.onmessage = () => {
    console.log('🔄 Reloading...');
    location.reload();
  };
  ws.onerror = (e) => console.error('Live reload error:', e);
  ws.onclose = () => setTimeout(() => location.reload(), 1000);
})();
</script>
`;

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(CLIENT_DIR, urlPath === '/' ? 'index.html' : urlPath);

  if (urlPath.startsWith('/user/')) {
    filePath = path.join(CLIENT_DIR, 'user.html');
  }

  const extname = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(CLIENT_DIR, 'index.html'), (indexErr, indexContent) => {
          if (indexErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            const html = indexContent.toString().replace('</body>', `${LIVE_RELOAD_SCRIPT}</body>`);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html, 'utf-8');
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`500 Internal Server Error: ${err.code}`);
      }
    } else {
      if (contentType === 'text/html') {
        const html = content.toString().replace('</body>', `${LIVE_RELOAD_SCRIPT}</body>`);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(html);
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Development server running at http://localhost:${PORT}/`);
  console.log(`📁 Serving files from: ${CLIENT_DIR}`);
  console.log(`🔄 Live reload enabled (polling mode for WSL)`);
  console.log(`🔄 SPA routing enabled for /user/* paths`);
  console.log(`\nPress Ctrl+C to stop`);
});