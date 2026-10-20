/**
 * 游戏逻辑管理器
 *
 * 设计原则：
 * 1. 不直接依赖 DOM / Canvas / tt API，方便 Node 自动化测试。
 * 2. 终局统一返回 prize 字段，避免 UI 读取不存在的 finalPrize 导致崩溃。
 * 3. 只暴露已经开出的金额，未开箱金额不会进入 UI 状态。
 */

const GameConfig = require('./config');
const { createStorage } = require('./storage');
const { fmt, getDialog, todayKey, average } = require('./utils');

class GameManager {
    constructor(options) {
        const opts = options || {};
        this.storage = opts.storage || createStorage();
        this.now = opts.now || (() => new Date());
        this.random = opts.random || Math.random;

        this.tickets = 0;
        this.lastFreeDate = '';
        this.adCount = 0;
        this.adDate = '';
        this.loadSession();
        this.resetGame();
    }

    // ---------- 门票与会话 ----------

    loadSession() {
        const storedTickets = Number(this.storage.get('tickets', 0));
        this.tickets = Number.isFinite(storedTickets) ? Math.max(0, Math.floor(storedTickets)) : 0;
        this.lastFreeDate = this.storage.get('lastFreeDate', '');
        const storedAdCount = Number(this.storage.get('adCount', 0));
        this.adCount = Number.isFinite(storedAdCount) ? Math.max(0, Math.floor(storedAdCount)) : 0;
        this.adDate = this.storage.get('adDate', '');
        this.refreshDaily();
    }

    saveSession() {
        this.storage.set('tickets', this.tickets);
        this.storage.set('lastFreeDate', this.lastFreeDate);
        this.storage.set('adCount', this.adCount);
        this.storage.set('adDate', this.adDate);
    }

    /**
     * 跨天刷新每日免费门票和广告次数。
     * 可以安全地重复调用。
     */
    refreshDaily() {
        const today = todayKey(this.now());
        let changed = false;

        if (this.lastFreeDate !== today) {
            this.tickets += GameConfig.ticket.dailyFree;
            this.lastFreeDate = today;
            this.adCount = 0;
            this.adDate = today;
            changed = true;
        }

        if (this.adDate !== today) {
            this.adCount = 0;
            this.adDate = today;
            changed = true;
        }

        if (changed) this.saveSession();
    }

    useTicket() {
        this.refreshDaily();

        if (this.state !== GameConfig.states.WAITING_PAYMENT) {
            return { success: false, message: '当前不能开始新一局。' };
        }

        if (this.tickets <= 0 && !GameConfig.ticket.debugUnlimited) {
            return { success: false, message: getDialog('noTicket') };
        }

        if (!GameConfig.ticket.debugUnlimited) {
            this.tickets -= 1;
            this.saveSession();
        }

        this.resetGame();
        this.state = GameConfig.states.READY;
        return {
            success: true,
            tickets: this.tickets,
            state: this.state
        };
    }

    grantAdTicket() {
        this.refreshDaily();

        if (this.state !== GameConfig.states.WAITING_PAYMENT) {
            return { success: false, message: '当前不能领取广告奖励。' };
        }

        if (!GameConfig.ticket.adUnlimited && this.adCount >= GameConfig.ticket.adDailyLimit) {
            return { success: false, message: getDialog('adLimit') };
        }

        this.tickets += 1;
        this.adCount += 1;
        this.saveSession();
        return { success: true, tickets: this.tickets };
    }

    canWatchAd() {
        this.refreshDaily();
        if (GameConfig.ticket.adUnlimited) {
            return { success: true, remaining: Infinity };
        }
        const remaining = Math.max(0, GameConfig.ticket.adDailyLimit - this.adCount);
        if (remaining <= 0) {
            return { success: false, message: getDialog('adLimit') };
        }
        return { success: true, remaining };
    }

    // ---------- 局面初始化 ----------

    resetGame() {
        this.state = GameConfig.states.WAITING_PAYMENT;
        this.boxAmounts = this.shuffle(GameConfig.amounts.slice());
        this.boxes = this.boxAmounts.map(() => true);
        this.revealed = {};
        this.playerBox = -1;
        this.playerBoxAmount = 0;
        this.currentRound = 0;
        this.openedInRound = 0;
        this.remainingAmounts = GameConfig.amounts.slice();
        this.bankerOffer = 0;
        this.lastOffer = 0;
        this.finalPrize = 0;
        this.bargainUsed = false;
        this.otherBox = -1;
        this.otherBoxAmount = 0;
    }

