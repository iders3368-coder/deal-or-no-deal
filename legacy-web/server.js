/**
 * 旧版 H5 原型本地服务器（仅保留作对照，不属于抖音小游戏包）
 * 已修复路径穿越，并且只监听本机。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3002);
const HOST = '127.0.0.1';
const ROOT = path.resolve(__dirname);

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function safeResolve(urlPath) {
    let pathname;
    try {
        pathname = decodeURIComponent(urlPath.split('?')[0]);
    } catch (error) {
        return null;
    }
    if (pathname === '/') pathname = '/pages/index.html';
    if (pathname.endsWith('/')) pathname += 'index.html';
    if (!['/pages/', '/css/', '/js/'].some((prefix) => pathname.startsWith(prefix))) return null;

    const relative = pathname.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    if (relative.split('/').some((segment) => segment === '..' || segment === '')) return null;
    const absolute = path.resolve(ROOT, relative);
    if (absolute !== ROOT && !absolute.startsWith(ROOT + path.sep)) return null;
    return absolute;
}

const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Method Not Allowed');
        return;
    }

    const filePath = safeResolve(req.url || '/');
    if (!filePath) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (statError, stat) => {
        if (statError || !stat.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Content-Length': stat.size,
            'Cache-Control': 'no-store'
        });
        if (req.method === 'HEAD') {
            res.end();
            return;
        }
        fs.createReadStream(filePath).pipe(res);
    });
});

server.on('error', (error) => {
    console.error(error.code === 'EADDRINUSE' ? ('端口 ' + PORT + ' 已被占用。') : error);
    process.exit(1);
});

server.listen(PORT, HOST, () => {
    console.log('旧版 H5 预览：http://' + HOST + ':' + PORT + '/');
    console.log('按 Ctrl+C 停止服务器。');
});
