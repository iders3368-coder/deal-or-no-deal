/**
 * 生成小游戏内置音效（16-bit PCM WAV）
 * 运行：node tools/generate-audio.js
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const OUT_DIR = path.join(__dirname, '..', 'audio');

function clamp(value) {
    return Math.max(-1, Math.min(1, value));
}

function envelope(t, duration, attack, release) {
    const a = attack === undefined ? 0.01 : attack;
    const r = release === undefined ? 0.08 : release;
    if (t < a) return t / a;
    if (t > duration - r) return Math.max(0, (duration - t) / r);
    return 1;
}

function tone(freq, duration, options) {
    const opts = options || {};
    const type = opts.type || 'sine';
    const volume = opts.volume === undefined ? 0.6 : opts.volume;
    const attack = opts.attack === undefined ? 0.008 : opts.attack;
    const release = opts.release === undefined ? 0.08 : opts.release;
    const sweepTo = opts.sweepTo;
    const samples = [];
    const count = Math.floor(duration * SAMPLE_RATE);
    let phase = 0;

    for (let i = 0; i < count; i += 1) {
        const t = i / SAMPLE_RATE;
        const ratio = count > 1 ? i / (count - 1) : 0;
        const currentFreq = sweepTo ? freq + (sweepTo - freq) * ratio : freq;
        phase += (Math.PI * 2 * currentFreq) / SAMPLE_RATE;

        let wave;
        if (type === 'square') {
            wave = Math.sin(phase) >= 0 ? 1 : -1;
        } else if (type === 'triangle') {
            wave = (2 / Math.PI) * Math.asin(Math.sin(phase));
        } else if (type === 'saw') {
            const cycle = phase / (Math.PI * 2);
            wave = 2 * (cycle - Math.floor(cycle + 0.5));
        } else {
            wave = Math.sin(phase);
        }

        samples.push(wave * volume * envelope(t, duration, attack, release));
    }
    return samples;
}

function concat() {
    const lists = Array.prototype.slice.call(arguments);
    return lists.reduce((all, list) => all.concat(list), []);
}

function silence(duration) {
    return new Array(Math.floor(duration * SAMPLE_RATE)).fill(0);
}

function multiTone(freqs, durations, options) {
    const pieces = [];
    freqs.forEach((freq, index) => {
        pieces.push(tone(freq, durations[index], options));
        if (index < freqs.length - 1) pieces.push(silence(0.015));
    });
    return concat.apply(null, pieces);
}

function writeWav(name, samples) {
    const count = samples.length;
    const buffer = Buffer.alloc(44 + count * 2);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + count * 2, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(1, 22); // mono
    buffer.writeUInt32LE(SAMPLE_RATE, 24);
    buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(count * 2, 40);

    for (let i = 0; i < count; i += 1) {
        buffer.writeInt16LE(Math.round(clamp(samples[i]) * 32767), 44 + i * 2);
    }

    fs.writeFileSync(path.join(OUT_DIR, name + '.wav'), buffer);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

writeWav('click', tone(700, 0.055, { type: 'sine', volume: 0.5, release: 0.045 }));
writeWav('box_open', tone(300, 0.16, { type: 'triangle', volume: 0.5, sweepTo: 900 }));
writeWav('reveal_small', multiTone([523, 659], [0.1, 0.13], { type: 'sine', volume: 0.45 }));
writeWav('reveal_mid', multiTone([440, 554], [0.11, 0.16], { type: 'triangle', volume: 0.5 }));
writeWav('reveal_big', concat(
    tone(600, 0.5, { type: 'saw', volume: 0.35, sweepTo: 120 }),
    tone(80, 0.35, { type: 'sine', volume: 0.5 })
));
writeWav('phone_ring', concat(
    tone(880, 0.16, { type: 'square', volume: 0.18 }),
    silence(0.04),
    tone(1046, 0.16, { type: 'square', volume: 0.18 }),
    silence(0.12),
    tone(880, 0.16, { type: 'square', volume: 0.18 }),
    silence(0.04),
    tone(1046, 0.16, { type: 'square', volume: 0.18 })
));
writeWav('banker', concat(
    tone(180, 0.35, { type: 'saw', volume: 0.3 }),
    tone(120, 0.35, { type: 'sine', volume: 0.4 })
));
writeWav('deal', tone(700, 0.45, { type: 'sine', volume: 0.5, sweepTo: 200 }));
writeWav('no_deal', tone(250, 0.38, { type: 'sine', volume: 0.5, sweepTo: 700 }));
writeWav('win', multiTone([523, 659, 784, 1047], [0.12, 0.12, 0.12, 0.22], { type: 'sine', volume: 0.5 }));
writeWav('lose', multiTone([392, 330, 262, 196], [0.15, 0.15, 0.15, 0.28], { type: 'saw', volume: 0.3 }));
writeWav('reject', concat(
    tone(300, 0.14, { type: 'square', volume: 0.22 }),
    tone(200, 0.2, { type: 'square', volume: 0.22 })
));

console.log('音效已生成到 audio/');
