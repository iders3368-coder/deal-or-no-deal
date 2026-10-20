const test = require('node:test');
const assert = require('node:assert/strict');

const GameConfig = require('../src/config');
const GameManager = require('../src/gameManager');

function seededRandom(seed) {
    let state = seed >>> 0;
    return function () {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function memoryStorage() {
    const map = new Map();
    return {
        get(key, fallback) { return map.has(key) ? map.get(key) : fallback; },
        set(key, value) { map.set(key, value); },
        remove(key) { map.delete(key); }
    };
}

test('随机模拟 5000 局：成交/继续/讨价还价都不会抛异常，终局数据完整', () => {
    const random = seededRandom(20261020);
    const storage = memoryStorage();
    let deals = 0;
    let noDeals = 0;
    let bargains = 0;

    for (let gameIndex = 0; gameIndex < 5000; gameIndex += 1) {
        const manager = new GameManager({
            storage,
            now: () => new Date('2026-10-20T12:00:00'),
            random
        });
        manager.tickets = 1;
        manager.saveSession();

        const started = manager.useTicket();
        assert.equal(started.success, true);

        const playerBox = Math.floor(random() * manager.boxes.length);
        assert.equal(manager.selectPlayerBox(playerBox), true);

        let guard = 0;
        while (
            manager.state !== GameConfig.states.DEAL &&
            manager.state !== GameConfig.states.GAME_OVER &&
            guard < 100
        ) {
            guard += 1;

            if (manager.state === GameConfig.states.PLAYING) {
                const candidates = [];
                for (let i = 0; i < manager.boxes.length; i += 1) {
                    if (manager.boxes[i] && i !== manager.playerBox) candidates.push(i);
                }
                assert.ok(candidates.length > 0);
                const index = candidates[Math.floor(random() * candidates.length)];
                const opened = manager.openBox(index);
                assert.equal(opened.success, true);
                assert.notEqual(index, playerBox);
            } else if (manager.state === GameConfig.states.BANKER_OFFER) {
                const action = random();
                if (action < 0.35) {
                    const result = manager.deal();
                    assert.equal(result.success, true);
                    assert.equal(typeof result.prize, 'number');
                    assert.equal(result.prize, manager.bankerOffer);
                    deals += 1;
                } else if (action < 0.75 || manager.bargainUsed) {
                    const result = manager.noDeal();
                    assert.equal(result.success, true);
                    if (!result.gameOver) {
                        assert.equal(manager.state, GameConfig.states.PLAYING);
                    }
                } else {
                    const startedBargain = manager.bargainStart();
                    assert.equal(startedBargain.success, true);
                    bargains += 1;
                    const ask = Math.max(1, Math.floor(manager.bankerOffer * (0.8 + random() * 1.2)));
                    const counter = manager.bargainSubmit(ask);
                    assert.equal(typeof counter.accepted, 'boolean');
                    if (!counter.accepted && manager.state === GameConfig.states.BARGAIN) {
                        manager.bargainCancel();
                    }
                }
            } else if (manager.state === GameConfig.states.BARGAIN) {
                manager.bargainCancel();
            } else {
                assert.fail('unexpected state: ' + manager.state);
            }
        }

        assert.equal(guard < 100, true);
        if (manager.state === GameConfig.states.GAME_OVER) {
            noDeals += 1;
            assert.equal(typeof manager.finalPrize, 'number');
            assert.equal(manager.finalPrize, manager.playerBoxAmount);
            assert.equal(manager.remainingAmounts.length, 2);
            assert.ok(manager.lastOffer > 0);
            assert.ok(manager.otherBox >= 0);
        } else {
            assert.equal(manager.state, GameConfig.states.DEAL);
            assert.ok(manager.finalPrize > 0);
        }
    }

    assert.ok(deals > 0);
    assert.ok(noDeals > 0);
    assert.ok(bargains > 0);
});