    shuffle(list) {
        const result = list.slice();
        for (let i = result.length - 1; i > 0; i -= 1) {
            const j = Math.floor(this.random() * (i + 1));
            const tmp = result[i];
            result[i] = result[j];
            result[j] = tmp;
        }
        return result;
    }

    // ---------- 核心流程 ----------

    selectPlayerBox(index) {
        if (this.state !== GameConfig.states.READY) return false;
        if (!this.isValidBox(index) || !this.boxes[index]) return false;

        this.playerBox = index;
        this.playerBoxAmount = this.boxAmounts[index];
        this.state = GameConfig.states.PLAYING;
        return true;
    }

    openBox(index) {
        if (this.state !== GameConfig.states.PLAYING) {
            return { success: false, message: '当前不能开箱。' };
        }
        if (!this.isValidBox(index) || !this.boxes[index] || index === this.playerBox) {
            return { success: false, message: '这个箱子不能打开。' };
        }

        const round = GameConfig.rounds[this.currentRound];
        if (!round) {
            return { success: false, message: '轮次数据异常。' };
        }

        const amount = this.boxAmounts[index];
        this.boxes[index] = false;
        this.revealed[index] = amount;
        this.openedInRound += 1;

        const amountIndex = this.remainingAmounts.indexOf(amount);
        if (amountIndex !== -1) this.remainingAmounts.splice(amountIndex, 1);

        let roundComplete = this.openedInRound >= round.openCount;

        // 安全兜底：无论轮次配置如何，只剩 2 个箱子时必须进入银行家报价。
        if (this.remainingAmounts.length <= 2) roundComplete = true;

        if (roundComplete) {
            this.lastOffer = this.calculateOffer();
            this.bankerOffer = this.lastOffer;
            this.state = GameConfig.states.BANKER_OFFER;
        }

        return {
            success: true,
            amount,
            roundComplete,
            offer: this.bankerOffer,
            openedInRound: this.openedInRound,
            required: round.openCount,
            remainingCount: this.remainingAmounts.length,
            state: this.state
        };
    }

    calculateOffer() {
        const count = this.remainingAmounts.length;
        if (!count) return 0;

        const expectedValue = average(this.remainingAmounts);
        const cfg = GameConfig.banker;
        const randomOffset = (this.random() - 0.5) * cfg.randomRange;
        const multiplier = Math.max(
            0.12,
            Math.min(0.9, cfg.baseMultiplier + randomOffset + this.currentRound * cfg.roundBonus)
        );

        // 至少给 1，避免 0 元报价；同时不允许超过剩余期望值。
        return Math.max(1, Math.min(Math.floor(expectedValue), Math.floor(expectedValue * multiplier)));
    }

    deal() {
        if (this.state !== GameConfig.states.BANKER_OFFER) {
            return { success: false, message: '当前没有可接受的报价。' };
        }

        this.lastOffer = this.bankerOffer;
        this.finalPrize = this.bankerOffer;
        this.state = GameConfig.states.DEAL;
        if (this.playerBox >= 0) {
            this.revealed[this.playerBox] = this.playerBoxAmount;
        }

        return {
            success: true,
            type: 'deal',
            prize: this.finalPrize,
            offer: this.bankerOffer,
            compareOffer: this.bankerOffer,
            playerBox: this.playerBox,
            playerBoxAmount: this.playerBoxAmount
        };
    }

    noDeal() {
        if (this.state !== GameConfig.states.BANKER_OFFER) {
            return { success: false, message: '当前没有可拒绝的报价。' };
        }

        this.lastOffer = this.bankerOffer;
        this.currentRound += 1;
        this.openedInRound = 0;

        if (
            this.remainingAmounts.length <= 2 ||
            this.currentRound >= GameConfig.rounds.length
        ) {
            return this.finishNoDeal();
        }

        this.state = GameConfig.states.PLAYING;
        const round = GameConfig.rounds[this.currentRound];
        return {
            success: true,
            gameOver: false,
            type: 'continue',
            nextRound: this.currentRound,
            openCount: round.openCount,
            desc: round.desc,
            lastOffer: this.lastOffer
        };
    }

    finishNoDeal() {
        this.state = GameConfig.states.GAME_OVER;
        this.finalPrize = this.playerBoxAmount;

        if (this.playerBox >= 0) {
            this.revealed[this.playerBox] = this.playerBoxAmount;
        }

        // 终局只剩两个箱子：找到另一个未开的箱子并揭晓。
        let other = -1;
        for (let i = 0; i < this.boxes.length; i += 1) {
            if (this.boxes[i] && i !== this.playerBox) {
                other = i;
                break;
            }
        }
        if (other !== -1) {
            this.otherBox = other;
            this.otherBoxAmount = this.boxAmounts[other];
            this.revealed[other] = this.otherBoxAmount;
        }

        return {
            success: true,
            gameOver: true,
            type: 'nodeal',
            prize: this.finalPrize,
            lastOffer: this.lastOffer,
            compareOffer: this.lastOffer,
            playerBox: this.playerBox,
            playerBoxAmount: this.playerBoxAmount,
            otherBox: this.otherBox,
            otherBoxAmount: this.otherBoxAmount
        };
    }

