/**
 * 游戏UI管理器
 * 主持人小博对话驱动 + 讨价还价 + 3D箱子
 */

class GameUI {
    constructor(gameManager) {
        this.gm = gameManager;
        this.speechTimer = null;
        SoundFX.init();
        this.init();
        this.bind();
        this.render();
    }

    init() {
        this.el = {
            ticketCount: document.getElementById('ticket-count'),
            roundInfo: document.getElementById('round-info'),
            remainingInfo: document.getElementById('remaining-info'),
            speechText: document.getElementById('speech-text'),
            hostMouth: document.getElementById('host-mouth'),
            ticketPanel: document.getElementById('ticket-panel'),
            ticketRemain: document.getElementById('ticket-remain'),
            btnPlay: document.getElementById('btn-play'),
            btnShare: document.getElementById('btn-share'),
            btnAd: document.getElementById('btn-ad'),
            chooseHint: document.getElementById('choose-hint'),
            boxesContainer: document.getElementById('boxes-container'),
            myBoxBar: document.getElementById('my-box-bar'),
            myBoxNum: document.getElementById('my-box-num'),
            amountsPanel: document.getElementById('amounts-panel'),
            amountsGrid: document.getElementById('amounts-grid'),
            bankerOverlay: document.getElementById('banker-overlay'),
            bankerOfferAmount: document.getElementById('banker-offer-amount'),
            btnDeal: document.getElementById('btn-deal'),
            btnNoDeal: document.getElementById('btn-no-deal'),
            btnBargain: document.getElementById('btn-bargain'),
            bargainOverlay: document.getElementById('bargain-overlay'),
            bargainInput: document.getElementById('bargain-input'),
            btnBargainSubmit: document.getElementById('btn-bargain-submit'),
            bargainStatus: document.getElementById('bargain-status'),
            resultOverlay: document.getElementById('result-overlay'),
            resultTitle: document.getElementById('result-title'),
            resultBox: document.getElementById('result-box'),
            resultBoxVal: document.getElementById('result-box-val'),
            resultMsg: document.getElementById('result-msg'),
            resultPrize: document.getElementById('result-prize'),
            btnRestart: document.getElementById('btn-restart')
        };
    }

    bind() {
        this.el.btnPlay.addEventListener('click', this.onPlay.bind(this));
        this.el.btnShare.addEventListener('click', this.onShare.bind(this));
        this.el.btnAd.addEventListener('click', this.onAd.bind(this));
        this.el.btnDeal.addEventListener('click', this.onDeal.bind(this));
        this.el.btnNoDeal.addEventListener('click', this.onNoDeal.bind(this));
        this.el.btnBargain.addEventListener('click', this.onBargain.bind(this));
        this.el.btnBargainSubmit.addEventListener('click', this.onBargainSubmit.bind(this));
        this.el.btnRestart.addEventListener('click', this.onRestart.bind(this));
    }

    // ====== 对话 ======
    say(text, callback) {
        var self = this;
        this.el.speechText.textContent = '';
        this.el.hostMouth.classList.add('talking');
        var i = 0;
        clearInterval(this.speechTimer);
        this.speechTimer = setInterval(function() {
            if (i < text.length) {
                self.el.speechText.textContent += text[i];
                i++;
            } else {
                clearInterval(self.speechTimer);
                self.el.hostMouth.classList.remove('talking');
                if (callback) setTimeout(callback, 350);
            }
        }, 30);
    }

    // ====== 渲染 ======
    render() {
        var s = this.gm.getState();
        this.el.ticketCount.textContent = s.tickets;
        this.el.roundInfo.textContent = s.roundDesc || '等待开始';
        this.el.remainingInfo.textContent = '剩余: ' + s.remainingCount;

        if (s.state === GameConfig.states.WAITING_PAYMENT) {
            this.show('ticketPanel');
            this.hide('chooseHint', 'boxesContainer', 'myBoxBar', 'amountsPanel');
            this.el.ticketRemain.textContent = s.tickets;
            // 分享按钮
            this.el.btnShare.disabled = s.shareUsed;
            this.el.btnShare.textContent = s.shareUsed ? '已分享（今日上限）' : '分享好友 (+1)';
            // 开始按钮
            this.el.btnPlay.disabled = s.tickets <= 0;
        } else {
            this.hide('ticketPanel');
            this.show('chooseHint', 'boxesContainer', 'amountsPanel');
            if (s.playerBox >= 0) {
                this.show('myBoxBar');
                this.el.myBoxNum.textContent = '#' + (s.playerBox + 1);
                this.el.chooseHint.classList.add('hidden');
            } else {
                this.hide('myBoxBar');
                this.el.chooseHint.classList.remove('hidden');
            }
            this.renderBoxes(s);
            this.renderAmounts(s);
        }
    }

