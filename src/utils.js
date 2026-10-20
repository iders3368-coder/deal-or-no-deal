/**
 * 通用工具函数
 * 所有金额展示都经过这里，避免 undefined / NaN 进入 UI。
 */

const GameConfig = require('./config');

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

/**
 * 完整金额：$2,500,000 / $0.01
 */
function fmt(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '$0';
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    if (abs > 0 && abs < 1) {
        return sign + '$' + abs.toFixed(2);
    }
    const text = String(Math.floor(abs)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sign + '$' + text;
}

/**
 * 紧凑金额：$2.5M / $750K / $500
 * 用于空间有限的箱子背面。
 */
function fmtShort(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '$0';
    if (n >= 1000000) {
        const m = n / 1000000;
        return '$' + (Number.isInteger(m) ? m.toFixed(0) : m.toFixed(1)) + 'M';
    }
    if (n >= 1000) {
        const k = n / 1000;
        return '$' + k.toFixed(0) + 'K';
    }
    return fmt(n);
}

function getDialog(key, params) {
    const dialog = GameConfig.dialog;
    let text = dialog[key] || '';
    if (params) {
        Object.keys(params).forEach((name) => {
            text = text.split('{' + name + '}').join(String(params[name]));
        });
    }
    return text;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function todayKey(date) {
    const d = date instanceof Date ? date : new Date();
    const pad = (n) => (n < 10 ? '0' + n : String(n));
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function sum(list) {
    return list.reduce((total, value) => total + value, 0);
}

function average(list) {
    return list.length ? sum(list) / list.length : 0;
}

module.exports = {
    fmt,
    fmtShort,
    getDialog,
    clamp,
    todayKey,
    sum,
    average,
    isFiniteNumber
};
