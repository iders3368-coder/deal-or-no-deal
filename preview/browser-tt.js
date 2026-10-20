/**
 * 浏览器预览用的 tt 兼容层。
 * 仅用于本地调试，不会被打包进抖音小游戏。
 */

(function () {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const params = new URLSearchParams(window.location.search);
    const forcedWidth = Number(params.get('w'));
    const forcedHeight = Number(params.get('h'));
    const viewport = {
        width: Number.isFinite(forcedWidth) && forcedWidth > 0 ? Math.floor(forcedWidth) : window.innerWidth,
        height: Number.isFinite(forcedHeight) && forcedHeight > 0 ? Math.floor(forcedHeight) : window.innerHeight
    };
    if (viewport.width !== window.innerWidth || viewport.height !== window.innerHeight) {
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';
        document.body.style.width = viewport.width + 'px';
        document.body.style.height = viewport.height + 'px';
        document.body.style.overflow = 'hidden';
    }

    const touchStartListeners = [];
    const touchEndListeners = [];
    const touchMoveListeners = [];
    const touchCancelListeners = [];

    function makeTouch(event) {
        const rect = canvas.getBoundingClientRect();
        return {
            clientX: event.clientX - rect.left,
            clientY: event.clientY - rect.top,
            pageX: event.pageX,
            pageY: event.pageY
        };
    }

    function emit(listeners, event) {
        const touch = makeTouch(event);
        const payload = { touches: [touch], changedTouches: [touch] };
        listeners.forEach((listener) => {
            try {
                listener(payload);
            } catch (error) {
                console.error(error);
            }
        });
    }

    canvas.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        emit(touchStartListeners, event);
    });
    window.addEventListener('pointerup', (event) => {
        emit(touchEndListeners, event);
    });
    canvas.addEventListener('pointermove', (event) => {
        emit(touchMoveListeners, event);
    });
    canvas.addEventListener('pointercancel', (event) => {
        emit(touchCancelListeners, event);
    });

    function storageKey(key) {
        return 'dond-preview:' + key;
    }

    function showToast(message) {
        let el = document.getElementById('preview-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'preview-toast';
            document.body.appendChild(el);
        }
        el.textContent = String(message || '');
        el.style.opacity = '1';
        clearTimeout(el._timer);
        el._timer = setTimeout(() => {
            el.style.opacity = '0';
        }, 2200);
    }

    function createAudio() {
        const audio = {
            _src: '',
            _current: null,
            volume: 0.6,
            onError() {},
            offError() {},
            play() {
                try {
                    if (this._current) this._current.pause();
                    this._current = new Audio(this._src);
                    this._current.volume = this.volume;
                    const promise = this._current.play();
                    return promise && promise.catch ? promise : Promise.resolve();
                } catch (error) {
                    return Promise.resolve();
                }
            },
            pause() {
                if (this._current) this._current.pause();
            },
            stop() {
                if (this._current) {
                    this._current.pause();
                    this._current.currentTime = 0;
                    this._current = null;
                }
            },
            seek() {
                if (this._current) this._current.currentTime = 0;
            },
            destroy() {
                this.stop();
                this._current = null;
            }
        };
        Object.defineProperty(audio, 'src', {
            get() { return this._src; },
            set(value) { this._src = value; }
        });
        return audio;
    }

    function createRewardedVideoAd() {
        const closeListeners = [];
        const errorListeners = [];
        const ad = {
            onClose(callback) { closeListeners.push(callback); },
            offClose(callback) {
                const index = closeListeners.indexOf(callback);
                if (index !== -1) closeListeners.splice(index, 1);
            },
            onError(callback) { errorListeners.push(callback); },
            offError(callback) {
                const index = errorListeners.indexOf(callback);
                if (index !== -1) errorListeners.splice(index, 1);
            },
            load() { return Promise.resolve(); },
            show() {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        const ended = window.confirm('模拟激励视频：点击“确定”表示完整看完，点击“取消”表示中途关闭。');
                        closeListeners.slice().forEach((callback) => callback({ isEnded: ended }));
                        resolve();
                    }, 350);
                });
            },
            destroy() {}
        };
        return ad;
    }

    const tt = {
        __isMock: true,
        __audioBase: '../',
        __shareInfo: null,
        createCanvas() { return canvas; },
        getSystemInfoSync() {
            const width = viewport.width;
            const height = viewport.height;
            return {
                windowWidth: width,
                windowHeight: height,
                screenWidth: width,
                screenHeight: height,
                pixelRatio: window.devicePixelRatio || 1,
                safeArea: { top: 0, bottom: height, left: 0, right: width, width, height }
            };
        },
        getMenuButtonBoundingClientRect() {
            return { top: 8, right: window.innerWidth - 8, bottom: 40, left: window.innerWidth - 96, width: 88, height: 32 };
        },
        showToast(options) {
            showToast(options && options.title);
        },
        showModal(options) {
            const ok = window.confirm(((options && options.title) || '') + '\n' + ((options && options.content) || ''));
            if (options && options.success) options.success({ confirm: ok, cancel: !ok });
        },
        shareAppMessage(options) {
            const info = (tt.__shareInfo && tt.__shareInfo()) || {};
            const title = (options && options.title) || info.title || '一掷千金';
            if (navigator.share) {
                navigator.share({ title }).catch(() => {});
            } else {
                showToast('分享面板（浏览器预览）');
            }
        },
        onShareAppMessage(callback) {
            tt.__shareInfo = callback;
        },
        showShareMenu() {},
        vibrateShort() {
            if (navigator.vibrate) navigator.vibrate(15);
        },
        onTouchStart(callback) { touchStartListeners.push(callback); },
        onTouchEnd(callback) { touchEndListeners.push(callback); },
        onTouchMove(callback) { touchMoveListeners.push(callback); },
        onTouchCancel(callback) { touchCancelListeners.push(callback); },
        onWindowResize(callback) {
            window.addEventListener('resize', callback);
        },
        onShow(callback) {
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) callback();
            });
        },
        onHide(callback) {
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) callback();
            });
        },
        onError(callback) {
            window.addEventListener('error', callback);
        },
        getStorageSync(key) {
            const value = localStorage.getItem(storageKey(key));
            return value === null ? '' : value;
        },
        setStorageSync(key, value) {
            localStorage.setItem(storageKey(key), String(value));
        },
        removeStorageSync(key) {
            localStorage.removeItem(storageKey(key));
        },
        getStorageInfoSync() {
            return { keys: Object.keys(localStorage), currentSize: 0, limitSize: 10240 };
        },
        createInnerAudioContext() { return createAudio(); },
        createRewardedVideoAd() { return createRewardedVideoAd(); },
        setPreferredFramesPerSecond() {},
        exitMiniProgram() {}
    };

    window.tt = tt;
})();
