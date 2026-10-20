/**
 * 音效管理器
 * 抖音端使用 tt.createInnerAudioContext；浏览器预览使用 HTMLAudioElement。
 * 只创建少量音频上下文循环复用，避免真机上创建过多实例。
 */

const GameConfig = require('./config');

const SOURCES = {
    click: 'audio/click.wav',
    box_open: 'audio/box_open.wav',
    reveal_small: 'audio/reveal_small.wav',
    reveal_mid: 'audio/reveal_mid.wav',
    reveal_big: 'audio/reveal_big.wav',
    phone_ring: 'audio/phone_ring.wav',
    banker: 'audio/banker.wav',
    deal: 'audio/deal.wav',
    no_deal: 'audio/no_deal.wav',
    win: 'audio/win.wav',
    lose: 'audio/lose.wav',
    reject: 'audio/reject.wav'
};

const POOL_SIZE = 4;

class AudioManager {
    constructor() {
        this.enabled = true;
        this.pool = [];
        this.index = 0;
        this.base = '';
        if (typeof tt !== 'undefined' && tt && tt.__audioBase) {
            this.base = tt.__audioBase;
        }
    }

    create() {
        if (typeof tt !== 'undefined' && tt && typeof tt.createInnerAudioContext === 'function') {
            try {
                const audio = tt.createInnerAudioContext();
                audio.volume = GameConfig.audio.volume;
                if ('obeyMuteSwitch' in audio) audio.obeyMuteSwitch = true;
                if (audio.onError) audio.onError(() => {});
                return audio;
            } catch (error) {
                return null;
            }
        }

        if (typeof Audio !== 'undefined') {
            try {
                const audio = new Audio();
                audio.volume = GameConfig.audio.volume;
                return audio;
            } catch (error) {
                return null;
            }
        }
        return null;
    }

    ensurePool() {
        if (this.pool.length) return;
        for (let i = 0; i < POOL_SIZE; i += 1) {
            this.pool.push(this.create());
        }
    }

    play(name) {
        if (!this.enabled) return;
        const src = SOURCES[name];
        if (!src) return;

        this.ensurePool();
        const audio = this.pool[this.index % this.pool.length];
        this.index += 1;
        if (!audio) return;

        try {
            if (audio.stop) audio.stop();
            else if (audio.pause) audio.pause();
            audio.src = this.base + src;
            audio.volume = GameConfig.audio.volume;
            const promise = audio.play();
            if (promise && typeof promise.catch === 'function') promise.catch(() => {});
        } catch (error) {
            // 音效失败不影响游戏流程。
        }
    }

    pauseAll() {
        this.pool.forEach((audio) => {
            if (audio && audio.pause) {
                try {
                    audio.pause();
                } catch (error) {}
            }
        });
    }

    setEnabled(enabled) {
        this.enabled = !!enabled;
        if (!this.enabled) this.pauseAll();
    }
}

module.exports = AudioManager;
