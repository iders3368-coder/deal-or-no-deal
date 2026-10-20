/**
 * 把 CommonJS 源码打包成浏览器预览可用的单文件。
 * 不引入任何第三方依赖，运行：node tools/build-preview.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENTRY = 'game.js';
const OUTPUT = path.join(ROOT, 'preview', 'bundle.js');

const modules = new Map();

function normalizeId(id) {
    return id.replace(/\\/g, '/');
}

function resolveId(fromId, request) {
    if (!request.startsWith('.')) {
        throw new Error('预览打包不支持外部模块：' + request + '（来自 ' + fromId + '）');
    }
    let target = path.posix.normalize(path.posix.join(path.posix.dirname(fromId), request));
    if (!path.posix.extname(target)) target += '.js';
    return target;
}

function addModule(id) {
    const moduleId = normalizeId(id);
    if (modules.has(moduleId)) return;

    const absolute = path.join(ROOT, moduleId);
    if (!fs.existsSync(absolute)) {
        throw new Error('找不到模块：' + moduleId);
    }

    const code = fs.readFileSync(absolute, 'utf8');
    modules.set(moduleId, code);

    const regex = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = regex.exec(code))) {
        addModule(resolveId(moduleId, match[1]));
    }
}

addModule(ENTRY);

const parts = [];
parts.push('/* 自动生成：node tools/build-preview.js */');
parts.push('(function () {');
parts.push('  "use strict";');
parts.push('  const registry = Object.create(null);');
parts.push('  const cache = Object.create(null);');

modules.forEach((code, id) => {
    parts.push('  registry[' + JSON.stringify(id) + '] = function (module, exports, require) {');
    parts.push(code);
    parts.push('  };');
});

parts.push('  function makeRequire(fromId) {');
parts.push('    return function (request) {');
parts.push('      let target = request;');
parts.push('      if (request.charAt(0) === ".") {');
parts.push('        target = normalize(fromId, request);');
parts.push('      }');
parts.push('      return load(target);');
parts.push('    };');
parts.push('  }');
parts.push('  function normalize(fromId, request) {');
parts.push('    const fromDir = fromId.indexOf("/") === -1 ? "" : fromId.slice(0, fromId.lastIndexOf("/"));');
parts.push('    const segments = (fromDir ? fromDir.split("/") : []).concat(request.split("/"));');
parts.push('    const result = [];');
parts.push('    segments.forEach(function (segment) {');
parts.push('      if (!segment || segment === ".") return;');
parts.push('      if (segment === "..") result.pop();');
parts.push('      else result.push(segment);');
parts.push('    });');
parts.push('    let target = result.join("/");');
parts.push('    if (!/\\.js$/.test(target)) target += ".js";');
parts.push('    return target;');
parts.push('  }');
parts.push('  function load(id) {');
parts.push('    if (cache[id]) return cache[id].exports;');
parts.push('    if (!registry[id]) throw new Error("缺少模块：" + id);');
parts.push('    const module = { exports: {} };');
parts.push('    cache[id] = module;');
parts.push('    registry[id](module, module.exports, makeRequire(id));');
parts.push('    return module.exports;');
parts.push('  }');
parts.push('  load(' + JSON.stringify(ENTRY) + ');');
parts.push('})();');

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, parts.join('\n'), 'utf8');
console.log('预览已生成：preview/bundle.js');
console.log('包含模块：' + Array.from(modules.keys()).join(', '));
