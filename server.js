/**
 * 本地预览服务器（仅开发使用）
 * - 只绑定 127.0.0.1
 * - 严格防止路径穿越
 * - 默认打开 preview/index.html
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const PORT = Number(process.env.PORT || 3000);
const HOST = '127.0.0.1';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
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

    if (pathname === '/' || pathname === '') pathname = '/preview/index.html';
    if (pathname.endsWith('/')) pathname += 'index.html';
    if (pathname.indexOf('\0') !== -1) return null;

    // 预览服务器只暴露预览页和音效，不暴露源码、脚本和配置。
    const allowed = ['/preview/', '/audio/'];
    if (!allowed.some((prefix) => pathname.startsWith(prefix))) return null;

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
            res.end('Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const headers = {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Content-Length': stat.size,
            'Cache-Control': 'no-store'
        };
        res.writeHead(200, headers);
        if (req.method === 'HEAD') {
            res.end();
            return;
        }

        const stream = fs.createReadStream(filePath);
        stream.on('error', () => {
            if (!res.headersSent) res.writeHead(500);
            res.end();
        });
        stream.pipe(res);
    });
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error('端口 ' + PORT + ' 已被占用。请关闭占用端口的程序，或在命令行改用其他端口：');
        console.error('  cmd:        set PORT=3001 && node server.js');
        console.error('  PowerShell: $env:PORT=3001; node server.js');
    } else {
        console.error(error);
    }
    process.exit(1);
});

server.listen(PORT, HOST, () => {
    console.log('预览地址：http://' + HOST + ':' + PORT + '/preview/');
    console.log('按 Ctrl+C 停止服务器。');
});