    renderBoxes(s) {
        var self = this;
        this.el.boxesContainer.innerHTML = '';
        for (var i = 0; i < 26; i++) {
            var cell = document.createElement('div');
            cell.className = 'box-cell';
            cell.dataset.index = i;

            var isMine = s.playerBox === i;
            var isOpened = !s.boxes[i];

            if (isMine) cell.classList.add('is-mine');

            if (isOpened) {
                // 已打开：直接显示金额，不使用3D翻转
                cell.classList.add('opened-cell');
                cell.innerHTML = '<div class="opened-box"><div class="opened-amount">' + self.gm.fmt(s.amounts[i]) + '</div><div class="opened-x">✕</div></div>';
            } else {
                // 未打开：显示箱子
                var box = document.createElement('div');
                box.className = 'box-3d';

                var front = document.createElement('div');
                front.className = 'box-face box-front';
                front.innerHTML = '<div class="box-num">' + (i + 1) + '</div><div class="box-lbl">briefcase</div>';

                var back = document.createElement('div');
                back.className = 'box-face box-back';
                back.innerHTML = '<div class="box-amount">' + self.gm.fmt(s.amounts[i]) + '</div><div class="box-lbl">美元</div>';

                box.appendChild(front);
                box.appendChild(back);

                var tag = document.createElement('div');
                tag.className = 'mine-tag';
                tag.textContent = '我的';

                cell.appendChild(box);
                cell.appendChild(tag);
            }

            if (!isMine && !isOpened) {
                (function(idx) {
                    cell.addEventListener('click', function() { self.onBoxClick(idx); });
                })(i);
            }

            this.el.boxesContainer.appendChild(cell);
        }
    }

    renderAmounts(s) {
        this.el.amountsGrid.innerHTML = '';
        var sorted = GameConfig.amounts.slice().sort(function(a, b) { return a - b; });
        for (var i = 0; i < sorted.length; i++) {
            var item = document.createElement('div');
            item.className = 'amt';
            if (s.remainingAmounts.indexOf(sorted[i]) === -1) item.classList.add('out');
            item.innerHTML = '<span class="amt-val">' + this.gm.fmt(sorted[i]) + '</span>';
            this.el.amountsGrid.appendChild(item);
        }
    }

    show() {
        for (var i = 0; i < arguments.length; i++) {
            var el = this.el[arguments[i]];
            if (el) el.classList.remove('hidden');
        }
    }
    hide() {
        for (var i = 0; i < arguments.length; i++) {
            var el = this.el[arguments[i]];
            if (el) el.classList.add('hidden');
        }
    }

    // ====== 事件 ======
    onPlay() {
        var self = this;
        SoundFX.click();
        var r = this.gm.useTicket();
        if (!r.success) { this.say(r.message); return; }
        this.render();
        this.say(this.gm.getDialog('welcome'), function() {
            self.say(self.gm.getDialog('chooseBox'));
        });
    }

    onShare() {
        SoundFX.click();
        var r = this.gm.shareTicket();
        this.say(r.message);
        if (r.success) this.render();
    }

    onAd() {
        SoundFX.click();
        var r = this.gm.watchAdTicket();
        this.say(r.message);
        if (r.success) this.render();
    }

