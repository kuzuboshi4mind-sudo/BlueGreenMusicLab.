/* 共通 UI 部品：ピッチロール（音高グラフ）とセントメーター */
window.VT = window.VT || {};
(function (VT) {
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  // 横軸=時間、縦軸=音高。お手本の帯と自分の声の線を描く
  function Roll(canvas, lo, hi) {
    const c = canvas.getContext('2d');
    let targets = [], pts = [], span = 6, fixed = null, colors = {};
    let W = 0, H = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      colors = {
        grid: cssVar('--grid'), text: cssVar('--muted'), target: cssVar('--accent'),
        ok: cssVar('--ok'), voice: cssVar('--voice'), now: cssVar('--line'),
      };
    }
    const y = (m) => H - 6 - ((m - lo + 0.5) / (hi - lo + 1)) * (H - 12);
    function x(t, now) {
      if (fixed) return 34 + ((t - fixed[0]) / (fixed[1] - fixed[0])) * (W - 40);
      return 34 + (1 - (now - t) / span) * (W - 40);
    }

    function draw(now) {
      if (!W) resize();
      c.clearRect(0, 0, W, H);
      const rowH = (H - 12) / (hi - lo + 1);
      c.font = '10px system-ui, sans-serif';
      c.textBaseline = 'middle';
      for (let m = lo; m <= hi; m++) {
        const isC = ((m % 12) + 12) % 12 === 0;
        c.strokeStyle = colors.grid;
        c.globalAlpha = isC ? 0.9 : 0.35;
        c.beginPath(); c.moveTo(34, y(m)); c.lineTo(W, y(m)); c.stroke();
        c.globalAlpha = 1;
        if (isC || m === lo || m === hi || rowH > 13) {
          c.fillStyle = colors.text;
          c.fillText(VT.music.name(m), 2, y(m));
        }
      }
      targets.forEach((tg) => {
        const x0 = x(tg.t0, now), x1 = x(tg.t1, now);
        if (x1 < 34 || x0 > W) return;
        c.fillStyle = tg.state === 'ok' ? colors.ok : colors.target;
        c.globalAlpha = tg.state === 'miss' ? 0.18 : tg.active ? 0.55 : 0.32;
        const h = Math.max(6, rowH * 0.8);
        c.fillRect(Math.max(34, x0), y(tg.midi) - h / 2, Math.min(W, x1) - Math.max(34, x0), h);
        c.globalAlpha = 1;
      });
      c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
      let prev = null;
      pts.forEach((p) => {
        if (p.midi == null || p.midi < lo - 1 || p.midi > hi + 1) { prev = null; return; }
        const px = x(p.t, now);
        if (px < 34) { prev = null; return; }
        if (prev && p.t - prev.t < 0.15) {
          c.strokeStyle = p.ok ? colors.ok : colors.voice;
          c.beginPath(); c.moveTo(prev.x, prev.y); c.lineTo(px, y(p.midi)); c.stroke();
        }
        prev = { x: px, y: y(p.midi), t: p.t };
      });
      c.lineWidth = 1;
      if (fixed && now >= fixed[0] && now <= fixed[1]) {
        c.strokeStyle = colors.now;
        c.beginPath(); c.moveTo(x(now, now), 0); c.lineTo(x(now, now), H); c.stroke();
      }
      const cutoff = fixed ? fixed[0] - 1 : now - span - 1;
      if (pts.length > 2000 || (pts.length && pts[0].t < cutoff)) pts = pts.filter((p) => p.t >= cutoff);
    }

    window.addEventListener('resize', resize);
    return {
      draw,
      setRange(a, b) { lo = a; hi = b; },
      setTargets(t) { targets = t; },
      push(t, midi, ok) { pts.push({ t, midi, ok }); },
      clear() { pts = []; },
      scroll(sec) { fixed = null; span = sec; },
      fix(t0, t1) { fixed = [t0, t1]; },
      destroy() { window.removeEventListener('resize', resize); },
    };
  }

  // ±50セントのチューナーメーター
  function meterHTML(tol) {
    const w = Math.min(100, tol);
    return `<div class="meter" aria-hidden="true">
      <div class="meter-zone" style="left:${50 - w}%;width:${w * 2}%"></div>
      <div class="meter-ticks"><span>-50</span><span>-25</span><span>0</span><span>+25</span><span>+50</span></div>
      <div class="meter-needle"></div>
    </div>`;
  }
  function setMeter(root, cents, ok) {
    const n = root.querySelector('.meter-needle');
    if (cents == null) { n.style.opacity = 0.25; n.style.left = '50%'; n.classList.remove('ok'); return; }
    n.style.opacity = 1;
    n.style.left = 50 + Math.max(-50, Math.min(50, cents)) + '%';
    n.classList.toggle('ok', !!ok);
  }

  function centsText(c) {
    if (c == null) return '';
    const r = Math.round(c);
    if (Math.abs(r) <= 5) return 'ぴったり';
    return r < 0 ? `${-r}セント低い ♭` : `${r}セント高い ♯`;
  }

  VT.ui = { Roll, meterHTML, setMeter, centsText };
})(window.VT);
