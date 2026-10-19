const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

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

var server = http.createServer(function(req, res) {
    var urlPath = req.url.split('?')[0];
    if (urlPath === '/') {
        urlPath = '/pages/index.html';
    }

    var filePath = path.join(ROOT, urlPath);
    var ext = path.extname(filePath).toLowerCase();
    var contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, function(err, data) {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, '0.0.0.0', function() {
    console.log('=========================================');
    console.log('  一掷千金 - 本地测试服务器');
    console.log('=========================================');
    console.log('');
    console.log('  服务器已启动: http://localhost:' + PORT);
    console.log('');
    console.log('  按 Ctrl+C 停止服务器');
    console.log('=========================================');
});