    onBoxClick(index) {
        var self = this;
        var s = this.gm.getState();
        if (s.state === GameConfig.states.READY) {
            if (this.gm.selectPlayerBox(index)) {
                this.render();
                this.say(this.gm.getDialog('boxSelected', { n: index + 1 }), function() {
                    self.say(self.gm.getDialog('roundStart', { count: GameConfig.rounds[0].openCount }));
                });
            }
            return;
        }
        if (s.state !== GameConfig.states.PLAYING) return;

        var r = this.gm.openBox(index);
        if (!r.success) return;

        SoundFX.boxOpen();

        // 箱子翻转动画
        var cells = this.el.boxesContainer.querySelectorAll('.box-cell');
        var cell = cells[index];
        var box3d = cell.querySelector('.box-3d');
        if (box3d) {
            box3d.classList.add('opening');
        }

        setTimeout(function() {
            self.render();
            // 根据金额大小选择不同台词和音效
            var amt = r.amount;
            var dlg;
            if (amt >= 100000) { dlg = 'openedBig'; SoundFX.revealBig(); }
            else if (amt >= 1000) { dlg = 'openedMid'; SoundFX.revealMid(); }
            else if (amt >= 10) { dlg = 'openedSmall'; SoundFX.revealSmall(); }
            else { dlg = 'openedTiny'; SoundFX.revealSmall(); }
            self.say(self.gm.getDialog(dlg, { n: index + 1, amount: self.gm.fmt(r.amount) }));
        }, 600);

        if (r.roundComplete) {
            setTimeout(function() {
                self.showBankerFlow(r.bankerOffer);
            }, 1500);
        }
    }

    // ====== 银行家出价流程 ======
    showBankerFlow(offer) {
        var self = this;
        SoundFX.phoneRing();
        // 第一步：主持人说电话响了
        this.say(this.gm.getDialog('bankerCalling'), function() {
            // 第二步：主持人假装打电话
            self.say(self.gm.getDialog('hostCall'), function() {
                // 第三步：显示银行家面板
                self.el.bankerOfferAmount.textContent = self.gm.fmt(offer);
                self.el.bankerOverlay.classList.remove('hidden');
                SoundFX.bankerOffer();
                // 讨价还价按钮：如果还没用过就显示
                self.el.btnBargain.style.display = self.gm.getState().bargainUsed ? 'none' : '';
                // 第四步：主持人宣布出价
                self.say(self.gm.getDialog('offer', { amount: self.gm.fmt(offer), n: self.gm.getState().playerBox + 1 }), function() {
                    self.say(self.gm.getDialog('dealOrNoDeal', { amount: self.gm.fmt(offer) }));
                });
            });
        });
    }

    onDeal() {
        var self = this;
        this.el.bankerOverlay.classList.add('hidden');
        SoundFX.deal();
        var r = this.gm.deal();
        if (!r.success) return;

        // 主持人先说成交，然后揭示箱子
        this.say(this.gm.getDialog('dealResult', { prize: this.gm.fmt(r.prize), n: r.playerBox + 1 }), function() {
            var diff = r.playerBoxAmount - r.prize;
            var title, msg;
            if (diff > 0) {
                title = '银行家赢了！';
                msg = self.gm.getDialog('gameLose', { n: r.playerBox+1, amount: self.gm.fmt(r.playerBoxAmount), diff: self.gm.fmt(diff) });
            } else if (diff < 0) {
                title = '漂亮的决策！';
                msg = self.gm.getDialog('gameWin', { n: r.playerBox+1, amount: self.gm.fmt(r.playerBoxAmount), prize: self.gm.fmt(r.prize) });
            } else {
                title = '平局！';
                msg = self.gm.getDialog('gameEven', { n: r.playerBox+1, amount: self.gm.fmt(r.playerBoxAmount) });
            }

            self.el.resultTitle.textContent = title;
            self.el.resultBoxVal.textContent = self.gm.fmt(r.playerBoxAmount);
            self.el.resultMsg.textContent = msg;
            self.el.resultPrize.textContent = '+' + self.gm.fmt(r.prize);
            self.el.resultBox.classList.remove('reveal');
            self.el.resultOverlay.classList.remove('hidden');
            setTimeout(function() { self.el.resultBox.classList.add('reveal'); }, 600);
        });
    }

    onNoDeal() {
        var self = this;
        this.el.bankerOverlay.classList.add('hidden');
        SoundFX.noDeal();
        var r = this.gm.noDeal();
        if (!r.success) return;

        if (r.gameOver) {
            this.say(this.gm.getDialog('gameOver', { n: r.playerBox + 1 }), function() {
                self.showResult(r);
            });
        } else {
            this.say(this.gm.getDialog('noDealResult'), function() {
                self.say(self.gm.getDialog('roundStart', { count: GameConfig.rounds[self.gm.getState().currentRound].openCount }));
            });
            this.render();
        }
    }

