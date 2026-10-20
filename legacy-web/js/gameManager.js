/**
 * 游戏逻辑管理器
 * 门票系统 + 讨价还价 + 对话驱动
 */

class GameManager {
    constructor() {
        this.reset();
    }

    reset() {
        this.amounts = GameConfig.amounts.slice();
        this.shuffleAmounts();
        this.boxes = new Array(26).fill(true);
        this.currentRound = 0;
        this.openedInRound = 0;
        this.playerBox = -1;
        this.playerBoxAmount = 0;
        this.state = GameConfig.states.WAITING_PAYMENT;
        this.bankerOffer = 0;
        this.finalPrize = 0;
        this.remainingAmounts = this.amounts.slice();

        // 门票
        this.tickets = 1;        // 每日免费1张
        this.shareUsed = false;  // 分享是否已用
        this.bargainUsed = false; // 讨价还价是否已用
    }

    shuffleAmounts() {
        for (var i = this.amounts.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = this.amounts[i]; this.amounts[i] = this.amounts[j]; this.amounts[j] = t;
        }
    }

    getDialog(key, params) {
        var msg = GameConfig.dialog[key] || '';
        if (params) {
            for (var k in params) {
                msg = msg.replace('{' + k + '}', params[k]);
            }
        }
        return msg;
    }

    fmt(n) {
        if (n < 1) return '$' + n;
        return '$' + n.toLocaleString();
    }

    // ====== 门票 ======
    useTicket() {
        if (this.tickets <= 0) {
            return { success: false, message: this.getDialog('noTicket') };
        }
        this.tickets--;
        this.state = GameConfig.states.READY;
        return { success: true, tickets: this.tickets };
    }

    shareTicket() {
        if (this.shareUsed) {
            return { success: false, message: this.getDialog('shareMax') };
        }
        this.shareUsed = true;
        this.tickets++;
        return { success: true, tickets: this.tickets, message: this.getDialog('shareDone') };
    }

    watchAdTicket() {
        this.tickets++;
        return { success: true, tickets: this.tickets, message: this.getDialog('adDone') };
    }

    // ====== 游戏 ======
    selectPlayerBox(boxIndex) {
        if (this.state !== GameConfig.states.READY) return false;
        if (boxIndex < 0 || boxIndex >= 26) return false;
        this.playerBox = boxIndex;
        this.playerBoxAmount = this.amounts[boxIndex];
        this.state = GameConfig.states.PLAYING;
        return true;
    }

    openBox(boxIndex) {
        if (this.state !== GameConfig.states.PLAYING) return { success: false };
        if (boxIndex < 0 || boxIndex >= 26 || !this.boxes[boxIndex] || boxIndex === this.playerBox) return { success: false };

        this.boxes[boxIndex] = false;
        this.openedInRound++;
        var amount = this.amounts[boxIndex];
        var idx = this.remainingAmounts.indexOf(amount);
        if (idx !== -1) this.remainingAmounts.splice(idx, 1);

        var round = GameConfig.rounds[this.currentRound];
        var roundComplete = this.openedInRound >= round.openCount;

        if (roundComplete) {
            this.bankerOffer = this.calcOffer();
            this.state = GameConfig.states.BANKER_OFFER;
        }

        return { success: true, boxIndex: boxIndex, amount: amount, roundComplete: roundComplete, bankerOffer: this.bankerOffer };
    }

    calcOffer() {
        var sum = 0;
        for (var i = 0; i < this.remainingAmounts.length; i++) sum += this.remainingAmounts[i];
        var ev = sum / this.remainingAmounts.length;
        var r = (Math.random() - 0.5) * 2 * GameConfig.banker.randomRange;
        var m = GameConfig.banker.baseMultiplier + r + this.currentRound * GameConfig.banker.roundBonus;
        return Math.floor(ev * m);
    }

    // 讨价还价
    bargainStart() {
        if (this.state !== GameConfig.states.BANKER_OFFER) return { success: false };
        if (this.bargainUsed) return { success: false };
        this.state = GameConfig.states.BARGAIN;
        return { success: true };
    }

    bargainSubmit(playerOffer) {
        if (this.state !== GameConfig.states.BARGAIN) return { success: false };
        // 银行家一定拒绝
        this.bargainUsed = true;
        return { success: true, playerOffer: playerOffer };
    }

    bargainContinue() {
        if (this.state !== GameConfig.states.BARGAIN) return { success: false };
        this.currentRound++;
        this.openedInRound = 0;
        if (this.remainingAmounts.length <= 1) {
            this.state = GameConfig.states.GAME_OVER;
            this.finalPrize = this.amounts[this.playerBox];
            return { success: true, gameOver: true, prize: this.finalPrize, playerBox: this.playerBox, playerBoxAmount: this.playerBoxAmount };
        }
        this.state = GameConfig.states.PLAYING;
        return { success: true, nextRound: this.currentRound };
    }

    deal() {
        if (this.state !== GameConfig.states.BANKER_OFFER) return { success: false };
        this.state = GameConfig.states.DEAL;
        this.finalPrize = this.bankerOffer;
        return { success: true, prize: this.finalPrize, playerBox: this.playerBox, playerBoxAmount: this.playerBoxAmount };
    }

    noDeal() {
        if (this.state !== GameConfig.states.BANKER_OFFER) return { success: false };
        this.currentRound++;
        this.openedInRound = 0;
        if (this.remainingAmounts.length <= 1) {
            this.state = GameConfig.states.GAME_OVER;
            this.finalPrize = this.amounts[this.playerBox];
            return { success: true, gameOver: true, prize: this.finalPrize, playerBox: this.playerBox, playerBoxAmount: this.playerBoxAmount };
        }
        this.state = GameConfig.states.PLAYING;
        return { success: true };
    }

    getState() {
        return {
            boxes: this.boxes.slice(),
            amounts: this.amounts.slice(),
            playerBox: this.playerBox,
            playerBoxAmount: this.playerBoxAmount,
            currentRound: this.currentRound,
            state: this.state,
            bankerOffer: this.bankerOffer,
            remainingAmounts: this.remainingAmounts.slice(),
            remainingCount: this.remainingAmounts.length,
            roundDesc: GameConfig.rounds[this.currentRound] ? GameConfig.rounds[this.currentRound].desc : '',
            tickets: this.tickets,
            shareUsed: this.shareUsed,
            bargainUsed: this.bargainUsed
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameManager;
}
