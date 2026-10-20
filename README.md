# 一掷千金 · Deal or No Deal（抖音小游戏）

基于抖音小游戏原生 Canvas 2D + `tt.*` API 实现的《一掷千金》小游戏。玩家从 26 个箱子中选择一个，逐轮开箱排除金额，在银行家报价时选择成交（Deal）、继续（No Deal），或使用一次讨价还价。

> 游戏内金额均为虚拟筹码，仅用于娱乐展示，不具备现金价值，也不涉及真实支付。

## 玩法规则

- 26 个箱子，金额从 `$0.01` 到 `$2,500,000`，每局随机打乱。
- 玩家先选择一个“命运之箱”，这个箱子在终局前不会打开。
- 9 轮共打开 24 个箱子，每轮数量为：`6、5、4、3、2、1、1、1、1`。
- 每轮结束后银行家根据剩余金额的期望值报价。
- 玩家可以：
  - **成交**：立即拿走银行家报价，并揭晓自己的箱子。
  - **继续**：拒绝报价，进入下一轮；最后剩 2 个箱子时终局揭晓。
  - **讨价还价**：每局仅一次，向银行家还价；价格过高会被拒绝。
- 终局如果一直选择继续，获得自己箱子里的金额，并同时揭晓另一个箱子。
- 门票：每日免费 1 张；看激励视频可再获得 1 张；分享**不奖励**门票。
- 广告位未配置或广告未完整看完时，不会伪造奖励。

## 技术方案

- 原生 Canvas 2D 渲染，无 DOM、无 CSS、无第三方游戏引擎。
- 全部平台调用集中在 `src/platform.js`，使用抖音 `tt.*` API。
- CommonJS 模块拆分，逻辑、渲染、平台、音频互不耦合。
- 核心逻辑可在 Node 中直接测试；浏览器预览通过 `preview/browser-tt.js` 模拟 `tt`。
- 旧版 H5 原型保存在 `legacy-web/`，仅作对照，不进入小游戏包。

## 快速开始

### 1. 用抖音开发者工具运行

1. 安装并打开抖音开发者工具。
2. 选择“小游戏” → 导入项目，项目目录选择本仓库根目录。
3. 确认根目录包含：
   - `game.js`
   - `game.json`
   - `project.config.json`
4. 在 `project.config.json` 中把占位 appid 替换成你的真实小游戏 appid：
   ```json
   {
     "appid": "tt你的真实AppID"
   }
   ```
5. 编译预览。首次启动会获得 1 张免费门票。

### 2. 配置激励视频广告（上线前必须）

打开 `src/config.js`：

```js
ticket: {
    dailyFree: 1,
    adUnlimited: true,
    adDailyLimit: 20,
    adUnitId: '',          // 填入抖音激励视频广告位 ID
    debugUnlimited: false  // 发布前必须保持 false
}
```

- `adUnitId` 为空时，点击“看广告 +1”只会提示广告位未配置，不会发放门票。
- 广告完整播放结束（`res.isEnded === true`）才发放门票；中途关闭不发放。
- 如果不想让玩家无限看广告，把 `adUnlimited` 设为 `false`，并设置 `adDailyLimit`。
- 本地调试门票流程时，可临时把 `debugUnlimited` 设为 `true`；**发布前必须改回 `false`**。

### 3. 浏览器预览（不需要抖音开发者工具）

要求 Node.js 18 或更高版本。

```powershell
# 方式一：双击 start.bat
# 方式二：命令行
node tools/build-preview.js
node server.js
```

然后打开：<http://127.0.0.1:3000/preview/>

- 预览页会加载 `preview/bundle.js`（由 `tools/build-preview.js` 生成）。
- 预览中的广告使用浏览器确认框模拟；正式小游戏包不会包含这段模拟逻辑。
- 预览服务器只监听 `127.0.0.1`，并且只允许访问 `/preview/` 和 `/audio/`。
- 如果 3000 端口被占用，可用其他端口：
  ```powershell
  $env:PORT=3001; node server.js
  ```

### 4. 运行测试

```powershell
npm test
```

> Windows PowerShell 如果提示“禁止运行脚本”，可以改用 `npm.cmd test`。

