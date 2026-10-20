const test = require('node:test');
const assert = require('node:assert/strict');

const GameConfig = require('../src/config');
const GameManager = require('../src/gameManager');
const { fmt, fmtShort } = require('../src/utils');

function createHarness(initialDate) {
    let current = new Date(initialDate || '2026-10-20T10:00:00');
    const map = new Map();
    const storage = {
        get(key, fallback) {
            return map.has(key) ? map.get(key) : fallback;
        },
        set(key, value) {
            map.set(key, value);
        },
        remove(key) {
            map.delete(key);
        }
    };
    const manager = new GameManager({
        storage,
        now: () => current,
        random: () => 0.5
    });
    return {
        manager,
        map,
        setDate(value) {
            current = new Date(value);
        }
    };
}

function openUntilOffer(manager) {
    while (manager.state === GameConfig.states.PLAYING) {
        let opened = false;
        for (let i = 0; i < manager.boxes.length; i += 1) {
            if (manager.boxes[i] && i !== manager.playerBox) {
                const result = manager.openBox(i);
                assert.equal(result.success, true);
                opened = true;
                break;
            }
        }
        assert.equal(opened, true, 'should have an openable box');
    }
    assert.equal(manager.state, GameConfig.states.BANKER_OFFER);
}

test('轮次配置正好覆盖 24 次开箱，最后保留 2 个箱子', () => {
    const total = GameConfig.rounds.reduce((sum, round) => sum + round.openCount, 0);
    assert.equal(GameConfig.amounts.length, 26);
    assert.equal(total, 24);
    assert.equal(total, GameConfig.amounts.length - 2);
});

test('金额格式化不会抛异常，也不会依赖 toLocaleString', () => {
    assert.equal(fmt(undefined), '$0');
    assert.equal(fmt(NaN), '$0');
    assert.equal(fmt(0.01), '$0.01');
    assert.equal(fmt(2500000), '$2,500,000');
    assert.equal(fmtShort(2500000), '$2.5M');
    assert.equal(fmtShort(750000), '$750K');
});

test('首次启动获得每日免费门票，使用后不会在 resetGame 中恢复', () => {
    const h = createHarness();
    assert.equal(h.manager.getTickets(), 1);

    const used = h.manager.useTicket();
    assert.equal(used.success, true);
    assert.equal(h.manager.getTickets(), 0);
    assert.equal(h.manager.state, GameConfig.states.READY);

    h.manager.resetGame();
    assert.equal(h.manager.state, GameConfig.states.WAITING_PAYMENT);
    assert.equal(h.manager.getTickets(), 0);
});

test('无门票时不能开始，跨天后恢复每日免费门票', () => {
    const h = createHarness('2026-10-20T10:00:00');
    assert.equal(h.manager.useTicket().success, true);
    h.manager.resetGame();
    const failed = h.manager.useTicket();
    assert.equal(failed.success, false);

    h.setDate('2026-10-21T09:00:00');
    h.manager.refreshDaily();
    assert.equal(h.manager.getTickets(), 1);
    assert.equal(h.manager.useTicket().success, true);
});

test('选箱、开满一轮后进入银行家报价', () => {
    const h = createHarness();
    assert.equal(h.manager.useTicket().success, true);
    assert.equal(h.manager.selectPlayerBox(0), true);
    assert.equal(h.manager.state, GameConfig.states.PLAYING);

    let result = null;
    for (let i = 1; i <= 6; i += 1) {
        result = h.manager.openBox(i);
        assert.equal(result.success, true);
    }

    assert.equal(result.roundComplete, true);
    assert.equal(h.manager.state, GameConfig.states.BANKER_OFFER);
    assert.ok(result.offer >= 1);
    assert.equal(h.manager.getState().remainingCount, 20);
});

test('玩家自己的箱子和已开箱不能再次打开', () => {
    const h = createHarness();
    h.manager.useTicket();
    h.manager.selectPlayerBox(0);
    assert.equal(h.manager.openBox(0).success, false);
    assert.equal(h.manager.openBox(1).success, true);
    assert.equal(h.manager.openBox(1).success, false);
});

test('完整 No Deal 流程：24 次开箱、终局返回 prize 和另一个箱子', () => {
    const h = createHarness();
    h.manager.useTicket();
    h.manager.selectPlayerBox(0);

    let opens = 0;
    let guard = 0;
    while (h.manager.state !== GameConfig.states.GAME_OVER && guard < 50) {
        guard += 1;
        if (h.manager.state === GameConfig.states.PLAYING) {
            for (let i = 0; i < h.manager.boxes.length; i += 1) {
                if (h.manager.boxes[i] && i !== h.manager.playerBox) {
                    const r = h.manager.openBox(i);
                    assert.equal(r.success, true);
                    opens += 1;
                    break;
                }
            }
        } else if (h.manager.state === GameConfig.states.BANKER_OFFER) {
            const r = h.manager.noDeal();
            assert.equal(r.success, true);
            if (r.gameOver) {
                assert.equal(r.type, 'nodeal');
                assert.equal(typeof r.prize, 'number');
                assert.equal(r.prize, h.manager.boxAmounts[0]);
                assert.equal(typeof r.lastOffer, 'number');
                assert.ok(r.otherBox >= 0);
                assert.equal(typeof r.otherBoxAmount, 'number');
            }
        } else {
            assert.fail('unexpected state: ' + h.manager.state);
        }
    }

    assert.equal(guard < 50, true);
    assert.equal(opens, 24);
    assert.equal(h.manager.state, GameConfig.states.GAME_OVER);
    assert.equal(h.manager.remainingAmounts.length, 2);
    assert.equal(h.manager.getState().remainingCount, 2);
    assert.equal(typeof h.manager.getState().prize, 'number');
    assert.equal(h.manager.getState().prize, h.manager.boxAmounts[0]);
});