    // ====== 讨价还价 ======
    onBargain() {
        var self = this;
        this.el.bankerOverlay.classList.add('hidden');
        var r = this.gm.bargainStart();
        if (!r.success) return;

        // 显示讨价还价面板
        this.el.bargainOverlay.classList.remove('hidden');
        this.el.bargainInput.value = '';
        this.el.bargainStatus.classList.add('hidden');
        this.el.bargainStatus.className = 'hidden';
        this.el.btnBargainSubmit.style.display = '';

        this.say(this.gm.getDialog('bargainHint'), function() {
            self.say(self.gm.getDialog('bargainInput'));
        });
    }

    onBargainSubmit() {
        var self = this;
        var val = parseInt(this.el.bargainInput.value);
        if (!val || val <= 0) {
            this.el.bargainInput.style.borderColor = '#ef4444';
            setTimeout(function() { self.el.bargainInput.style.borderColor = ''; }, 1000);
            return;
        }

        // 提交玩家出价
        this.gm.bargainSubmit(val);
        this.el.btnBargainSubmit.style.display = 'none';
        this.el.bargainInput.disabled = true;

        // 显示等待状态
        this.el.bargainStatus.textContent = '你出价 ' + this.gm.fmt(val) + '，银行家正在考虑...';
        this.el.bargainStatus.classList.remove('hidden');
        this.el.bargainStatus.style.color = '#f59e0b';

        this.say(this.gm.getDialog('bargainWait'), function() {
            // 2秒后银行家拒绝
            setTimeout(function() {
                self.el.bargainStatus.textContent = '银行家拒绝了！';
                self.el.bargainStatus.style.color = '#ef4444';
                SoundFX.reject();

                self.say(self.gm.getDialog('bargainReject'), function() {
                    // 点击继续
                    self.el.bargainStatus.textContent = '银行家拒绝了！只能继续游戏';
                    self.el.btnBargainSubmit.textContent = '继续游戏';
                    self.el.btnBargainSubmit.style.display = '';
                    self.el.btnBargainSubmit.className = 'btn btn-red';
                    self.el.btnBargainSubmit.onclick = function() {
                        self.el.bargainOverlay.classList.add('hidden');
                        self.el.bargainInput.disabled = false;
                        self.el.btnBargainSubmit.className = 'btn btn-yellow';
                        self.el.btnBargainSubmit.textContent = '出价！';
                        self.el.btnBargainSubmit.onclick = function() { self.onBargainSubmit(); };

                        var r2 = self.gm.bargainContinue();
                        if (r2.gameOver) {
                            self.say(self.gm.getDialog('gameOver', { n: r2.playerBox + 1 }), function() {
                                self.showResult(r2);
                            });
                        } else {
                            self.say(self.gm.getDialog('roundStart', { count: GameConfig.rounds[r2.nextRound].openCount }));
                            self.render();
                        }
                    };
                });
            }, 2500);
        });
    }

    showResult(r) {
        var self = this;
        var diff = r.playerBoxAmount - r.finalPrize;
        var title, msg;
        if (r.finalPrize > r.playerBoxAmount) {
            title = '恭喜！你赢了！';
            SoundFX.win();
            msg = self.gm.getDialog('gameWin', { n: r.playerBox+1, amount: self.gm.fmt(r.playerBoxAmount), prize: self.gm.fmt(r.finalPrize) });
        } else if (r.finalPrize < r.playerBoxAmount) {
            title = '银行家是对的';
            SoundFX.lose();
            msg = self.gm.getDialog('gameLose', { n: r.playerBox+1, amount: self.gm.fmt(r.playerBoxAmount), diff: self.gm.fmt(r.playerBoxAmount - r.finalPrize) });
        } else {
            title = '平局！';
            msg = self.gm.getDialog('gameEven', { n: r.playerBox+1, amount: self.gm.fmt(r.playerBoxAmount) });
        }

        self.el.resultTitle.textContent = title;
        self.el.resultBoxVal.textContent = self.gm.fmt(r.playerBoxAmount);
        self.el.resultMsg.textContent = msg;
        self.el.resultPrize.textContent = '+' + self.gm.fmt(r.finalPrize);
        self.el.resultBox.classList.remove('reveal');
        self.el.resultOverlay.classList.remove('hidden');
        setTimeout(function() { self.el.resultBox.classList.add('reveal'); }, 600);
    }

    onRestart() {
        this.el.resultOverlay.classList.add('hidden');
        this.el.resultBox.classList.remove('reveal');
        this.gm.reset();
        this.render();
        this.say('再来一局吧！');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameUI;
}
