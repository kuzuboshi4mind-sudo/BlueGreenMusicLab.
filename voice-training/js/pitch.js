/* マイク入力の音高検出（YIN アルゴリズム） */
window.VT = window.VT || {};
(function (VT) {
  let stream = null, analyser = null, buf = null, raf = 0, listener = null;
  let history = [];
  let lastT = 0;

  function yin(data, sr) {
    const minTau = Math.floor(sr / 1200);
    const maxTau = Math.min(Math.floor(sr / 65), Math.floor(data.length / 2));
    const w = data.length - maxTau;
    const d = new Float32Array(maxTau + 1);
    for (let tau = 1; tau <= maxTau; tau++) {
      let s = 0;
      for (let i = 0; i < w; i++) {
        const x = data[i] - data[i + tau];
        s += x * x;
      }
      d[tau] = s;
    }
    // 累積平均正規化差分
    let run = 0;
    d[0] = 1;
    for (let tau = 1; tau <= maxTau; tau++) {
      run += d[tau];
      d[tau] = run ? (d[tau] * tau) / run : 1;
    }
    let tau = -1;
    for (let t = minTau; t <= maxTau; t++) {
      if (d[t] < 0.15) {
        while (t + 1 <= maxTau && d[t + 1] < d[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau < 0) return null;
    // 放物線補間
    const a = d[tau - 1], b = d[tau], c = tau + 1 <= maxTau ? d[tau + 1] : b;
    const den = a + c - 2 * b;
    const shift = den ? (a - c) / (2 * den) : 0;
    return { freq: sr / (tau + shift), clarity: 1 - b };
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!analyser) return;
    analyser.getFloatTimeDomainData(buf);
    const now = performance.now() / 1000;
    const dt = lastT ? Math.min(0.1, now - lastT) : 0;
    lastT = now;
    let rms = 0;
    for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / buf.length);
    let midi = null;
    if (rms > 0.008) {
      const r = yin(buf, analyser.context.sampleRate);
      if (r && r.clarity > 0.82 && r.freq > 60 && r.freq < 1400) midi = VT.music.midi(r.freq);
    }
    // 直近5フレームの中央値で外れ値（オクターブ誤検出など）を抑える
    history.push(midi);
    if (history.length > 5) history.shift();
    const valid = history.filter((v) => v != null).sort((x, y) => x - y);
    const smooth = midi != null && valid.length >= 3 ? valid[Math.floor(valid.length / 2)] : null;
    if (listener) listener({ midi: smooth, rms, t: now, dt });
  }

  VT.pitch = {
    get running() { return !!stream; },
    async start(onFrame) {
      listener = onFrame;
      if (stream) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('このブラウザはマイク入力に対応していません。');
      }
      const ctx = VT.audio.ctx();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      buf = new Float32Array(analyser.fftSize);
      src.connect(analyser);
      history = [];
      lastT = 0;
      loop();
    },
    stop() {
      cancelAnimationFrame(raf);
      listener = null;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
      analyser = null;
    },
  };
})(window.VT);