test('Deal 返回胜利金额，并揭晓玩家箱子', () => {
    const h = createHarness();
    h.manager.useTicket();
    h.manager.selectPlayerBox(0);
    openUntilOffer(h.manager);

    const offer = h.manager.bankerOffer;
    const result = h.manager.deal();
    assert.equal(result.success, true);
    assert.equal(result.prize, offer);
    assert.equal(result.offer, offer);
    assert.equal(result.playerBoxAmount, h.manager.boxAmounts[0]);
    assert.equal(h.manager.state, GameConfig.states.DEAL);
    assert.equal(h.manager.revealed[0], h.manager.boxAmounts[0]);
    assert.equal(h.manager.getState().prize, offer);
});

test('讨价还价：高于报价且不过分可以成交', () => {
    const h = createHarness();
    h.manager.useTicket();
    h.manager.selectPlayerBox(0);
    openUntilOffer(h.manager);

    const offer = h.manager.bankerOffer;
    const started = h.manager.bargainStart();
    assert.equal(started.success, true);
    assert.equal(h.manager.state, GameConfig.states.BARGAIN);

    const result = h.manager.bargainSubmit(offer + 1);
    assert.equal(result.accepted, true);
    assert.equal(result.prize, offer + 1);
    assert.equal(h.manager.state, GameConfig.states.DEAL);
});

test('讨价还价：出价太低保持输入，出价太贪被拒绝并回到报价', () => {
    const h = createHarness();
    h.manager.useTicket();
    h.manager.selectPlayerBox(0);
    openUntilOffer(h.manager);
    const offer = h.manager.bankerOffer;

    assert.equal(h.manager.bargainStart().success, true);
    const low = h.manager.bargainSubmit(offer);
    assert.equal(low.accepted, false);
    assert.equal(low.keepOpen, true);
    assert.equal(h.manager.state, GameConfig.states.BARGAIN);

    const high = h.manager.bargainSubmit(999999999);
    assert.equal(high.accepted, false);
    assert.equal(high.keepOpen, false);
    assert.equal(h.manager.state, GameConfig.states.BANKER_OFFER);

    const deal = h.manager.deal();
    assert.equal(deal.success, true);
    assert.equal(deal.prize, offer);
});

test('UI 状态不会泄露未开箱金额', () => {
    const h = createHarness();
    h.manager.useTicket();
    h.manager.selectPlayerBox(0);
    const state = h.manager.getState();
    assert.equal('boxAmounts' in state, false);
    assert.equal('amounts' in state, false);
    assert.equal(state.playerBoxAmount, undefined);

    h.manager.openBox(1);
    const playing = h.manager.getState();
    assert.equal('boxAmounts' in playing, false);
    assert.deepEqual(Object.keys(playing.revealed), ['1']);
    assert.equal(playing.playerBoxAmount, undefined);
});

test('广告奖励门票可以叠加', () => {
    const h = createHarness();
    const before = h.manager.getTickets();
    const result = h.manager.grantAdTicket();
    assert.equal(result.success, true);
    assert.equal(h.manager.getTickets(), before + 1);
});

test('关闭无限广告后，每日广告奖励有上限并在次日重置', () => {
    const oldUnlimited = GameConfig.ticket.adUnlimited;
    const oldLimit = GameConfig.ticket.adDailyLimit;
    GameConfig.ticket.adUnlimited = false;
    GameConfig.ticket.adDailyLimit = 2;

    try {
        const h = createHarness('2026-10-20T10:00:00');
        assert.equal(h.manager.getTickets(), 1);
        assert.equal(h.manager.canWatchAd().remaining, 2);
        assert.equal(h.manager.grantAdTicket().success, true);
        assert.equal(h.manager.grantAdTicket().success, true);
        assert.equal(h.manager.getTickets(), 3);
        assert.equal(h.manager.canWatchAd().success, false);

        const capped = h.manager.grantAdTicket();
        assert.equal(capped.success, false);
        assert.equal(h.manager.getTickets(), 3);

        h.setDate('2026-10-21T10:00:00');
        h.manager.refreshDaily();
        assert.equal(h.manager.getTickets(), 4);
        assert.equal(h.manager.canWatchAd().remaining, 2);
        assert.equal(h.manager.grantAdTicket().success, true);
        assert.equal(h.manager.getTickets(), 5);
    } finally {
        GameConfig.ticket.adUnlimited = oldUnlimited;
        GameConfig.ticket.adDailyLimit = oldLimit;
    }
});
