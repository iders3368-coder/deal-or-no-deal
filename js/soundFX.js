/**
 * 音效管理器
 * 使用 Web Audio API 生成所有音效，无需外部文件
 */

var SoundFX = {
    ctx: null,

    init: function() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) {
            console.log('Web Audio API not supported');
        }
    },

    ensureCtx: function() {
        if (!this.ctx) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    },

    // 播放简单音调
    tone: function(freq, duration, type, vol) {
        var ctx = this.ensureCtx();
        if (!ctx) return;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        gain.gain.value = vol || 0.15;
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    },

    // 箱子打开音效（翻转声）
    boxOpen: function() {
        var ctx = this.ensureCtx();
        if (!ctx) return;
        // 翻转嗖声
        this.tone(800, 0.15, 'sine', 0.12);
        var self = this;
        setTimeout(function() { self.tone(1200, 0.1, 'sine', 0.08); }, 80);
    },

    // 小金额 - 欢快弹跳音
    revealSmall: function() {
        var ctx = this.ensureCtx();
        if (!ctx) return;
        this.tone(523, 0.1, 'sine', 0.15);  // C5
        var self = this;
        setTimeout(function() { self.tone(659, 0.1, 'sine', 0.12); }, 80);  // E5
        setTimeout(function() { self.tone(784, 0.15, 'sine', 0.1); }, 160); // G5
    },

    // 中等金额 - 平淡音
    revealMid: function() {
        this.tone(440, 0.2, 'triangle', 0.12);
    },

    // 大金额 - 震撼下降音
    revealBig: function() {
        var ctx = this.ensureCtx();
        if (!ctx) return;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 400;
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.6);
        gain.gain.value = 0.12;
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
        // 低音冲击
        this.tone(80, 0.4, 'sine', 0.15);
    },

    // 电话铃声
    phoneRing: function() {
        var ctx = this.ensureCtx();
        if (!ctx) return;
        var self = this;
        for (var i = 0; i < 4; i++) {
            (function(delay) {
                setTimeout(function() {
                    self.tone(800, 0.12, 'square', 0.08);
                    setTimeout(function() { self.tone(1000, 0.12, 'square', 0.06); }, 130);
                }, delay);
            })(i * 280);
        }
    },

    // 银行家出价 - 不祥的低音
    bankerOffer: function() {
        var ctx = this.ensureCtx();
        if (!ctx) return;
        this.tone(200, 0.3, 'sawtooth', 0.1);
        var self = this;
        setTimeout(function() { self.tone(150, 0.5, 'sine', 0.12); }, 200);
    },

    // 成交 - 下降音（遗憾）
    deal: function() {
        var ctx = this.ensureCtx();
        if (!ctx) return;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 600;
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.4);
        gain.gain.value = 0.15;
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
    },

    // 继续 - 上升音（激昂）
    noDeal: function() {
        var ctx = this.ensureCtx();
        if (!ctx) return;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 300;
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
        gain.gain.value = 0.15;
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
    },

    // 胜利 - 欢快旋律
    win: function() {
        var self = this;
        var notes = [523, 659, 784, 1047]; // C E G C+
        notes.forEach(function(f, i) {
            setTimeout(function() { self.tone(f, 0.2, 'sine', 0.12); }, i * 120);
        });
    },

    // 失败 - 悲伤下降
    lose: function() {
        var self = this;
        var notes = [400, 350, 300, 200];
        notes.forEach(function(f, i) {
            setTimeout(function() { self.tone(f, 0.25, 'sawtooth', 0.08); }, i * 180);
        });
    },

    // 讨价还价被拒 - 失败音
    reject: function() {
        this.tone(300, 0.15, 'square', 0.1);
        var self = this;
        setTimeout(function() { self.tone(200, 0.3, 'square', 0.1); }, 150);
    },

    // 按钮点击
    click: function() {
        this.tone(600, 0.06, 'sine', 0.08);
    }
};
