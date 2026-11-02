/* GobanSound — 用 Web Audio API 合成的轻量音效（无音频文件，离线可用）
 * 音效：落子、提子、答对、答错、完成。
 * 浏览器自动播放策略：AudioContext 需在用户手势后恢复，这里在点击时惰性创建/恢复。
 */
(function (global) {
  'use strict';

  var ctx = null;
  var enabled = true;

  function ensureCtx() {
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function setEnabled(v) { enabled = !!v; }
  function isEnabled() { return enabled; }

  // 单音：freq 频率，duration 秒，type 波形，gain 音量，delay 延迟秒
  function tone(freq, duration, type, gain, delay) {
    var c = ensureCtx();
    if (!c || !enabled) return;
    var t0 = c.currentTime + (delay || 0);
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.3, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  function playStone() {
    tone(170, 0.1, 'triangle', 0.32);
    tone(340, 0.05, 'sine', 0.1);
  }

  function playCapture() {
    tone(520, 0.09, 'sine', 0.28);
    tone(780, 0.1, 'sine', 0.2, 0.02);
  }

  function playCorrect() {
    tone(523.25, 0.12, 'sine', 0.28);
    tone(659.25, 0.12, 'sine', 0.28, 0.1);
    tone(783.99, 0.2, 'sine', 0.28, 0.2);
  }

  function playWrong() {
    tone(220, 0.16, 'sawtooth', 0.1);
  }

  function playDone() {
    tone(523.25, 0.1, 'sine', 0.26);
    tone(659.25, 0.1, 'sine', 0.26, 0.1);
    tone(783.99, 0.1, 'sine', 0.26, 0.2);
    tone(1046.5, 0.22, 'sine', 0.26, 0.3);
  }

  var Sound = {
    ensureCtx: ensureCtx,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    playStone: playStone,
    playCapture: playCapture,
    playCorrect: playCorrect,
    playWrong: playWrong,
    playDone: playDone
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Sound;
  else global.GobanSound = Sound;
})(typeof window !== 'undefined' ? window : this);
