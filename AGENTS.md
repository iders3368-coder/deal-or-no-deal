# AGENTS.md

## 语言要求
- 始终使用中文回复用户。
- 代码注释、UI 文案、提交信息尽量使用中文（代码标识符用英文）。

## 项目简介
- 抖音小游戏《一掷千金》（Deal or No Deal）原生 Canvas 版。
- 玩家从 26 个箱子中选择命运之箱，逐轮开箱排除金额；银行家按剩余期望值报价，玩家选择成交、继续或使用一次讨价还价。
- 游戏内金额全部是虚拟筹码，不涉及真实货币、充值或提现。

## 技术约束
- 目标平台：抖音小游戏，使用抖音开发者工具编译、预览、真机调试和上传。
- 运行时无 DOM、无 CSS、无 `window`/`document`；平台能力统一使用 `tt.*`。
- 不使用微信小程序 API（如 `wx.*`）。
- 广告、分享、存储、触摸、音频均通过 `src/platform.js` 或 `src/storage.js`、`src/audio.js` 适配。
- 原生 Canvas 2D + CommonJS，不引入 Cocos/Laya 等引擎依赖，也没有 npm 运行时依赖。
- 发布前必须由项目所有者提供真实 appid 和激励视频广告位 ID。

## 工作区状态
- 已完成从 H5/DOM 原型到抖音小游戏 Canvas 版的重构。
- 根目录是抖音小游戏工程；旧 H5 原型在 `legacy-web/`，浏览器预览在 `preview/`，两者都通过 `packOptions.ignore` 排除。
- 当前 `project.config.json` 的 appid 是占位符，`src/config.js` 的 `ticket.adUnitId` 为空，不能直接提审上线。
- 当前项目不是 git 仓库。

## 目录结构
```
.
├── game.js                  # 小游戏入口：创建 Canvas、启动控制器
├── game.json                # 抖音小游戏配置
├── project.config.json      # 项目配置、appid、打包忽略规则
├── src/
│   ├── config.js            # 金额、9 轮配置、门票、台词、广告位
│   ├── gameManager.js       # 纯逻辑，不依赖 Canvas/tt
│   ├── renderer.js          # Canvas 绘制、布局、触摸热区
│   ├── app.js               # 流程控制器、触摸事件、台词节奏
│   ├── platform.js          # tt.* 适配、广告、分享、Toast、震动
│   ├── storage.js           # tt/浏览器/内存存储适配
│   ├── audio.js             # 音效池
│   └── utils.js             # 金额格式化、文案、日期
├── audio/                   # 16-bit PCM WAV 音效
├── test/                    # Node 测试（逻辑 + 5000 局模拟）
├── tools/
│   ├── build-preview.js     # 将 CommonJS 源码打包为 preview/bundle.js
│   └── generate-audio.js    # 重新生成音效
├── preview/                 # 浏览器预览和 tt 模拟层（不打包）
├── legacy-web/              # 旧 H5 原型（不打包）
├── server.js                # 本地预览服务器，仅监听 127.0.0.1
├── start.bat                # Windows 一键构建并预览
├── README.md
└── AGENTS.md
```

## 开发命令
- 运行测试：`npm test`
- 构建浏览器预览：`npm run build:preview`
- 启动浏览器预览：`npm run preview`（默认 <http://127.0.0.1:3000/preview/>）
- Windows 一键预览：双击 `start.bat`
- 重新生成音效：`npm run audio`
- 抖音开发者工具：导入项目根目录，选择小游戏类型，编译/预览/真机调试
- 发布：在抖音开发者工具中上传，再到抖音开放平台提交审核

## 核心规则约束
- 箱子数量：26。
- 轮次：9 轮，开箱数依次为 `6,5,4,3,2,1,1,1,1`，合计 24 次。
- 终局固定剩 2 个箱子；玩家箱子在终局才揭晓。
- 任何终局结果都必须返回数值型 `prize` 字段；UI 不得直接读取未定义的内部字段。
- 银行家报价基于剩余金额期望值，不能读取玩家箱子的具体金额。
- 讨价还价每局只有一次；成功、过低、过高三种结果都要有明确状态。
- UI 状态只能包含已开箱金额，绝不能把 26 个未开金额写入 `view` 或触摸数据。
- 金额展示统一走 `utils.fmt` / `utils.fmtShort`，禁止使用 `toLocaleString`（旧版崩溃来源）。
- 门票：每日免费 1 张；广告完整观看 +1；分享不奖励；广告未配置/未完成不发奖。
- `ticket.debugUnlimited` 发布前必须为 `false`。

## 架构约定
- `gameManager.js` 只做纯逻辑，不能 require `renderer`、`app`、`platform`。
- `renderer.js` 只绘制和注册热区，不直接修改 `GameManager` 状态。
- `app.js` 负责把用户操作转换成逻辑调用，并安排台词/动画节奏。
- `platform.js` 是唯一直接调用 `tt.*` 的模块（`storage.js`、`audio.js` 中的 `tt.*` 也属于平台边界）。
- `config.js` 集中放置可调参数和中文文案，不在业务代码里硬编码金额/轮次。
- 打字机、开箱动画、Toast 统一使用 `Date.now()` 作为时间基准，不要混用 `requestAnimationFrame` 传入的时间戳。
- 顶栏布局会同时避开系统安全区和抖音右上角胶囊按钮，不要把内容顶到 0 坐标。
- CommonJS 文件使用 `require` / `module.exports`；新增文件必须能在 Node 中 `node --check`。
- 文件名使用小写开头的 camelCase；代码标识符英文，注释和 UI 文案中文。

## 测试要求
- 修改核心逻辑后至少运行 `npm test`。
- 新增规则或结算分支时，补充 `test/gameManager.test.js` 或 `test/simulation.test.js`。
- 修改 Canvas 布局后，用浏览器预览检查至少 390×844 和 320×568 两种尺寸，确认按钮、金额面板、弹层不溢出。
- 修改平台接入后，必须在抖音开发者工具真机验证，尤其是广告完整观看/中途关闭和分享回调。

## 发布前必须确认
- `project.config.json` 的 `appid` 替换为真实 appid。
- `src/config.js` 的 `ticket.adUnitId` 替换为真实激励视频广告位 ID。
- `ticket.debugUnlimited` 为 `false`。
- `packOptions.ignore` 生效，上传包不包含 `legacy-web/`、`preview/`、`test/`、`tools/`、`server.js`、`start.bat`、文档文件。
- 抖音开放平台已完成小游戏类目、隐私政策、适龄提示和虚拟道具说明配置。
- 游戏内没有现金兑换、真实博彩或误导性宣传。

## 禁止事项
- 不要在正式小游戏代码里使用 `document`、`window`、`localStorage` 作为主实现；浏览器兼容分支只能是带 `typeof` 保护的降级路径。
- 不要使用 `wx.*` 或微信小程序示例代码。
- 不要把 `preview/` 里的模拟广告逻辑打进正式包。
- 不要把未开箱金额传给 UI 或写入 DOM/Canvas 状态。
- 不要把本地预览服务器绑定到 `0.0.0.0` 或部署到公网。
- 不要删除 `legacy-web/` 中的旧版对照文件；如需清理，先确认用户意图。
