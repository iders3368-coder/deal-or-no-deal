/**
 * 存储适配器
 * 优先使用抖音 tt 存储，其次浏览器 localStorage，最后内存（主要用于 Node 测试）。
 */

const GameConfig = require('./config');
const { todayKey } = require('./utils');

function createBackend() {
    if (typeof tt !== 'undefined' && tt && typeof tt.getStorageSync === 'function') {
        return {
            name: 'tt',
            get(key) { return tt.getStorageSync(key); },
            set(key, value) { tt.setStorageSync(key, value); },
            remove(key) { if (tt.removeStorageSync) tt.removeStorageSync(key); }
        };
    }

    if (typeof localStorage !== 'undefined') {
        return {
            name: 'localStorage',
            get(key) { return localStorage.getItem(key); },
            set(key, value) { localStorage.setItem(key, value); },
            remove(key) { localStorage.removeItem(key); }
        };
    }

    const memory = new Map();
    return {
        name: 'memory',
        get(key) { return memory.has(key) ? memory.get(key) : undefined; },
        set(key, value) { memory.set(key, value); },
        remove(key) { memory.delete(key); }
    };
}

function createStorage(backend) {
    const store = backend || createBackend();
    const prefix = GameConfig.storage.prefix;

    function readRaw(key) {
        try {
            return store.get(prefix + key);
        } catch (error) {
            return undefined;
        }
    }

    function get(key, fallback) {
        const raw = readRaw(key);
        if (raw === undefined || raw === null || raw === '') return fallback;
        if (typeof raw !== 'string') return raw;
        try {
            return JSON.parse(raw);
        } catch (error) {
            return raw;
        }
    }

    function set(key, value) {
        try {
            store.set(prefix + key, JSON.stringify(value));
            return true;
        } catch (error) {
            return false;
        }
    }

    function remove(key) {
        try {
            store.remove(prefix + key);
            return true;
        } catch (error) {
            return false;
        }
    }

    return {
        get,
        set,
        remove,
        todayKey,
        backendName: store.name || 'custom'
    };
}

module.exports = { createStorage, createBackend, todayKey };
