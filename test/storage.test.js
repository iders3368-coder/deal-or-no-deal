const test = require('node:test');
const assert = require('node:assert/strict');

const { createStorage, todayKey } = require('../src/storage');

function memoryBackend() {
    const map = new Map();
    return {
        name: 'test',
        get(key) { return map.has(key) ? map.get(key) : undefined; },
        set(key, value) { map.set(key, value); },
        remove(key) { map.delete(key); }
    };
}

test('存储适配器会序列化对象，并提供默认值', () => {
    const storage = createStorage(memoryBackend());
    assert.equal(storage.get('missing', 7), 7);

    storage.set('settings', { sound: true, tickets: 2 });
    assert.deepEqual(storage.get('settings'), { sound: true, tickets: 2 });

    storage.set('tickets', 3);
    assert.equal(storage.get('tickets'), 3);

    storage.remove('tickets');
    assert.equal(storage.get('tickets', 0), 0);
});

test('日期键使用本地年月日', () => {
    assert.equal(todayKey(new Date(2026, 9, 20, 23, 59, 59)), '2026-10-20');
    assert.equal(todayKey(new Date(2026, 0, 1, 0, 0, 0)), '2026-01-01');
});
