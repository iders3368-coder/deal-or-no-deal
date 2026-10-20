/**
 * 游戏控制器
 * 负责流程编排、触摸事件、台词节奏和平台能力调用。
 */

const GameConfig = require('./config');
const GameManager = require('./gameManager');
const Renderer = require('./renderer');
const AudioManager = require('./audio');
const platform = require('./platform');
const { fmt, getDialog } = require('./utils');

class GameApp {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.manager = new GameManager();
        this.renderer = new Renderer(canvas, this.ctx);
        this.audio = new AudioManager();
        this.ui = this.createUi();
        this.timers = [];
        this.pressedHit = null;
        this.started = false;
        this.rafId = null;

        const raf = typeof requestAnimationFrame === 'function'
            ? (callback) => requestAnimationFrame(callback)
            : (callback) => setTimeout(() => callback(Date.now()), 16);
        this.rafFn = raf;

        this.loop = this.loop.bind(this);
        this.bindInput();
        this.bindPlatform();
        this.bindKeyboard();
    }

    createUi() {
        return {
            overlay: 'ticket',
            inputLocked: false,
            allowBoxTap: false,
            adLoading: false,
            bargainText: '',
            bargainMessage: '',
            bargainLocked: false,
            result: null
        };
    }

    start() {
        if (this.started) return;
        this.started = true;
        this.showTicketScreen();
        this.schedule();
    }

    schedule() {
        this.rafId = this.rafFn(this.loop);
    }

    loop() {
        try {
            // 统一使用 Date.now()：requestAnimationFrame 的时间戳基准在部分环境不是 Unix 时间，
            // 混用会导致打字机、开箱动画和 Toast 判断失效。
            const time = Date.now();
            this.renderer.updateSpeech(time);
            const view = this.manager.getState();
            this.ui.allowBoxTap = !this.ui.inputLocked &&
                !this.renderer.isSpeechTyping() &&
                !this.ui.overlay;
            this.renderer.render(view, this.ui);
        } catch (error) {
            platform.logError(error);
        }
        this.schedule();
    }

    // ---------- 平台与输入 ----------

    bindPlatform() {
        platform.setupShareMenu();
        platform.onResize(() => this.renderer.resize());
        platform.onShow(() => {
            this.manager.refreshDaily();
        });
        platform.onHide(() => {
            this.audio.pauseAll();
        });
    }

    bindInput() {
        if (typeof tt === 'undefined' || !tt) return;
        if (typeof tt.onTouchStart === 'function') {
            tt.onTouchStart((event) => this.onTouchStart(event));
        }
        if (typeof tt.onTouchEnd === 'function') {
            tt.onTouchEnd((event) => this.onTouchEnd(event));
        }
        if (typeof tt.onTouchCancel === 'function') {
            tt.onTouchCancel(() => {
                this.pressedHit = null;
                this.renderer.setPressed(null);
            });
        }
    }

    bindKeyboard() {
        if (typeof window === 'undefined' || !window.addEventListener) return;
        window.addEventListener('keydown', (event) => {
            if (this.ui.overlay !== 'bargain') return;
            if (/^\d$/.test(event.key)) {
                this.onBargainKey(event.key);
            } else if (event.key === 'Backspace') {
                this.onBargainKey('back');
            } else if (event.key === 'Enter') {
                this.onBargainSubmit();
            } else if (event.key === 'Escape') {
                this.onBargainCancel();
            }
        });
    }

    getTouchPoint(event) {
        if (!event) return null;
        const list = (event.changedTouches && event.changedTouches.length)
            ? event.changedTouches
            : (event.touches && event.touches.length ? event.touches : null);
        if (!list) return null;
        const touch = list[0];
        const x = touch.clientX !== undefined ? touch.clientX : touch.pageX;
        const y = touch.clientY !== undefined ? touch.clientY : touch.pageY;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return { x, y };
    }

    onTouchStart(event) {
        const point = this.getTouchPoint(event);
        if (!point) return;
        const hit = this.renderer.hitTest(point.x, point.y);
        this.pressedHit = hit;
        this.renderer.setPressed(hit);
    }

    onTouchEnd(event) {
        const point = this.getTouchPoint(event);
        this.renderer.setPressed(null);
        if (!point) return;
        const hit = this.renderer.hitTest(point.x, point.y);
        const pressed = this.pressedHit;
        this.pressedHit = null;
        if (pressed !== hit) return;

        // 点击空白处或气泡可以跳过打字动画；弹层按钮仍然优先响应。
        if (this.renderer.isSpeechTyping() && (!hit || hit === 'speech')) {
            this.renderer.skipSpeech();
            return;
        }
        if (hit) this.handleHit(hit);
    }

    handleHit(hit) {
        if (hit === 'speech') {
            this.renderer.skipSpeech();
            return;
        }

        if (hit.indexOf('box:') === 0) {
            this.onBoxTap(Number(hit.slice(4)));
            return;
        }
        if (hit.indexOf('bargain:key:') === 0) {
            this.onBargainKey(hit.slice('bargain:key:'.length));
            return;
        }

        switch (hit) {
            case 'ticket:play':
                this.onPlay();
                break;
            case 'ticket:ad':
                this.onTicketAd();
                break;
            case 'ticket:share':
                this.onShare();
                break;
            case 'banker:deal':
                this.onDeal();
                break;
            case 'banker:noDeal':
                this.onNoDeal();
                break;
            case 'banker:bargain':
                this.onBargain();
                break;
            case 'bargain:submit':
                this.onBargainSubmit();
                break;
            case 'bargain:cancel':
                this.onBargainCancel();
                break;
            case 'result:restart':
                this.onRestart();
                break;
            default:
                break;
        }
    }

    // ---------- 门票 ----------

    showTicketScreen() {
        this.ui.overlay = 'ticket';
        this.ui.inputLocked = false;
        this.ui.allowBoxTap = false;
        this.ui.adLoading = false;
        this.ui.bargainText = '';
        this.ui.bargainMessage = '';
        this.ui.bargainLocked = false;
        this.ui.result = null;
        this.renderer.clearSpeech();
    }

    onPlay() {
        if (this.ui.overlay !== 'ticket' || this.ui.adLoading) return;
        const result = this.manager.useTicket();
        if (!result.success) {
            this.audio.play('reject');
            this.renderer.showToast(result.message || getDialog('noTicket'));
            return;
        }

        this.audio.play('click');
        this.ui.overlay = null;
        this.ui.inputLocked = true;
        this.ui.result = null;

        this.say(getDialog('welcome'), () => {
            this.say(getDialog('chooseBox', { count: GameConfig.amounts.length }), () => {
                this.ui.inputLocked = false;
            });
        });
    }

    onTicketAd() {
        if (this.ui.overlay !== 'ticket' || this.ui.adLoading) return;

        const available = this.manager.canWatchAd();
        if (!available.success) {
            this.renderer.showToast(available.message || getDialog('adLimit'));
            return;
        }

        this.ui.adLoading = true;
        this.audio.play('click');

        platform.showRewardedAd(GameConfig.ticket.adUnitId).then((result) => {
            this.ui.adLoading = false;
            if (result.ok) {
                const granted = this.manager.grantAdTicket();
                if (granted.success) {
                    this.audio.play('win');
                    this.renderer.showToast(getDialog('adDone'));
                } else {
                    this.renderer.showToast(granted.message || getDialog('adLimit'));
                }
                return;
            }

            if (result.reason === 'not_finished') {
                this.renderer.showToast(getDialog('adNotFinished'));
            } else if (result.reason === 'unconfigured') {
                this.renderer.showToast(getDialog('adNotConfigured'));
            } else {
                this.renderer.showToast(getDialog('adFail'));
            }
        }).catch(() => {
            this.ui.adLoading = false;
            this.renderer.showToast(getDialog('adFail'));
        });
    }

    onShare() {
        if (this.ui.overlay !== 'ticket' || this.ui.adLoading) return;
        this.audio.play('click');
        platform.shareGame();
    }

    // ---------- 开箱 ----------

    onBoxTap(index) {
        if (this.ui.inputLocked || this.ui.overlay || this.renderer.isSpeechTyping()) return;
        const view = this.manager.getState();

        if (view.state === GameConfig.states.READY) {
            const ok = this.manager.selectPlayerBox(index);
            if (!ok) return;
            this.audio.play('click');
            platform.vibrate();
            this.ui.inputLocked = true;
            this.say(getDialog('boxSelected', { n: index + 1 }), () => {
                const next = this.manager.getState();
                this.say(getDialog('roundStart', { count: next.openCount }), () => {
                    this.ui.inputLocked = false;
                });
            });
            return;
        }

        if (view.state === GameConfig.states.PLAYING) {
            const result = this.manager.openBox(index);
            if (!result.success) return;

            this.ui.inputLocked = true;
            this.audio.play('box_open');
            this.renderer.startFlip(index, result.amount);

            this.setTimer(() => {
                this.audio.play(this.revealSound(result.amount));
                const key = this.revealDialogKey(result.amount);
                this.say(getDialog(key, { n: index + 1, amount: fmt(result.amount) }), () => {
                    if (result.roundComplete) {
                        this.startBankerFlow();
                    } else {
                        this.ui.inputLocked = false;
                    }
                });
            }, 300);
        }
    }

    revealSound(amount) {
        if (amount >= 100000) return 'reveal_big';
        if (amount >= 1000) return 'reveal_mid';
        return 'reveal_small';
    }

    revealDialogKey(amount) {
        if (amount >= 100000) return 'openedBig';
        if (amount >= 1000) return 'openedMid';
        if (amount >= 100) return 'openedSmall';
        return 'openedTiny';
    }

    // ---------- 银行家 ----------

    startBankerFlow() {
        const view = this.manager.getState();
        const offer = view.bankerOffer;
        this.ui.inputLocked = true;
        this.audio.play('phone_ring');

        this.say(getDialog('bankerCalling'), () => {
            this.say(getDialog('hostCall'), () => {
                this.audio.play('banker');
                this.ui.overlay = 'banker';
                this.say(getDialog('offer', {
                    amount: fmt(offer),
                    n: view.playerBox + 1
                }) + ' ' + getDialog('dealOrNoDeal'));
            });
        });
    }

    onDeal() {
        if (this.ui.overlay !== 'banker') return;
        const result = this.manager.deal();
        if (!result.success) return;

        this.audio.play('deal');
        platform.vibrate();
        this.ui.overlay = null;
        this.ui.inputLocked = true;

        this.say(getDialog('dealResult', {
            prize: fmt(result.prize),
            n: result.playerBox + 1
        }), () => {
            this.showResult(result);
        });
    }

    onNoDeal() {
        if (this.ui.overlay !== 'banker') return;
        const result = this.manager.noDeal();
        if (!result.success) return;

        this.audio.play('no_deal');
        platform.vibrate();
        this.ui.overlay = null;
        this.ui.inputLocked = true;

        if (result.gameOver) {
            this.say(getDialog('gameOver', { n: result.playerBox + 1 }), () => {
                this.showResult(result);
            });
            return;
        }

        this.say(getDialog('noDealResult'), () => {
            this.say(getDialog('roundStart', { count: result.openCount }), () => {
                this.ui.inputLocked = false;
            });
        });
    }

    // ---------- 讨价还价 ----------

    onBargain() {
        if (this.ui.overlay !== 'banker') return;
        const result = this.manager.bargainStart();
        if (!result.success) {
            this.renderer.showToast(result.message || '现在不能讨价还价。');
            return;
        }

        this.audio.play('click');
        this.ui.overlay = 'bargain';
        this.ui.inputLocked = true;
        this.ui.bargainText = '';
        this.ui.bargainMessage = '';
        this.ui.bargainLocked = false;
        this.say(getDialog('bargainHint'));
    }

    onBargainKey(key) {
        if (this.ui.overlay !== 'bargain' || this.ui.bargainLocked) return;
        let text = this.ui.bargainText || '';

        if (key === 'back') {
            text = text.slice(0, -1);
        } else if (key === '00') {
            if (!text) text = '0';
            else text += '00';
        } else if (/^\d$/.test(key)) {
            if (text === '0') text = key;
            else text += key;
        }

        text = text.replace(/[^\d]/g, '').slice(0, 8);
        if (text.length > 1) text = text.replace(/^0+/, '');
        this.ui.bargainText = text;
        this.ui.bargainMessage = '';
        this.audio.play('click');
    }

    onBargainSubmit() {
        if (this.ui.overlay !== 'bargain' || this.ui.bargainLocked) return;
        const value = Number(this.ui.bargainText);
        if (!Number.isFinite(value) || value <= 0) {
            this.ui.bargainMessage = getDialog('bargainInvalid');
            this.audio.play('reject');
            return;
        }

        const result = this.manager.bargainSubmit(value);
        if (!result.success) {
            this.ui.bargainMessage = result.message || getDialog('bargainInvalid');
            this.audio.play('reject');
            return;
        }

        if (result.accepted) {
            this.audio.play('deal');
            platform.vibrate();
            this.ui.overlay = null;
            this.ui.inputLocked = true;
            this.say(getDialog('bargainAccept', { amount: fmt(result.prize) }), () => {
                this.showResult(result);
            });
            return;
        }

        this.audio.play('reject');
        this.ui.bargainMessage = result.message || getDialog('bargainRejectHigh');
        this.ui.inputLocked = true;
        this.ui.bargainLocked = true;
        this.ui.bargainText = '';
        this.say(this.ui.bargainMessage, () => {
            this.ui.overlay = 'banker';
            this.ui.bargainMessage = '';
            this.ui.bargainLocked = false;
            this.say(getDialog('dealOrNoDeal'));
        });
    }

    onBargainCancel() {
        if (this.ui.overlay !== 'bargain' || this.ui.bargainLocked) return;
        const result = this.manager.bargainCancel();
        if (!result.success) return;
        this.audio.play('click');
        this.ui.overlay = 'banker';
        this.ui.bargainText = '';
        this.ui.bargainMessage = '';
        this.say(getDialog('dealOrNoDeal'));
    }

    // ---------- 结果 ----------

    showResult(result) {
        const prize = Number(result.prize) || 0;
        const boxAmount = Number(result.playerBoxAmount) || 0;
        const isNoDeal = result.type === 'nodeal';
        const benchmark = isNoDeal ? (Number(result.lastOffer) || 0) : boxAmount;
        const diff = prize - benchmark;
        const offer = isNoDeal ? (result.lastOffer || 0) : (result.offer || 0);

        let title;
        if (diff > 0) {
            title = isNoDeal ? '你赢了银行家！' : (result.bargain ? '这一口价，漂亮！' : '卖得漂亮！');
        } else if (diff < 0) {
            title = '银行家赢了';
        } else {
            title = '平局！';
        }

        let message;
        if (isNoDeal) {
            message = '你拒绝了 ' + fmt(result.lastOffer) + '，你的 ' +
                (result.playerBox + 1) + ' 号箱里是 ' + fmt(boxAmount) + '。';
            if (result.otherBoxAmount !== undefined && result.otherBoxAmount !== null) {
                message += ' 另一个箱子是 ' + fmt(result.otherBoxAmount) + '。';
            }
        } else if (result.bargain) {
            message = '你讨价还价到 ' + fmt(prize) + '（原报价 ' + fmt(result.compareOffer) +
                '），你的 ' + (result.playerBox + 1) + ' 号箱里是 ' + fmt(boxAmount) + '。';
        } else {
            message = '你接受了 ' + fmt(offer) + '，你的 ' +
                (result.playerBox + 1) + ' 号箱里是 ' + fmt(boxAmount) + '。';
        }

        this.renderer.clearSpeech();
        this.ui.result = {
            title,
            message,
            prize,
            boxAmount,
            offer,
            otherBoxAmount: result.otherBoxAmount,
            win: diff > 0,
            lose: diff < 0
        };
        this.ui.overlay = 'result';
        this.ui.inputLocked = true;

        if (diff > 0) this.audio.play('win');
        else if (diff < 0) this.audio.play('lose');
        else this.audio.play('click');
    }

    onRestart() {
        if (this.ui.overlay !== 'result') return;
        this.clearTimers();
        this.renderer.clearSpeech();
        this.renderer.flip = null;
        this.manager.resetGame();
        this.ui = this.createUi();
        this.ui.overlay = 'ticket';
        this.audio.play('click');
    }

    // ---------- 台词与计时器 ----------

    say(text, callback) {
        this.renderer.setSpeech(text, callback);
    }

    setTimer(callback, delay) {
        const id = setTimeout(() => {
            this.timers = this.timers.filter((timer) => timer !== id);
            callback();
        }, delay);
        this.timers.push(id);
    }

    clearTimers() {
        this.timers.forEach((id) => clearTimeout(id));
        this.timers = [];
    }
}

module.exports = GameApp;
