/**
 * 预览演示脚本：仅用于本地截图和视觉检查，不参与抖音小游戏打包。
 * 用法：/preview/?w=390&h=844&demo=board
 */

(function () {
    const params = new URLSearchParams(window.location.search);
    const demo = params.get('demo');
    if (!demo) return;

    window.addEventListener('load', () => {
        const app = window.__gameApp;
        if (!app) return;

        const manager = app.manager;
        manager.tickets = 5;
        manager.saveSession();
        manager.resetGame();

        function openFirstRound() {
            for (let i = 1; i <= 6; i += 1) {
                if (manager.boxes[i]) manager.openBox(i);
            }
        }

        app.ui.overlay = null;
        app.ui.inputLocked = false;
        app.renderer.clearSpeech();

        if (demo === 'board') {
            manager.useTicket();
            app.ui.overlay = null;
            app.ui.inputLocked = false;
        } else if (demo === 'playing') {
            manager.useTicket();
            manager.selectPlayerBox(0);
            manager.openBox(1);
            manager.openBox(2);
            manager.openBox(3);
            app.ui.overlay = null;
            app.ui.inputLocked = false;
        } else if (demo === 'banker') {
            manager.useTicket();
            manager.selectPlayerBox(0);
            openFirstRound();
            app.ui.overlay = 'banker';
            app.ui.inputLocked = true;
        } else if (demo === 'bargain') {
            manager.useTicket();
            manager.selectPlayerBox(0);
            openFirstRound();
            manager.bargainStart();
            app.ui.overlay = 'bargain';
            app.ui.inputLocked = true;
            app.ui.bargainText = '650000';
        } else if (demo === 'result-deal') {
            manager.useTicket();
            manager.selectPlayerBox(0);
            openFirstRound();
            const result = manager.deal();
            app.showResult(result);
        } else if (demo === 'result-bargain') {
            manager.useTicket();
            manager.selectPlayerBox(0);
            openFirstRound();
            manager.bargainStart();
            const result = manager.bargainSubmit(manager.bankerOffer + 1);
            app.showResult(result);
        } else if (demo === 'result-nodeal') {
            manager.useTicket();
            manager.selectPlayerBox(0);
            let result = null;
            let guard = 0;
            while (manager.state !== 'game_over' && guard < 60) {
                guard += 1;
                if (manager.state === 'playing') {
                    let opened = false;
                    for (let i = 0; i < manager.boxes.length; i += 1) {
                        if (manager.boxes[i] && i !== manager.playerBox) {
                            manager.openBox(i);
                            opened = true;
                            break;
                        }
                    }
                    if (!opened) break;
                } else if (manager.state === 'banker_offer') {
                    result = manager.noDeal();
                } else {
                    break;
                }
            }
            if (result) app.showResult(result);
        }

        app.ui.allowBoxTap = false;
        app.renderer.clearSpeech();
    });
})();