    // ---------- 讨价还价 ----------

    bargainStart() {
        if (this.state !== GameConfig.states.BANKER_OFFER) {
            return { success: false, message: '当前不能讨价还价。' };
        }
        if (this.bargainUsed) {
            return { success: false, message: '本局已经使用过讨价还价了。' };
        }

        this.bargainUsed = true;
        this.state = GameConfig.states.BARGAIN;
        return {
            success: true,
            offer: this.bankerOffer,
            playerBox: this.playerBox
        };
    }

    /**
     * 银行家是否接受出价：
     * - 出价必须高于当前报价；
     * - 出价不能超过剩余期望值的 65%；
     * - 否则拒绝，回到原报价。
     * 这是一个策略判断，不是随机结果。
     */
    bargainSubmit(value) {
        if (this.state !== GameConfig.states.BARGAIN) {
            return { success: false, accepted: false, message: '当前不能提交出价。' };
        }

        const ask = Math.floor(Number(value));
        if (!Number.isFinite(ask) || ask <= 0) {
            return {
                success: false,
                accepted: false,
                keepOpen: true,
                message: getDialog('bargainInvalid')
            };
        }

        if (ask <= this.bankerOffer) {
            return {
                success: false,
                accepted: false,
                keepOpen: true,
                message: getDialog('bargainRejectLow')
            };
        }

        const expectedValue = average(this.remainingAmounts);
        const maxAccept = Math.max(this.bankerOffer + 1, Math.floor(expectedValue * 0.65));

        if (ask > maxAccept) {
            this.state = GameConfig.states.BANKER_OFFER;
            return {
                success: true,
                accepted: false,
                keepOpen: false,
                message: getDialog('bargainRejectHigh'),
                offer: this.bankerOffer
            };
        }

        const originalOffer = this.bankerOffer;
        this.finalPrize = ask;
        this.bankerOffer = ask;
        this.state = GameConfig.states.DEAL;
        if (this.playerBox >= 0) {
            this.revealed[this.playerBox] = this.playerBoxAmount;
        }

        return {
            success: true,
            accepted: true,
            type: 'deal',
            bargain: true,
            prize: this.finalPrize,
            offer: this.bankerOffer,
            compareOffer: originalOffer,
            playerBox: this.playerBox,
            playerBoxAmount: this.playerBoxAmount
        };
    }

    bargainCancel() {
        if (this.state !== GameConfig.states.BARGAIN) {
            return { success: false, message: '当前没有可取消的讨价还价。' };
        }
        this.state = GameConfig.states.BANKER_OFFER;
        return { success: true, offer: this.bankerOffer };
    }

    // ---------- 状态查询 ----------

    getState() {
        this.refreshDaily();
        const round = GameConfig.rounds[this.currentRound];
        const isFinal = this.state === GameConfig.states.DEAL || this.state === GameConfig.states.GAME_OVER;
        const revealed = {};
        Object.keys(this.revealed).forEach((key) => {
            revealed[key] = this.revealed[key];
        });

        return {
            state: this.state,
            boxes: this.boxes.slice(),
            revealed,
            playerBox: this.playerBox,
            playerBoxAmount: isFinal ? this.playerBoxAmount : undefined,
            currentRound: this.currentRound,
            openedInRound: this.openedInRound,
            roundDesc: round ? round.desc : '最终时刻',
            openCount: round ? round.openCount : 0,
            remainingAmounts: this.remainingAmounts.slice(),
            remainingCount: this.remainingAmounts.length,
            bankerOffer: this.bankerOffer,
            lastOffer: this.lastOffer,
            prize: isFinal ? this.finalPrize : undefined,
            bargainUsed: this.bargainUsed,
            tickets: this.tickets,
            otherBox: this.otherBox,
            otherBoxAmount: this.otherBoxAmount,
            debugUnlimited: GameConfig.ticket.debugUnlimited
        };
    }

    getTickets() {
        return this.tickets;
    }

    isValidBox(index) {
        return Number.isInteger(index) && index >= 0 && index < this.boxes.length;
    }

    fmt(value) {
        return fmt(value);
    }

    dialog(key, params) {
        return getDialog(key, params);
    }
}

module.exports = GameManager;
