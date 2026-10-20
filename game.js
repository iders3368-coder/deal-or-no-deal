/**
 * 抖音小游戏入口
 * 工程根目录必须包含 game.js / game.json / project.config.json。
 */

const GameApp = require('./src/app');
const platform = require('./src/platform');

function boot() {
    if (typeof tt === 'undefined' || !tt || typeof tt.createCanvas !== 'function') {
        throw new Error('当前环境不是抖音小游戏运行时：缺少 tt.createCanvas。');
    }

    const canvas = tt.createCanvas();
    const app = new GameApp(canvas);
    app.start();

    if (typeof tt.setPreferredFramesPerSecond === 'function') {
        tt.setPreferredFramesPerSecond(60);
    }
    if (typeof tt.onError === 'function') {
        tt.onError((error) => platform.logError(error));
    }
    if (typeof globalThis !== 'undefined' && typeof tt !== 'undefined' && tt.__isMock) {
        globalThis.__gameApp = app;
    }
}

try {
    boot();
} catch (error) {
    if (typeof console !== 'undefined' && console.error) {
        console.error('[deal-or-no-deal] 启动失败', error);
    }
}
