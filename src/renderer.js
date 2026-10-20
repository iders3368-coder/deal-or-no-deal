/**
 * Canvas 渲染器
 * 负责绘制全部界面、维护触摸热区，不直接修改游戏状态。
 */

const GameConfig = require('./config');
const { fmt, fmtShort, clamp } = require('./utils');
const platform = require('./platform');

const COLORS = {
    bg: '#07070f',
    bgTop: '#171735',
    panel: '#151529',
    panel2: '#20203a',
    panel3: '#2a2a48',
    gold: '#ffd45e',
    goldDark: '#e0a92f',
    text: '#f6f6ff',
    sub: '#9c9cb8',
    red: '#ff5c6c',
    redDark: '#4a1722',
    green: '#39d99a',
    blue: '#4fa8ff',
    brown: '#5c3618',
    brownDark: '#321c0b',
    cream: '#fff7e6',
    ink: '#241a30'
};

const FONT_FAMILY = '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif';

function rr(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

function formatDigits(text) {
    const digits = String(text || '').replace(/[^\d]/g, '');
    if (!digits) return '';
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.width = 375;
        this.height = 667;
        this.safeTop = 0;
        this.contentX = 8;
        this.contentW = 359;
        this.layout = {};
        this.hits = [];
        this.pressed = null;
        this.speech = null;
        this.flip = null;
        this.toastData = null;
        this.lastNow = Date.now();
        this.resize();
    }

    resize() {
        const info = platform.getSystemInfo();
        const width = Math.max(280, Math.floor(info.windowWidth || 375));
        const height = Math.max(420, Math.floor(info.windowHeight || 667));
        const dpr = info.pixelRatio || 1;

        this.canvas.width = Math.floor(width * dpr);
        this.canvas.height = Math.floor(height * dpr);
        if (this.ctx.setTransform) {
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        } else {
            this.ctx.scale(dpr, dpr);
        }

        this.width = width;
        this.height = height;
        this.safeTop = info.safeArea ? Math.max(0, info.safeArea.top || 0) : 0;
        this.menuBottom = Math.max(0, info.menuBottom || 0);
        this.computeLayout();
    }

    computeLayout() {
        const margin = 8;
        const contentW = Math.min(this.width - margin * 2, 430);
        const contentX = (this.width - contentW) / 2;

        // 给抖音右上角胶囊按钮留出空间：安全区通常已包含胶囊高度，
        // 这里额外用胶囊底部做一次兜底，避免状态栏隐藏时顶栏被遮挡。
        const menuBottom = Math.max(0, this.menuBottom || 0);
        const top = Math.max(this.safeTop + 36, menuBottom + 2);
        const topBar = { x: contentX, y: top, w: contentW, h: 26 };
        const host = { x: contentX, y: topBar.y + topBar.h + 4, w: contentW, h: 68 };
        const boxesY = host.y + host.h + 6;

        const cols = 6;
        const rows = 5;
        const gap = 5;
        const widthCell = (contentW - gap * (cols - 1)) / cols;
        const myBoxH = 26;
        const amountsMinH = 110;
        const bottomMargin = 8;
        const availableForBoxes = this.height - boxesY - bottomMargin - myBoxH - 6 - amountsMinH - 6;
        const heightCell = (availableForBoxes - gap * (rows - 1)) / rows;
        const cell = Math.max(28, Math.min(widthCell, heightCell));

        const boxesW = cols * cell + gap * (cols - 1);
        const boxesX = contentX + (contentW - boxesW) / 2;
        const boxesH = rows * cell + gap * (rows - 1);
        const myBoxY = boxesY + boxesH + 6;
        const amountsY = myBoxY + myBoxH + 6;
        const amountsMaxH = Math.min(200, this.height - amountsY - bottomMargin);
        const amountsH = Math.max(94, amountsMaxH);

        this.contentX = contentX;
        this.contentW = contentW;
        this.layout = {
            topBar,
            host,
            boxes: { x: boxesX, y: boxesY, w: boxesW, h: boxesH, cols, rows, gap, cell },
            myBox: { x: contentX, y: myBoxY, w: contentW, h: myBoxH },
            amounts: { x: contentX, y: amountsY, w: contentW, h: amountsH }
        };
    }

    // ---------- 触摸热区 ----------

    addHit(x, y, w, h, id) {
        this.hits.push({ x, y, w, h, id });
    }

    hitTest(x, y) {
        for (let i = this.hits.length - 1; i >= 0; i -= 1) {
            const hit = this.hits[i];
            if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) {
                return hit.id;
            }
        }
        return null;
    }

    setPressed(id) {
        this.pressed = id || null;
    }

    // ---------- 说话与动画 ----------

    setSpeech(text, callback) {
        this.speech = {
            text: String(text || ''),
            start: Date.now(),
            visible: '',
            typedAllAt: null,
            skip: false,
            done: false,
            callback: typeof callback === 'function' ? callback : null
        };
    }

    finishSpeech() {
        if (!this.speech || this.speech.done) return;
        this.speech.visible = this.speech.text;
        this.speech.done = true;
        const callback = this.speech.callback;
        this.speech.callback = null;
        if (callback) callback();
    }

    updateSpeech(now) {
        if (!this.speech) return;

        // 点击跳过时立即结束当前句，不再等待句末停顿。
        if (this.speech.skip) {
            this.finishSpeech();
            return;
        }

        const chars = Array.from(this.speech.text);
        const elapsed = Math.max(0, now - this.speech.start);
        const charDelay = Math.max(10, Number(GameConfig.speech && GameConfig.speech.charDelay) || 55);
        const hold = Math.max(0, Number(GameConfig.speech && GameConfig.speech.hold) || 0);
        const count = Math.min(chars.length, Math.floor(elapsed / charDelay));
        this.speech.visible = chars.slice(0, count).join('');

        if (count >= chars.length) {
            // 整句出现后先停留一段时间，让玩家看完再触发下一句。
            if (this.speech.typedAllAt === null) this.speech.typedAllAt = now;
            if (now - this.speech.typedAllAt >= hold) this.finishSpeech();
        }
    }

    skipSpeech() {
        if (this.speech && !this.speech.done) this.speech.skip = true;
    }

    isSpeechTyping() {
        return !!(this.speech && !this.speech.done);
    }

    clearSpeech() {
        this.speech = null;
    }

    getSpeechText() {
        if (!this.speech) return '';
        return this.speech.done ? this.speech.text : this.speech.visible;
    }

    startFlip(index, amount) {
        this.flip = { index, amount, start: Date.now() };
    }

    showToast(text, duration) {
        this.toastData = {
            text: String(text || ''),
            until: Date.now() + (duration || 2200)
        };
    }

    // ---------- 文本工具 ----------

    font(size, weight) {
        return (weight || 'normal') + ' ' + size + 'px ' + FONT_FAMILY;
    }

    text(value, x, y, size, color, align, weight) {
        const ctx = this.ctx;
        ctx.font = this.font(size, weight);
        ctx.fillStyle = color || COLORS.text;
        ctx.textAlign = align || 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(value), x, y);
    }

    wrap(text, maxWidth, maxLines, size, weight) {
        const ctx = this.ctx;
        ctx.font = this.font(size || 11, weight || 'normal');
        const chars = Array.from(String(text || ''));
        const lines = [];
        let line = '';
        for (let i = 0; i < chars.length; i += 1) {
            const ch = chars[i];
            if (ch === '\n') {
                if (line) lines.push(line);
                line = '';
                continue;
            }
            const test = line + ch;
            if (line && ctx.measureText(test).width > maxWidth) {
                lines.push(line);
                line = ch;
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);
        if (maxLines && lines.length > maxLines) {
            const cut = lines.slice(0, maxLines);
            cut[maxLines - 1] = cut[maxLines - 1] + '…';
            return cut;
        }
        return lines;
    }

    // ---------- 基础绘制 ----------

    dim() {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.76)';
        ctx.fillRect(0, 0, this.width, this.height);
    }

    drawBackground() {
        const ctx = this.ctx;
        const grad = ctx.createLinearGradient(0, 0, 0, this.height);
        grad.addColorStop(0, COLORS.bgTop);
        grad.addColorStop(0.55, '#0d0d20');
        grad.addColorStop(1, COLORS.bg);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.fillStyle = 'rgba(255, 212, 94, 0.05)';
        for (let i = 0; i < 18; i += 1) {
            const x = ((i * 73) % this.width);
            const y = ((i * 131) % Math.max(1, this.height));
            const r = i % 3 === 0 ? 1.6 : 1;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        const glow = ctx.createRadialGradient(this.width / 2, 0, 10, this.width / 2, 0, this.height * 0.75);
        glow.addColorStop(0, 'rgba(78, 70, 180, 0.22)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, this.width, this.height);
    }

    panel(x, y, w, h, fill, border, radius) {
        const ctx = this.ctx;
        rr(ctx, x, y, w, h, radius === undefined ? 12 : radius);
        ctx.fillStyle = fill || COLORS.panel;
        ctx.fill();
        if (border) {
            ctx.strokeStyle = border;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    button(x, y, w, h, label, options) {
        const opts = options || {};
        const disabled = !!opts.disabled;
        const pressed = !disabled && this.pressed === opts.id;
        const ctx = this.ctx;
        const fill = disabled ? '#2a2a3a' : pressed ? (opts.pressedFill || opts.fill || COLORS.goldDark) : (opts.fill || COLORS.gold);
        const color = disabled ? '#6d6d82' : (opts.color || COLORS.ink);

        rr(ctx, x, y, w, h, opts.radius === undefined ? 10 : opts.radius);
        ctx.fillStyle = fill;
        ctx.fill();
        if (opts.border && !disabled) {
            ctx.strokeStyle = opts.border;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        this.text(label, x + w / 2, y + h / 2, opts.fontSize || 14, color, 'center', opts.weight || 'bold');
        if (opts.id && !disabled) this.addHit(x, y, w, h, opts.id);
    }

    // ---------- 主渲染 ----------

    render(view, ui) {
        // 所有动画/Toast 统一以 Date.now() 为基准，避免与 requestAnimationFrame 时间戳混用。
        this.lastNow = Date.now();
        this.hits = [];
        this.drawBackground();
        this.drawTopBar(view);

        if (view.state !== GameConfig.states.WAITING_PAYMENT) {
            this.drawBoxes(view, ui);
            this.drawMyBox(view);
            this.drawAmounts(view);
            this.drawFooter();
        }

        this.drawHost(view);

        if (!ui.overlay) {
            this.drawSpeech(view);
        }

        if (ui.overlay === 'ticket') this.drawTicket(view, ui);
        if (ui.overlay === 'banker') this.drawBanker(view, ui);
        if (ui.overlay === 'bargain') this.drawBargain(view, ui);
        if (ui.overlay === 'result') this.drawResult(view, ui);

        this.drawToast();
    }

    drawTopBar(view) {
        const bar = this.layout.topBar;
        this.panel(bar.x, bar.y, bar.w, bar.h, 'rgba(20, 20, 42, 0.88)', 'rgba(255, 212, 94, 0.2)', 13);

        this.text('🎫 ' + view.tickets, bar.x + 10, bar.y + bar.h / 2, 11.5, COLORS.gold, 'left', 'bold');

        const center = view.state === GameConfig.states.WAITING_PAYMENT
            ? '等待开始'
            : (view.roundDesc || '').replace('：打开', ' · ');
        this.text(center, bar.x + bar.w / 2, bar.y + bar.h / 2, 10.5, 'rgba(232, 232, 246, 0.82)', 'center', 'normal');

        this.text('剩余 ' + view.remainingCount, bar.x + bar.w - 10, bar.y + bar.h / 2, 10.5, 'rgba(210, 210, 230, 0.72)', 'right', 'normal');
    }

    drawHost(view) {
        const host = this.layout.host;
        const ctx = this.ctx;
        const avatarX = host.x;
        const avatarY = host.y + 3;
        const cx = avatarX + 25;
        const cy = avatarY + 25;

        // 身体
        rr(ctx, avatarX + 7, avatarY + 40, 36, 24, 10);
        ctx.fillStyle = '#1c2a55';
        ctx.fill();
        ctx.fillStyle = '#f4f4ff';
        ctx.beginPath();
        ctx.moveTo(cx - 7, avatarY + 40);
        ctx.lineTo(cx, avatarY + 50);
        ctx.lineTo(cx + 7, avatarY + 40);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = COLORS.red;
        ctx.beginPath();
        ctx.moveTo(cx - 6, avatarY + 40);
        ctx.lineTo(cx, avatarY + 45);
        ctx.lineTo(cx + 6, avatarY + 40);
        ctx.lineTo(cx, avatarY + 42);
        ctx.closePath();
        ctx.fill();

        // 头
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.fillStyle = '#f1c6a0';
        ctx.fill();

        // 头发
        ctx.beginPath();
        ctx.arc(cx, cy - 3, 18, Math.PI, Math.PI * 2);
        ctx.fillStyle = '#2b1a1a';
        ctx.fill();
        ctx.fillStyle = '#2b1a1a';
        ctx.beginPath();
        ctx.arc(cx - 13, cy - 7, 6, 0, Math.PI * 2);
        ctx.arc(cx + 13, cy - 7, 6, 0, Math.PI * 2);
        ctx.fill();

        // 眼睛
        ctx.fillStyle = '#241a30';
        ctx.beginPath();
        ctx.arc(cx - 6, cy + 1, 1.8, 0, Math.PI * 2);
        ctx.arc(cx + 6, cy + 1, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // 嘴巴：说话时开合
        const talking = this.isSpeechTyping();
        const mouth = talking ? 2 + Math.abs(Math.sin(this.lastNow / 90)) * 2 : 1.4;
        ctx.save();
        ctx.translate(cx, cy + 8);
        ctx.scale(1, mouth / 5);
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#8d3a42';
        ctx.fill();
        ctx.restore();

        // 领结
        ctx.fillStyle = COLORS.gold;
        ctx.beginPath();
        ctx.moveTo(cx - 5, avatarY + 44);
        ctx.lineTo(cx, avatarY + 47);
        ctx.lineTo(cx - 5, avatarY + 50);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + 5, avatarY + 44);
        ctx.lineTo(cx, avatarY + 47);
        ctx.lineTo(cx + 5, avatarY + 50);
        ctx.closePath();
        ctx.fill();
    }

    defaultSpeech(view) {
        if (view.state === GameConfig.states.READY) {
            return '请选择一个箱子，作为你的命运之箱。';
        }
        if (view.state === GameConfig.states.PLAYING) {
            const left = Math.max(0, view.openCount - view.openedInRound);
            return '本轮还要打开 ' + left + ' 个箱子。每一次开箱，都会淘汰一个金额。';
        }
        if (view.state === GameConfig.states.BANKER_OFFER) {
            return '银行家正在电话里报价……';
        }
        return '';
    }

    drawSpeech(view) {
        const host = this.layout.host;
        const bubbleX = host.x + 56;
        const bubbleW = host.w - 56;
        const bubbleH = 64;
        const bubbleY = host.y;
        const ctx = this.ctx;
        const text = this.getSpeechText() || this.defaultSpeech(view);
        const typing = this.isSpeechTyping();

        if (!text) return;

        rr(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 12);
        ctx.fillStyle = COLORS.cream;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 212, 94, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(bubbleX, bubbleY + 22);
        ctx.lineTo(bubbleX - 7, bubbleY + 29);
        ctx.lineTo(bubbleX, bubbleY + 36);
        ctx.closePath();
        ctx.fillStyle = COLORS.cream;
        ctx.fill();

        const lines = this.wrap(text, bubbleW - 16, 3, 11);
        ctx.font = this.font(11, 'normal');
        ctx.fillStyle = COLORS.ink;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const startY = bubbleY + 18;
        lines.forEach((line, index) => {
            ctx.fillText(line, bubbleX + 9, startY + index * 14);
        });

        if (typing) {
            this.text('▸', bubbleX + bubbleW - 12, bubbleY + bubbleH - 10, 11, COLORS.goldDark, 'center', 'bold');
            this.addHit(bubbleX, bubbleY, bubbleW, bubbleH, 'speech');
        }
    }

    drawBoxes(view, ui) {
        const boxes = this.layout.boxes;
        const ctx = this.ctx;
        const allowTap = !!ui.allowBoxTap &&
            (view.state === GameConfig.states.READY || view.state === GameConfig.states.PLAYING);

        for (let i = 0; i < 26; i += 1) {
            const col = i % boxes.cols;
            const row = Math.floor(i / boxes.cols);
            const x = boxes.x + col * (boxes.cell + boxes.gap);
            const y = boxes.y + row * (boxes.cell + boxes.gap);
            const isPlayer = i === view.playerBox;
            const revealed = view.revealed[i];

            if (this.flip && this.flip.index === i) {
                const elapsed = this.lastNow - this.flip.start;
                if (elapsed < 320) {
                    const phase = clamp(elapsed / 320, 0, 1);
                    const scaleX = phase < 0.5 ? 1 - phase * 2 : phase * 2 - 1;
                    ctx.save();
                    ctx.translate(x + boxes.cell / 2, y + boxes.cell / 2);
                    ctx.scale(Math.max(0.03, scaleX), 1);
                    ctx.translate(-(x + boxes.cell / 2), -(y + boxes.cell / 2));
                    if (phase < 0.5) {
                        this.drawBoxFront(x, y, boxes.cell, i, false);
                    } else {
                        this.drawBoxBack(x, y, boxes.cell, this.flip.amount);
                    }
                    ctx.restore();
                    continue;
                }
                this.flip = null;
            }

            if (revealed !== undefined) {
                this.drawBoxOpened(x, y, boxes.cell, i, revealed);
            } else {
                this.drawBoxFront(x, y, boxes.cell, i, isPlayer);
                if (allowTap && !isPlayer) {
                    this.addHit(x, y, boxes.cell, boxes.cell, 'box:' + i);
                }
            }
        }
    }

    drawBoxFront(x, y, size, index, isPlayer) {
        const ctx = this.ctx;
        const grad = ctx.createLinearGradient(x, y, x, y + size);
        grad.addColorStop(0, isPlayer ? '#7c4a1e' : COLORS.brown);
        grad.addColorStop(1, COLORS.brownDark);

        rr(ctx, x, y, size, size, Math.max(5, size * 0.12));
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = isPlayer ? COLORS.gold : 'rgba(255, 212, 94, 0.28)';
        ctx.lineWidth = isPlayer ? 2 : 1;
        ctx.stroke();

        // 提手
        ctx.strokeStyle = 'rgba(255, 228, 168, 0.5)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x + size * 0.32, y + size * 0.2);
        ctx.lineTo(x + size * 0.68, y + size * 0.2);
        ctx.stroke();

        // 锁扣
        rr(ctx, x + size * 0.42, y + size * 0.48, size * 0.16, size * 0.1, 2);
        ctx.fillStyle = 'rgba(255, 212, 94, 0.65)';
        ctx.fill();

        this.text(String(index + 1), x + size / 2, y + size * 0.42, Math.max(12, size * 0.34), COLORS.gold, 'center', 'bold');
        this.text('箱子', x + size / 2, y + size * 0.78, Math.max(7, size * 0.14), 'rgba(255, 240, 208, 0.62)', 'center', 'normal');

        if (isPlayer) {
            const tagW = Math.max(24, size * 0.42);
            const tagH = Math.max(12, size * 0.2);
            rr(ctx, x + size - tagW - 3, y + 3, tagW, tagH, tagH / 2);
            ctx.fillStyle = COLORS.gold;
            ctx.fill();
            this.text('我的', x + size - tagW / 2 - 3, y + 3 + tagH / 2, Math.max(7, tagH * 0.56), COLORS.ink, 'center', 'bold');
        }
    }

    drawBoxBack(x, y, size, amount) {
        const ctx = this.ctx;
        const grad = ctx.createLinearGradient(x, y, x, y + size);
        grad.addColorStop(0, '#27436f');
        grad.addColorStop(1, '#132038');
        rr(ctx, x, y, size, size, Math.max(5, size * 0.12));
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = COLORS.gold;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const text = fmtShort(amount);
        this.text(text, x + size / 2, y + size / 2, Math.max(10, size * 0.2), COLORS.gold, 'center', 'bold');
        this.text('筹码', x + size / 2, y + size * 0.78, Math.max(7, size * 0.13), COLORS.sub, 'center', 'normal');
    }

    drawBoxOpened(x, y, size, index, amount) {
        const ctx = this.ctx;
        rr(ctx, x, y, size, size, Math.max(5, size * 0.12));
        ctx.fillStyle = COLORS.redDark;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 92, 108, 0.65)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const big = amount >= 100000;
        const color = big ? COLORS.gold : amount >= 1000 ? '#ffb46b' : 'rgba(255, 190, 190, 0.8)';
        this.text(fmtShort(amount), x + size / 2, y + size * 0.46, Math.max(9, size * 0.2), color, 'center', 'bold');
        this.text('已开 ' + (index + 1), x + size / 2, y + size * 0.8, Math.max(6, size * 0.12), 'rgba(255, 180, 180, 0.55)', 'center', 'normal');
        this.text('✕', x + size - 8, y + 9, Math.max(8, size * 0.16), 'rgba(255, 120, 130, 0.75)', 'center', 'bold');
    }

    drawMyBox(view) {
        const box = this.layout.myBox;
        this.panel(box.x, box.y, box.w, box.h, 'rgba(255, 212, 94, 0.08)', 'rgba(255, 212, 94, 0.28)', 9);
        if (view.playerBox >= 0) {
            this.text('我的箱子  #' + (view.playerBox + 1) + ' 号', box.x + 10, box.y + box.h / 2, 11, COLORS.gold, 'left', 'bold');
            this.text('最后揭晓', box.x + box.w - 10, box.y + box.h / 2, 9, COLORS.sub, 'right', 'normal');
        } else {
            this.text('还没有选择箱子', box.x + 10, box.y + box.h / 2, 10, COLORS.sub, 'left', 'normal');
        }
    }

    drawAmounts(view) {
        const area = this.layout.amounts;
        const ctx = this.ctx;
        this.panel(area.x, area.y, area.w, area.h, 'rgba(20, 20, 42, 0.88)', 'rgba(255, 255, 255, 0.08)', 11);

        this.text('筹码面板', area.x + 10, area.y + 10, 10, COLORS.sub, 'left', 'bold');
        this.text('剩余 ' + view.remainingCount, area.x + area.w - 10, area.y + 10, 9, COLORS.sub, 'right', 'normal');

        const cols = 4;
        const rows = 7;
        const gap = 3;
        const left = area.x + 7;
        const top = area.y + 20;
        const gridW = area.w - 14;
        const gridH = area.h - 20 - 7;
        const itemW = (gridW - gap * (cols - 1)) / cols;
        const itemH = (gridH - gap * (rows - 1)) / rows;
        const fontSize = Math.max(6.5, Math.min(10, itemH * 0.62));

        GameConfig.amounts.forEach((amount, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = left + col * (itemW + gap);
            const y = top + row * (itemH + gap);
            const out = view.remainingAmounts.indexOf(amount) === -1;
            const isBig = amount >= 100000;

            rr(ctx, x, y, itemW, itemH, 4);
            ctx.fillStyle = out ? 'rgba(255, 255, 255, 0.025)' : (isBig ? 'rgba(255, 212, 94, 0.12)' : 'rgba(255, 255, 255, 0.055)');
            ctx.fill();

            ctx.globalAlpha = out ? 0.28 : 1;
            this.text(fmt(amount), x + itemW / 2, y + itemH / 2, fontSize, out ? COLORS.sub : (isBig ? COLORS.gold : COLORS.text), 'center', out ? 'normal' : 'bold');
            if (out) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x + 6, y + itemH / 2);
                ctx.lineTo(x + itemW - 6, y + itemH / 2);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        });
    }

    // ---------- 弹层 ----------

    drawFooter() {
        const area = this.layout.amounts;
        const remaining = this.height - (area.y + area.h);
        if (remaining < 26) return;
        this.text(
            '虚拟筹码 · 仅限娱乐 · 无现金价值',
            this.width / 2,
            this.height - 12,
            8,
            'rgba(156, 156, 184, 0.45)',
            'center',
            'normal'
        );
    }

    modalY(panelH) {
        return Math.max(this.safeTop + 8, (this.height - panelH) / 2);
    }

    drawTicket(view, ui) {
        this.dim();
        const panelW = Math.min(this.contentW - 12, 330);
        const panelH = 350;
        const x = (this.width - panelW) / 2;
        const y = this.modalY(panelH);
        const ctx = this.ctx;

        this.panel(x, y, panelW, panelH, COLORS.panel, 'rgba(255, 212, 94, 0.35)', 16);

        this.text('一掷千金', this.width / 2, y + 30, 24, COLORS.gold, 'center', 'bold');
        this.text('DEAL OR NO DEAL', this.width / 2, y + 50, 8, COLORS.sub, 'center', 'normal');

        this.text('当前门票', this.width / 2, y + 78, 11, COLORS.sub, 'center', 'normal');
        this.text(view.debugUnlimited ? '∞' : ('🎫 ' + view.tickets), this.width / 2, y + 108, 34, COLORS.gold, 'center', 'bold');

        const hint = view.debugUnlimited
            ? '调试模式：开始游戏不消耗门票'
            : (view.tickets > 0
                ? '每日免费 ' + GameConfig.ticket.dailyFree + ' 张，次日恢复'
                : '今日免费门票已用完，可以看广告或明天再来');
        const hintLines = this.wrap(hint, panelW - 40, 2, 9.5);
        hintLines.forEach((line, index) => {
            this.text(line, this.width / 2, y + 136 + index * 14, 9.5, COLORS.sub, 'center', 'normal');
        });

        const buttonX = x + 24;
        const buttonW = panelW - 48;
        this.button(buttonX, y + 166, buttonW, 44, '使用门票开始', {
            id: 'ticket:play',
            disabled: (view.tickets <= 0 && !view.debugUnlimited) || !!ui.adLoading,
            fill: COLORS.gold,
            color: COLORS.ink,
            fontSize: 15
        });

        this.button(buttonX, y + 220, buttonW, 40, ui.adLoading ? '广告加载中...' : '看广告 +1', {
            id: 'ticket:ad',
            disabled: !!ui.adLoading,
            fill: COLORS.panel3,
            color: COLORS.gold,
            border: 'rgba(255, 212, 94, 0.42)',
            fontSize: 13
        });

        this.button(buttonX, y + 270, buttonW, 34, '分享游戏（不奖励门票）', {
            id: 'ticket:share',
            disabled: !!ui.adLoading,
            fill: 'transparent',
            color: COLORS.sub,
            border: 'rgba(255, 255, 255, 0.14)',
            fontSize: 10
        });

        this.text(GameConfig.dialog.virtualNotice, this.width / 2, y + panelH - 12, 8, 'rgba(156, 156, 184, 0.65)', 'center', 'normal');
    }

    drawBanker(view) {
        this.dim();
        const panelW = Math.min(this.contentW - 12, 320);
        const panelH = 342;
        const x = (this.width - panelW) / 2;
        const y = this.modalY(panelH);

        this.panel(x, y, panelW, panelH, COLORS.panel, 'rgba(255, 212, 94, 0.35)', 16);

        this.text('📞', this.width / 2, y + 28, 26, COLORS.gold, 'center', 'normal');
        this.text('银行家来电', this.width / 2, y + 56, 18, COLORS.text, 'center', 'bold');
        this.text('他出价', this.width / 2, y + 82, 10, COLORS.sub, 'center', 'normal');
        this.text(fmt(view.bankerOffer), this.width / 2, y + 116, 32, COLORS.gold, 'center', 'bold');
        this.text('你的 ' + (view.playerBox + 1) + ' 号箱', this.width / 2, y + 140, 9, COLORS.sub, 'center', 'normal');

        const buttonX = x + 22;
        const buttonW = panelW - 44;
        this.button(buttonX, y + 162, buttonW, 44, '成交  DEAL', {
            id: 'banker:deal',
            fill: COLORS.green,
            color: '#062317',
            fontSize: 15
        });
        this.button(buttonX, y + 214, buttonW, 44, '继续  NO DEAL', {
            id: 'banker:noDeal',
            fill: COLORS.redDark,
            color: '#ffd7db',
            border: 'rgba(255, 92, 108, 0.55)',
            fontSize: 14
        });
        this.button(buttonX, y + 268, buttonW, 36, view.bargainUsed ? '本局已讨价还价' : '讨价还价（仅一次）', {
            id: 'banker:bargain',
            disabled: view.bargainUsed,
            fill: 'transparent',
            color: COLORS.gold,
            border: 'rgba(255, 212, 94, 0.45)',
            fontSize: 11
        });
    }

    drawBargain(view, ui) {
        this.dim();
        const panelW = Math.min(this.contentW - 8, 340);
        const panelH = Math.min(470, this.height - 28);
        const x = (this.width - panelW) / 2;
        const y = this.modalY(panelH);

        this.panel(x, y, panelW, panelH, COLORS.panel, 'rgba(255, 212, 94, 0.35)', 16);

        this.text('讨价还价', this.width / 2, y + 24, 20, COLORS.gold, 'center', 'bold');
        this.text('银行家出价 ' + fmt(view.bankerOffer), this.width / 2, y + 48, 11, COLORS.sub, 'center', 'normal');

        const inputX = x + 24;
        const inputW = panelW - 48;
        this.panel(inputX, y + 64, inputW, 42, 'rgba(255, 255, 255, 0.06)', 'rgba(255, 212, 94, 0.3)', 9);
        const display = ui.bargainText ? '$' + formatDigits(ui.bargainText) : '输入你的出价';
        this.text(display, this.width / 2, y + 85, ui.bargainText ? 20 : 11, ui.bargainText ? COLORS.gold : COLORS.sub, 'center', 'bold');

        if (ui.bargainMessage) {
            const messages = this.wrap(ui.bargainMessage, panelW - 40, 1, 8.5);
            messages.forEach((line, index) => {
                this.text(line, this.width / 2, y + 118 + index * 12, 8.5, COLORS.red, 'center', 'normal');
            });
        } else {
            this.text('高于原报价，但别太贪心', this.width / 2, y + 118, 8.5, COLORS.sub, 'center', 'normal');
        }

        const keyX = x + 24;
        const keyW = panelW - 48;
        const colGap = 7;
        const rowGap = 6;
        const keyWEach = (keyW - colGap * 2) / 3;
        const keyH = Math.min(38, Math.max(28, (panelH - 282) / 4));
        const keys = [
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['0', '00', 'back']
        ];
        const keyStartY = y + 136;

        keys.forEach((row, rowIndex) => {
            row.forEach((key, colIndex) => {
                const kx = keyX + colIndex * (keyWEach + colGap);
                const ky = keyStartY + rowIndex * (keyH + rowGap);
                const label = key === 'back' ? '删除' : key;
                this.button(kx, ky, keyWEach, keyH, label, {
                    id: 'bargain:key:' + key,
                    disabled: !!ui.bargainLocked,
                    fill: COLORS.panel2,
                    color: COLORS.text,
                    border: 'rgba(255, 255, 255, 0.1)',
                    fontSize: key === 'back' ? 12 : 16,
                    radius: 8
                });
            });
        });

        const submitY = keyStartY + 4 * keyH + 3 * rowGap + 10;
        this.button(keyX, submitY, keyW, 38, '提交出价', {
            id: 'bargain:submit',
            disabled: !ui.bargainText || !!ui.bargainLocked,
            fill: COLORS.gold,
            color: COLORS.ink,
            fontSize: 14
        });

        this.button(keyX, submitY + 46, keyW, 30, '取消，回到原报价', {
            id: 'bargain:cancel',
            disabled: !!ui.bargainLocked,
            fill: 'transparent',
            color: COLORS.sub,
            border: 'rgba(255, 255, 255, 0.12)',
            fontSize: 10
        });
    }

    drawResult(view, ui) {
        this.dim();
        const result = ui.result || {};
        const panelW = Math.min(this.contentW - 12, 330);
        const panelH = 404;
        const x = (this.width - panelW) / 2;
        const y = this.modalY(panelH);
        const titleColor = result.win ? COLORS.green : result.lose ? COLORS.red : COLORS.gold;

        this.panel(x, y, panelW, panelH, COLORS.panel, 'rgba(255, 212, 94, 0.35)', 16);
        this.text(result.title || '游戏结束', this.width / 2, y + 30, 20, titleColor, 'center', 'bold');

        const boxSize = 76;
        const boxX = (this.width - boxSize) / 2;
        const boxY = y + 54;
        this.drawBoxBack(boxX, boxY, boxSize, result.boxAmount === undefined ? 0 : result.boxAmount);

        const message = result.message || '';
        const lines = this.wrap(message, panelW - 44, 3, 10);
        lines.forEach((line, index) => {
            this.text(line, this.width / 2, y + 144 + index * 15, 10, COLORS.text, 'center', 'normal');
        });

        this.text('你的最终筹码', this.width / 2, y + 202, 10, COLORS.sub, 'center', 'normal');
        this.text(fmt(result.prize), this.width / 2, y + 230, 28, COLORS.gold, 'center', 'bold');

        if (result.otherBoxAmount !== undefined && result.otherBoxAmount !== null) {
            this.text('另一个箱子：' + fmt(result.otherBoxAmount), this.width / 2, y + 258, 9.5, COLORS.sub, 'center', 'normal');
        } else if (result.offer !== undefined) {
            this.text('银行家报价：' + fmt(result.offer), this.width / 2, y + 258, 9.5, COLORS.sub, 'center', 'normal');
        }

        this.button(x + 24, y + 282, panelW - 48, 42, '再来一局', {
            id: 'result:restart',
            fill: COLORS.gold,
            color: COLORS.ink,
            fontSize: 15
        });
        this.text('当前门票：' + view.tickets, this.width / 2, y + 342, 9, COLORS.sub, 'center', 'normal');
        this.text(GameConfig.dialog.virtualNotice, this.width / 2, y + panelH - 10, 8, 'rgba(156, 156, 184, 0.65)', 'center', 'normal');
    }

    drawToast() {
        if (!this.toastData || this.lastNow >= this.toastData.until) return;
        const ctx = this.ctx;
        const text = this.toastData.text;
        ctx.font = this.font(10, 'normal');
        const width = Math.min(this.width - 32, Math.max(80, ctx.measureText(text).width + 28));
        const x = (this.width - width) / 2;
        const y = this.height - 40;
        this.panel(x, y, width, 28, 'rgba(10, 10, 22, 0.94)', 'rgba(255, 212, 94, 0.3)', 14);
        this.text(text, this.width / 2, y + 14, 10, COLORS.text, 'center', 'normal');
    }
}

module.exports = Renderer;
