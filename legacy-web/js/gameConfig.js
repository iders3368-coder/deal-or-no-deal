/**
 * 游戏配置文件
 * 节目原版美元金额 + 门票系统 + 对话系统
 */

const GameConfig = {
    // 节目原版金额（美元，26个）
    amounts: [
        0.01, 1, 5, 10, 25,
        75, 100, 200, 300, 400,
        500, 750, 1000, 5000, 10000,
        25000, 50000, 75000, 100000, 200000,
        300000, 400000, 500000, 750000, 1000000,
        2500000
    ],

    // 门票系统
    ticket: {
        dailyFree: 1,        // 每日免费1张
        shareMax: 1,         // 分享最多得1张
        adUnlimited: true    // 看广告不限量
    },

    // 银行家出价（邪恶资本家，疯狂压价）
    banker: {
        baseMultiplier: 0.3,    // 基础系数（期望值的30%）
        randomRange: 0.1,       // 随机浮动±0.1
        roundBonus: 0.012       // 每轮微弱递增
    },

    // 轮次
    rounds: [
        { openCount: 6, desc: '第一轮：打开6个箱子' },
        { openCount: 5, desc: '第二轮：打开5个箱子' },
        { openCount: 4, desc: '第三轮：打开4个箱子' },
        { openCount: 3, desc: '第四轮：打开3个箱子' },
        { openCount: 2, desc: '第五轮：打开2个箱子' },
        { openCount: 1, desc: '第六轮：打开1个箱子' },
        { openCount: 1, desc: '第七轮：打开1个箱子' },
        { openCount: 1, desc: '第八轮：打开1个箱子' },
        { openCount: 1, desc: '第九轮：打开1个箱子' },
        { openCount: 1, desc: '第十轮：打开1个箱子' },
        { openCount: 1, desc: '第十一轮：打开1个箱子' }
    ],

    // 主持人小博台词（全程主持）
    dialog: {
        welcome: '嘿！欢迎来到《一掷千金》！我是你们的主持人小博！今天谁会成为百万富翁呢？',
        noTicket: '哎呀，门票用完了！看广告可以获得一张门票哦！',
        adDone: '广告看完了！奖励你一张门票！',
        shareDone: '分享成功！你的好友给你带来了一张门票！',
        shareMax: '分享得票已达上限，今天不能再分享了！',
        chooseBox: '面前有26个箱子，每个箱子藏着不同金额的奖金！现在，请选一个作为你的命运之箱！',
        boxSelected: '好眼光！你选了{n}号箱！它是你的了！记住，它可能藏着250万美元，也可能只有1美分！',
        roundStart: '来吧！本轮需要打开{count}个箱子！每打开一个，剩下的金额就会被淘汰！',
        // 开箱台词 - 根据金额大小分档
        openedBig: '不！{n}号箱——{amount}！天哪，一个大奖被淘汰了！太可惜了！',
        openedMid: '{n}号箱——{amount}！不算太糟，还能接受！',
        openedSmall: '{n}号箱——{amount}！哈哈，好消息！淘汰掉了一个小金额！',
        openedTiny: '{n}号箱——{amount}！漂亮！这种小钱被淘汰掉完全没关系！',
        bankerCalling: '嘘——电话响了！那个贪婪的银行家又打来了...',
        hostCall: '喂？银行家？...嗯...你出多少？...就这？你在开玩笑吧...',
        offer: '银行家只出价{amount}！他想低价买走你的{n}号箱！这个吸血鬼！',
        dealOrNoDeal: '接受这个低得离谱的价格，还是继续跟他斗？你说了算！',
        bargainHint: '你还有一次讨价还价的机会！让他出更多！',
        bargainInput: '大胆开价！告诉这个吝啬鬼你值多少！',
        bargainWait: '银行家在算计...他在想怎么压价...',
        bargainReject: '果然！银行家拒绝了！他一分钱都不肯加！这个铁公鸡！只能继续了！',
        dealResult: '成交！你拿走了{prize}！来，让我们看看你的{n}号箱里到底是什么...',
        noDealResult: '继续！有勇气！让我们看看接下来打开什么！',
        gameOver: '最终时刻！所有箱子都开完了！现在，让我们打开你的{n}号箱！',
        gameWin: '太棒了！你的{n}号箱里是{amount}！你赢得了{prize}！',
        gameLose: '你的{n}号箱里是{amount}...银行家是对的，你亏了{diff}...',
        gameEven: '平局！你的{n}号箱里正好是{amount}！'
    },

    states: {
        WAITING_PAYMENT: 'waiting_payment',
        READY: 'ready',
        PLAYING: 'playing',
        BANKER_OFFER: 'banker_offer',
        BARGAIN: 'bargain',
        DEAL: 'deal',
        GAME_OVER: 'game_over'
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameConfig;
}
