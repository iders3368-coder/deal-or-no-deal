/**
 * 抖音小游戏平台适配层
 * 所有 tt.* 调用集中在这里，浏览器预览时由 preview/browser-tt.js 提供兼容实现。
 */

const GameConfig = require('./config');

function hasTT() {
    return typeof tt !== 'undefined' && !!tt;
}

function isMock() {
    return hasTT() && tt.__isMock === true;
}

function getMenuInfo() {
    if (hasTT() && typeof tt.getMenuButtonBoundingClientRect === 'function') {
        try {
            const rect = tt.getMenuButtonBoundingClientRect() || {};
            return {
                menuTop: Math.max(0, rect.top || 0),
                menuBottom: Math.max(0, rect.bottom || 0)
            };
        } catch (error) {}
    }
    return { menuTop: 0, menuBottom: 0 };
}

function getSystemInfo() {
    const menu = getMenuInfo();

    if (hasTT() && typeof tt.getSystemInfoSync === 'function') {
        const info = tt.getSystemInfoSync();
        const width = info.windowWidth || info.screenWidth || 375;
        const height = info.windowHeight || info.screenHeight || 667;
        return {
            windowWidth: width,
            windowHeight: height,
            pixelRatio: info.pixelRatio || 1,
            safeArea: info.safeArea || { top: 0, bottom: height, left: 0, right: width, width, height },
            menuTop: menu.menuTop,
            menuBottom: menu.menuBottom
        };
    }

    if (typeof window !== 'undefined') {
        return {
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
            pixelRatio: window.devicePixelRatio || 1,
            safeArea: { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth, width: window.innerWidth, height: window.innerHeight },
            menuTop: menu.menuTop,
            menuBottom: menu.menuBottom
        };
    }

    return {
        windowWidth: 375,
        windowHeight: 667,
        pixelRatio: 1,
        safeArea: { top: 0, bottom: 667, left: 0, right: 375, width: 375, height: 667 },
        menuTop: menu.menuTop,
        menuBottom: menu.menuBottom
    };
}

function showToast(title) {
    if (hasTT() && typeof tt.showToast === 'function') {
        tt.showToast({ title: String(title || ''), icon: 'none', duration: 2000 });
    } else if (typeof console !== 'undefined') {
        console.log('[toast]', title);
    }
}

function shareGame() {
    const info = {
        title: GameConfig.share.title,
        query: GameConfig.share.query
    };
    if (GameConfig.share.imageUrl) info.imageUrl = GameConfig.share.imageUrl;

    if (hasTT() && typeof tt.shareAppMessage === 'function') {
        tt.shareAppMessage(Object.assign({}, info, {
            success() {
                showToast(GameConfig.dialog.shareToast);
            },
            fail() {
                showToast('分享未完成，可以点击右上角分享。');
            }
        }));
        return;
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
        navigator.share({ title: info.title, text: info.title }).catch(() => {});
        return;
    }
    showToast('请点击右上角分享。');
}

function setupShareMenu() {
    if (!hasTT()) return;
    if (typeof tt.onShareAppMessage === 'function') {
        tt.onShareAppMessage(() => ({
            title: GameConfig.share.title,
            imageUrl: GameConfig.share.imageUrl || undefined,
            query: GameConfig.share.query
        }));
    }
    if (typeof tt.showShareMenu === 'function') {
        try {
            tt.showShareMenu({ withShareTicket: false });
        } catch (error) {
            // 某些基础库不支持该参数，忽略即可。
        }
    }
}

function vibrate() {
    if (hasTT() && typeof tt.vibrateShort === 'function') {
        tt.vibrateShort({ type: 'light' });
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
    }
}

function onResize(callback) {
    if (hasTT() && typeof tt.onWindowResize === 'function') {
        tt.onWindowResize(callback);
    } else if (typeof window !== 'undefined') {
        window.addEventListener('resize', callback);
    }
}

function onShow(callback) {
    if (hasTT() && typeof tt.onShow === 'function') {
        tt.onShow(callback);
    } else if (typeof window !== 'undefined') {
        window.addEventListener('focus', callback);
    }
}

function onHide(callback) {
    if (hasTT() && typeof tt.onHide === 'function') {
        tt.onHide(callback);
    } else if (typeof window !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) callback();
        });
    }
}

let rewardedAd = null;
let rewardedUnit = '';

function getRewardedAd(adUnitId) {
    const unit = adUnitId || 'mock-ad-unit';
    if (rewardedAd && rewardedUnit === unit) return rewardedAd;
    rewardedAd = tt.createRewardedVideoAd({ adUnitId: unit });
    rewardedUnit = unit;
    return rewardedAd;
}

/**
 * 展示激励视频。
 * 返回 Promise<{ ok: boolean, reason: string }>。
 * 未配置广告位时不会伪造奖励。
 */
function showRewardedAd(adUnitId) {
    return new Promise((resolve) => {
        if (!hasTT() || typeof tt.createRewardedVideoAd !== 'function') {
            resolve({ ok: false, reason: 'unsupported' });
            return;
        }
        if (!adUnitId && !isMock()) {
            resolve({ ok: false, reason: 'unconfigured' });
            return;
        }

        let ad;
        try {
            ad = getRewardedAd(adUnitId);
        } catch (error) {
            resolve({ ok: false, reason: 'create_failed' });
            return;
        }

        let settled = false;
        let retried = false;

        const finish = (ok, reason) => {
            if (settled) return;
            settled = true;
            try {
                if (ad.offClose) ad.offClose(onClose);
            } catch (error) {}
            try {
                if (ad.offError) ad.offError(onError);
            } catch (error) {}
            resolve({ ok, reason: reason || '' });
        };

        const onClose = (result) => {
            const completed = !!(result && result.isEnded === true);
            finish(completed, completed ? '' : 'not_finished');
        };

        const onError = () => {
            finish(false, 'error');
        };

        const show = () => {
            try {
                const promise = ad.show();
                if (promise && typeof promise.catch === 'function') {
                    promise.catch(() => {
                        if (retried) {
                            finish(false, 'show_failed');
                            return;
                        }
                        retried = true;
                        try {
                            const loadPromise = ad.load();
                            if (loadPromise && typeof loadPromise.then === 'function') {
                                loadPromise.then(show).catch(() => finish(false, 'load_failed'));
                            } else {
                                show();
                            }
                        } catch (error) {
                            finish(false, 'load_failed');
                        }
                    });
                }
            } catch (error) {
                finish(false, 'show_failed');
            }
        };

        try {
            ad.onClose(onClose);
        } catch (error) {
            finish(false, 'listener_failed');
            return;
        }
        try {
            if (ad.onError) ad.onError(onError);
        } catch (error) {}

        show();
    });
}

function logError(error) {
    if (typeof console !== 'undefined' && console.error) {
        console.error('[deal-or-no-deal]', error);
    }
}

module.exports = {
    hasTT,
    isMock,
    getSystemInfo,
    showToast,
    shareGame,
    setupShareMenu,
    vibrate,
    onResize,
    onShow,
    onHide,
    showRewardedAd,
    logError
};
