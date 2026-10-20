/**
 * 游戏配置
 *
 * 说明：
 * 1. 26 个箱子、24 次开箱、9 轮，最后剩 2 个箱子进入终局。
 * 2. 金额只作为游戏内虚拟筹码展示，不涉及真实货币。
 * 3. 发布前必须填写 ticket.adUnitId，并把 ticket.debugUnlimited 改为 false。
 */

const GameConfig = {
    // 节目原版金额（虚拟筹码，26 个）
    amounts: [
        0.01, 1, 5, 10, 25,
        75, 100, 200, 300, 400,
        500, 750, 1000, 5000, 10000,
        25000, 50000, 75000, 100000, 200000,
        300000, 400000, 500000, 750000, 1000000,
        2500000
    ],

    // 门票与广告
    ticket: {
        dailyFree: 1,          // 每日免费门票
        adUnlimited: true,     // 是否允许无限看广告换门票
        adDailyLimit: 20,      // adUnlimited 为 false 时，每天最多看多少次广告
        adUnitId: '',          // 抖音激励视频广告位 ID，发布前填写
        debugUnlimited: false  // 本地调试开关：true 时不消耗门票；发布前必须为 false
    },

    // 银行家出价模型
    banker: {
        baseMultiplier: 0.35,  // 基础系数（剩余期望值的 35%）
        randomRange: 0.08,     // 随机浮动范围
        roundBonus: 0.012      // 每轮略微提高报价，后期更有吸引力
    },

    // 9 轮共 24 次开箱；玩家自己的箱子始终保留
    rounds: [
        { openCount: 6, desc: '第一轮：打开6个箱子' },
        { openCount: 5, desc: '第二轮：打开5个箱子' },
        { openCount: 4, desc: '第三轮：打开4个箱子' },
        { openCount: 3, desc: '第四轮：打开3个箱子' },
        { openCount: 2, desc: '第五轮：打开2个箱子' },
        { openCount: 1, desc: '第六轮：打开1个箱子' },
        { openCount: 1, desc: '第七轮：打开1个箱子' },
        { openCount: 1, desc: '第八轮：打开1个箱子' },
        { openCount: 1, desc: '第九轮：打开1个箱子' }
    ],

    // 主持人台词
    dialog: {
        welcome: '嘿！欢迎来到《一掷千金》！我是主持人小博！今天谁会成为大赢家呢？',
        noTicket: '门票用完了。看一段广告可以再获得一张门票，或者明天再来！',
        adDone: '广告看完了！奖励你一张门票！',
        adFail: '广告暂时不可用，请稍后再试。',
        adNotConfigured: '广告位还没有配置，暂时无法领取广告奖励。',
        adNotFinished: '需要完整看完广告才能获得门票哦。',
        adLimit: '今天的广告奖励次数已经用完了，明天再来吧。',
        shareToast: '分享面板已打开。',
        chooseBox: '面前有{count}个箱子，每个箱子里藏着不同数量的虚拟筹码！现在，请选一个作为你的命运之箱！',
        boxSelected: '好眼光！你选了{n}号箱！它是你的了！记住，它可能藏着250万筹码，也可能只有1美分！',
        roundStart: '来吧！本轮需要打开{count}个箱子！每打开一个，剩下的金额就会被淘汰！',
        openedBig: '不！{n}号箱——{amount}！天哪，一个大奖被淘汰了！太可惜了！',
        openedMid: '{n}号箱——{amount}！不算太糟，还能接受！',
        openedSmall: '{n}号箱——{amount}！哈哈，好消息！淘汰掉了一个小金额！',
        openedTiny: '{n}号箱——{amount}！漂亮！这种小钱被淘汰掉完全没关系！',
        bankerCalling: '嘘——电话响了！那个贪婪的银行家又打来了……',
        hostCall: '喂？银行家？……嗯……你出多少？……就这？你在开玩笑吧……',
        offer: '银行家只出价{amount}！他想低价买走你的{n}号箱！这个吸血鬼！',
        dealOrNoDeal: '接受这个低得离谱的价格，还是继续跟他斗？你说了算！',
        bargainHint: '你只有一次讨价还价的机会。出价必须高于银行家的报价，但别太贪心。',
        bargainInput: '大胆开价！告诉这个吝啬鬼你值多少！',
        bargainAccept: '银行家接受了你的出价！成交价 {amount}！',
        bargainRejectLow: '这个价格还不够高。你的出价必须高于银行家的报价。',
        bargainRejectHigh: '银行家拒绝了这个价格。你可以接受原报价，或者继续。',
        bargainInvalid: '请输入有效的金额。',
        dealResult: '成交！你拿走了{prize}！来，让我们看看你的{n}号箱里到底是什么……',
        noDealResult: '继续！有勇气！下一轮继续开箱！',
        gameOver: '最终时刻！只剩下最后两个箱子了。现在，揭晓你的{n}号箱！',
        gameWin: '太棒了！你的{n}号箱里是{amount}！你赢得了{prize}！',
        gameLose: '你的{n}号箱里是{amount}……银行家是对的，你亏了{diff}……',
        gameEven: '平局！你的{n}号箱里正好是{amount}！',
        restart: '再来一局吧！',
        virtualNotice: '游戏内筹码仅为虚拟娱乐，无现金价值。'
    },

    states: {
        WAITING_PAYMENT: 'waiting_payment',
        READY: 'ready',
        PLAYING: 'playing',
        BANKER_OFFER: 'banker_offer',
        BARGAIN: 'bargain',
        DEAL: 'deal',
        GAME_OVER: 'game_over'
    },

    share: {
        title: '一掷千金：你能拿走多少筹码？',
        imageUrl: '',
        query: ''
    },

    audio: {
        volume: 0.6
    },

    storage: {
        prefix: 'dond:'
    }
};

module.exports = GameConfig;
