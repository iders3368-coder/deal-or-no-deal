const test = require('node:test');
const assert = require('node:assert/strict');

const GameConfig = require('../src/config');
const Renderer = require('../src/renderer');

// 只测试台词节奏，不初始化 Canvas：借用 Renderer 原型上的说话相关方法。
function createSpeechRenderer() {
    const renderer = Object.create(Renderer.prototype);
    renderer.speech = null;
    return renderer;
}

test('主持人台词按配置速度逐字显示，整句结束后停顿再回调', () => {
    const renderer = createSpeechRenderer();
    const charDelay = GameConfig.speech.charDelay;
    const hold = GameConfig.speech.hold;
    let done = 0;

    renderer.setSpeech('你好啊', () => {
        done += 1;
    });
    renderer.speech.start = 0;

    renderer.updateSpeech(0);
    assert.equal(renderer.getSpeechText(), '');
    assert.equal(done, 0);

    renderer.updateSpeech(charDelay);
    assert.equal(renderer.getSpeechText(), '你');

    renderer.updateSpeech(charDelay * 3);
    assert.equal(renderer.getSpeechText(), '你好啊');
    assert.equal(done, 0, '整句出现后不能立刻触发下一句');

    renderer.updateSpeech(charDelay * 3 + hold - 1);
    assert.equal(done, 0, '句末停顿期间不应触发回调');

    renderer.updateSpeech(charDelay * 3 + hold);
    assert.equal(done, 1);
    assert.equal(renderer.getSpeechText(), '你好啊');
    assert.equal(renderer.isSpeechTyping(), false);
});

test('跳过台词立即显示整句并触发回调', () => {
    const renderer = createSpeechRenderer();
    let done = 0;

    renderer.setSpeech('点击跳过', () => {
        done += 1;
    });
    renderer.speech.start = Date.now();
    renderer.skipSpeech();
    renderer.updateSpeech(Date.now());

    assert.equal(renderer.getSpeechText(), '点击跳过');
    assert.equal(done, 1);
    assert.equal(renderer.isSpeechTyping(), false);
});

test('空台词也会在停顿后回调，不会卡住流程', () => {
    const renderer = createSpeechRenderer();
    const hold = GameConfig.speech.hold;
    let done = 0;

    renderer.setSpeech('', () => {
        done += 1;
    });
    renderer.speech.start = 0;

    renderer.updateSpeech(0);
    assert.equal(done, 0);
    renderer.updateSpeech(hold);
    assert.equal(done, 1);
});
