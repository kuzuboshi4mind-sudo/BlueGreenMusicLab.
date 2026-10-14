/* Web Audio によるお手本音（ピアノ風／持続音）と小さなクリック音 */
window.VT = window.VT || {};
(function (VT) {
  let ctx = null;
  let master = null;
  let voices = [];

  function get() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 倍音を重ねた音色。sustain=true で減衰しない持続音（音取り用）
  function tone(midi, start, dur, opts) {
    const c = get();
    const o = Object.assign({ vol: 0.5, sustain: false }, opts);
    const f = VT.music.freq(midi);
    const t0 = start == null ? c.currentTime + 0.03 : start;
    const g = c.createGain();
    g.connect(master);
    const partials = o.sustain ? [[1, 1], [2, 0.35], [3, 0.15], [4, 0.06]] : [[1, 1], [2, 0.5], [3, 0.22], [4, 0.1], [5, 0.05]];
    const oscs = partials.map(([k, a]) => {
      const osc = c.createOscillator();
      const pg = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = f * k;
      pg.gain.value = a / k;
      osc.connect(pg);
      pg.connect(g);
      osc.start(t0);
      osc.stop(t0 + dur + 0.4);
      return osc;
    });
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(o.vol, t0 + 0.015);
    if (o.sustain) {
      g.gain.exponentialRampToValueAtTime(o.vol * 0.7, t0 + 0.3);
      g.gain.setValueAtTime(o.vol * 0.7, t0 + Math.max(0.3, dur - 0.05));
    } else {
      g.gain.exponentialRampToValueAtTime(o.vol * 0.35, t0 + 0.35);
      g.gain.exponentialRampToValueAtTime(o.vol * 0.12, t0 + Math.max(0.4, dur));
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.25);
    const v = { oscs, g, end: t0 + dur + 0.4 };
    voices.push(v);
    return t0;
  }

  function click(at, accent) {
    const c = get();
    const t0 = at == null ? c.currentTime + 0.02 : at;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.frequency.value = accent ? 1760 : 1320;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(accent ? 0.25 : 0.12, t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + 0.06);
    voices.push({ oscs: [osc], g, end: t0 + 0.06 });
  }

  VT.audio = {
    ctx: get,
    tone,
    click,
    // 連続した音 [{midi, beats}] を再生し、終了までの秒数を返す
    sequence(notes, beatSec, opts) {
      const c = get();
      let t = c.currentTime + 0.08;
      const start = t;
      notes.forEach((n) => {
        const d = (n.beats || 1) * beatSec;
        if (n.midi != null) [].concat(n.midi).forEach((m) => tone(m, t, d * 0.95, opts));
        t += d;
      });
      return t - start + 0.08;
    },
    // 音声コンテキストの時刻を performance.now() 基準(秒)へ変換
    toPerf(ctxTime) { return performance.now() / 1000 + (ctxTime - get().currentTime); },
    stopAll() {
      if (!ctx) return;
      const now = ctx.currentTime;
      voices.forEach((v) => {
        try {
          v.g.gain.cancelScheduledValues(now);
          v.g.gain.setValueAtTime(v.g.gain.value, now);
          v.g.gain.linearRampToValueAtTime(0, now + 0.03);
          v.oscs.forEach((o) => o.stop(now + 0.05));
        } catch (e) {}
      });
      voices = [];
    },
    prune() { if (ctx) voices = voices.filter((v) => v.end > ctx.currentTime); },
  };
})(window.VT);