测试覆盖：

- 26 个箱子、9 轮共 24 次开箱、终局剩 2 个箱子。
- 选箱、开箱、进入银行家报价、成交、继续、终局结算。
- 终局统一返回 `prize` 等字段，避免旧版 `undefined.toLocaleString()` 崩溃。
- 每日免费门票、跨天刷新、广告奖励及每日上限。
- 讨价还价成功、出价过低保持输入、出价过高被拒绝。
- UI 状态不泄露未开箱金额。
- 5000 局随机模拟，覆盖成交/继续/讨价还价路径。

## 目录结构

```
deal-or-no-deal-main/
├── game.js                  # 抖音小游戏入口
├── game.json                # 小游戏配置
├── project.config.json      # 开发者工具项目配置
├── src/
│   ├── config.js            # 金额、轮次、门票、台词、广告位
│   ├── gameManager.js       # 纯逻辑：选箱、开箱、报价、讨价还价、结算
│   ├── renderer.js          # Canvas 绘制、布局、触摸热区
│   ├── app.js               # 流程控制器、触摸事件、台词节奏
│   ├── platform.js          # tt.* 平台适配、广告、分享、Toast
│   ├── storage.js           # 本地存储（tt / 浏览器 / 内存）
│   ├── audio.js             # 音效管理
│   └── utils.js             # 金额格式化、文案、日期工具
├── audio/                   # 内置 WAV 音效
├── test/                    # Node 自动化测试
├── tools/
│   ├── build-preview.js     # 浏览器预览打包
│   └── generate-audio.js    # 重新生成音效
├── preview/                 # 仅浏览器预览使用，不进入小游戏包
├── legacy-web/              # 旧版 H5 原型，不进入小游戏包
├── server.js                # 本地安全预览服务器
├── start.bat                # Windows 一键预览
├── README.md
└── AGENTS.md
```

## 上线检查清单

- [ ] `project.config.json` 已填写真实 `appid`。
- [ ] `src/config.js` 已填写真实 `ticket.adUnitId`。
- [ ] `ticket.debugUnlimited` 为 `false`。
- [ ] 在抖音开发者工具中完成“预览”和“真机调试”。
- [ ] 在真机上验证：开箱、银行家报价、成交、继续、讨价还价、终局、再来一局。
- [ ] 在真机上验证：每日免费门票、广告完整观看奖励、广告中途关闭不发奖、分享不发奖。
- [ ] 确认 `legacy-web/`、`preview/`、`test/`、`tools/` 不会出现在上传包中（`project.config.json` 的 `packOptions.ignore`）。
- [ ] 如果所用开发者工具版本不识别 `packOptions.ignore`，请在上传前手动移出这些目录，避免旧版 HTML/CSS 或预览文件被一起打包。
- [ ] 在抖音开放平台配置小游戏名称、图标、隐私政策、适龄提示和虚拟道具说明。
- [ ] 游戏内金额为虚拟筹码，不宣传现金兑换或真实博彩。

## 平台与合规说明

- 目标运行环境是抖音小游戏，不是浏览器；正式包不依赖 `document`、`window`、`localStorage`。
- 广告和分享使用抖音开放能力；没有接入任何第三方广告 SDK。
- 游戏没有服务器、没有排行榜、没有真实支付；门票和广告次数保存在本机。
- 清除小游戏缓存会重置本机门票和每日广告计数。
- 旧版 H5 的 `server.js` 仅供本地对照，已修复路径穿越并只监听 `127.0.0.1`，不要公网部署。

## 已知限制

- 没有接入排行榜、好友房或服务端存档。
- 没有真实货币、充值或提现能力，金额仅为虚拟筹码。
- 广告位 ID 和正式 appid 需要由项目所有者提供后才能完成真机广告测试与提审。
- 银行家报价和讨价还价是本地策略计算，不涉及联网对局。

## 旧版 H5

`legacy-web/` 保留改造前的 DOM/CSS 版本，方便对照视觉和玩法。旧版存在终局崩溃、轮次合计 26 次、讨价还价重复绑定等问题，未作为正式版本维护。

```powershell
cd legacy-web
node server.js
# 打开 http://127.0.0.1:3002/
```
