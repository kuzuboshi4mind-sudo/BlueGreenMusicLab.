/* 音感トレーニング：メニューと5つの練習 */
window.VT = window.VT || {};
(function (VT) {
  const H = VT.h, M = VT.music, U = VT.ui;
  const BACK = { href: '#/ear', label: '音感' };
  const now = () => performance.now() / 1000;
  const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

  const EXERCISES = [
    { id: 'discrim', icon: '↕️', title: '高低判定', sub: '2つの音、どちらが高い？ 微妙な差を聴き分ける', mic: false, fmt: (r) => `ベスト ${r.best}セント` },
    { id: 'interval', icon: '🎼', title: '音程当て', sub: '2つの音の幅（音程）を聴き分ける', mic: false, fmt: (r) => `ベスト ${r.best}点` },
    { id: 'match', icon: '🎯', title: 'ピッチマッチ', sub: '聴いた音を同じ高さで発声する', mic: true, fmt: (r) => `ベスト ${r.best}点` },
    { id: 'scale', icon: '🎹', title: 'スケール発声', sub: '半音ずつ移調しながら音階を歌う', mic: true, fmt: (r) => `ベスト ${r.best}点` },
    { id: 'tuner', icon: '🎙️', title: 'チューナー / 音域チェック', sub: '自分の声の高さを見る・音域を測る', mic: true },
  ];

  async function startMic(el, onFrame) {
    const msg = el.querySelector('.micmsg');
    try {
      await VT.pitch.start(onFrame);
      if (msg) msg.hidden = true;
      return true;
    } catch (e) {
      if (msg) {
        msg.hidden = false;
        msg.textContent = e && e.name === 'NotAllowedError'
          ? 'マイクの使用が許可されていません。ブラウザの設定でマイクを許可してから、もう一度お試しください。'
          : 'マイクを開始できませんでした（' + (e && e.message ? e.message : e) + '）。HTTPS のページで開いているか確認してください。';
      }
      return false;
    }
  }

  function coachNotes(s) {
    return s.notes.length ? `<div class="note">${s.notes.map((n) => `<p>${n}</p>`).join('')}</div>` : '';
  }

  /* ---------- 音感メニュー ---------- */
  VT.views.ear = function (el) {
    const s = VT.settings();
    const p = VT.profile.get();
    const recommend = !s.personal ? null
      : p.level === 'beginner' ? ['discrim', 'interval', 'match']
      : p.level === 'intermediate' ? ['interval', 'match', 'scale']
      : ['discrim', 'match', 'scale'];
    el.innerHTML = `
      ${H.header('音感トレーニング', { href: '#/', label: 'ホーム' })}
      <section class="card">
        <p class="pline">${s.summary}</p>
        <p class="hint">「聴く力（耳）」→「再現する力（声）」の順に鍛えるのが上達の近道です。上から順番に取り組むのがおすすめです。</p>
        ${recommend ? `<p class="reco">今日のおすすめ：${recommend.map((id) => EXERCISES.find((e) => e.id === id).title).join(' → ')}</p>` : ''}
      </section>
      ${coachNotes(s)}
      <nav class="list">
        ${EXERCISES.map((e) => {
          const r = VT.records.get(e.id);
          return `<a class="item" href="#/ear/${e.id}">
            <span class="ticon">${e.icon}</span>
            <span class="itext"><b>${e.title}</b><small>${e.sub}</small>
              <span class="meta">${e.mic ? '<span class="chip">🎙 マイク使用</span>' : '<span class="chip">🎧 聴くだけ</span>'}${r && e.fmt ? `<span class="chip best">${e.fmt(r)}</span>` : ''}</span>
            </span><span class="chev">›</span></a>`;
        }).join('')}
      </nav>`;
  };

  /* ---------- 高低判定（適応型：正解が続くと差が小さくなる） ---------- */
  VT.views['ear.discrim'] = function (el) {
    const s = VT.settings();
    const [lo, hi] = s.range;
    const MAX_TRIALS = 24;
    let alive = true, diff = s.discStart, trial = 0, streak = 0, lastDir = null, reversals = [], cur = null, busy = false;
    el.innerHTML = `
      ${H.header('高低判定', BACK)}
      <section class="card stage">
        <div class="row-between"><span class="label">第 <b id="qn">0</b> / 最大${MAX_TRIALS}回</span><span class="label">音の差 <b id="diff">${diff}</b>セント</span></div>
        <p class="big-q" id="q">2つの音を聴いて、<br>高いほうを選んでください</p>
        <div class="row">
          <button class="btn choice" data-a="0" disabled>1つ目が高い</button>
          <button class="btn choice" data-a="1" disabled>2つ目が高い</button>
        </div>
        <div class="row"><button class="btn primary" id="start">スタート</button><button class="btn ghost" id="replay" disabled>🔊 もう一度聴く</button></div>
        <p class="fb" id="fb"></p>
        <div id="result"></div>
      </section>
      ${H.tips('トレーナーからのポイント', [
        '100セント＝半音1つ分です。正解が2回続くと差が小さく、間違えると大きくなり、あなたの「聴き分けの限界」を測ります。',
        '最初の音を頭の中で鳴らし続けたまま2つ目を聴くと、差がわかりやすくなります。',
        '一般の方は 20〜50セント程度、訓練した歌手は 10セント前後を聴き分けられると言われます。',
        '音程が合わない原因の多くは「声」ではなく「耳」にあります。歌う前のウォームアップとして毎日1セットがおすすめです。',
      ])}`;
    const $ = (q) => el.querySelector(q);
    const choices = el.querySelectorAll('.choice');

    function play() {
      if (!cur) return;
      const d = diff / 100;
      const a = cur.base - d / 2 + (cur.high === 0 ? d : 0);
      const b = cur.base - d / 2 + (cur.high === 1 ? d : 0);
      const c = VT.audio.ctx();
      const t = c.currentTime + 0.05;
      VT.audio.tone(a, t, 0.6, { sustain: true });
      VT.audio.tone(b, t + 0.9, 0.6, { sustain: true });
    }
    function next() {
      if (!alive) return;
      if (trial >= MAX_TRIALS || reversals.length >= 8) return done();
      trial++;
      $('#qn').textContent = trial;
      $('#diff').textContent = Math.round(diff);
      $('#fb').textContent = '';
      cur = { base: H.rand(Math.max(lo, 45), Math.min(hi, 76)), high: Math.random() < 0.5 ? 0 : 1 };
      play();
      busy = false;
      choices.forEach((b) => (b.disabled = false));
    }
    function move(dir) {
      if (lastDir && dir !== lastDir) reversals.push(diff);
      lastDir = dir;
      diff = dir === 'down' ? Math.max(3, diff * 0.7) : Math.min(400, diff * 1.5);
    }
    function answer(a) {
      if (busy || !cur) return;
      busy = true;
      choices.forEach((b) => (b.disabled = true));
      const ok = a === cur.high;
      $('#fb').innerHTML = ok ? '<span class="good">⭕ 正解</span>' : `<span class="bad">❌ ${cur.high + 1}つ目が高い音でした</span>`;
      if (ok) { streak++; if (streak >= 2) { streak = 0; move('down'); } }
      else { streak = 0; move('up'); }
      setTimeout(next, 900);
    }
    function done() {
      cur = null;
      const last = reversals.slice(-6);
      const th = Math.round(last.length ? mean(last) : diff);
      const rec = VT.records.add('discrim', th, true);
      const grade = th <= 10 ? 'プロ級の耳です！' : th <= 20 ? 'とても良い耳です。' : th <= 50 ? '良好です。さらに細かい差を目指しましょう。' : th <= 100 ? '半音の違いは聴き分けられています。毎日続けて精度を上げましょう。' : 'まずは半音（100セント）の差をはっきり聴き分けることを目標にしましょう。';
      $('#result').innerHTML = `<div class="result"><div class="score">${th}<small>セント</small></div>
        <p>あなたが聴き分けられる音の差の目安です。${grade}</p>
        <p class="hint">ベスト ${rec.best}セント・${rec.count}回目</p>
        <button class="btn primary" id="again">もう一度</button></div>`;
      $('#again').onclick = () => VT.route();
      $('#replay').disabled = true;
    }
    choices.forEach((b) => b.addEventListener('click', () => answer(+b.dataset.a)));
    $('#start').onclick = () => { $('#start').hidden = true; $('#replay').disabled = false; next(); };
    $('#replay').onclick = play;
    return { unmount() { alive = false; } };
  };

  /* ---------- 音程当て ---------- */
  VT.views['ear.interval'] = function (el) {
    const s = VT.settings();
    const [lo, hi] = s.range;
    const N = s.setSize;
    const DIR = { up: '上行', down: '下行', harmonic: '同時' };
    let alive = true, q = 0, correct = 0, cur = null, answered = false;
    el.innerHTML = `
      ${H.header('音程当て', BACK)}
      <section class="card stage">
        <div class="row-between"><span class="label">第 <b id="qn">0</b> / ${N} 問</span><span class="label">正解 <b id="sc">0</b></span></div>
        <p class="big-q" id="q">2つの音の幅（音程）は？</p>
        <div class="choices" id="opts">
          ${s.intervals.map((i) => `<button class="btn choice" data-s="${i}" disabled>${M.interval(i).name}</button>`).join('')}
        </div>
        <div class="row"><button class="btn primary" id="start">スタート</button><button class="btn ghost" id="replay" disabled>🔊 もう一度聴く</button><button class="btn ghost" id="next" hidden>次へ ›</button></div>
        <p class="fb" id="fb"></p>
        <div id="result"></div>
      </section>
      <details class="tips"><summary>📚 音程の覚え方（連想曲）</summary>
        <ul>${s.intervals.map((i) => `<li><b>${M.interval(i).name}</b>（半音${i}個）… ${M.interval(i).song} <button class="btn tiny ghost" data-demo="${i}">♪</button></li>`).join('')}</ul>
      </details>
      ${H.tips('トレーナーからのポイント', [
        '音程は「よく知っている曲の出だし」と結びつけて覚えるのがプロの定番の方法です。',
        '迷ったら、低いほうの音から心の中で「ドレミ…」と数えて、上の音に届くまで何音あるか確かめましょう。',
        '長3度は明るく、短3度は少し寂しい響き。完全5度・8度は空間が広がるような響きが特徴です。',
        '聴き分けられるようになった音程は、実際に声に出して歌ってみると定着が早くなります。',
      ])}`;
    const $ = (x) => el.querySelector(x);
    const opts = el.querySelectorAll('#opts .choice');
    const beat = s.personal && VT.profile.get().age >= 60 ? 0.9 : 0.75;

    function play(c) {
      c = c || cur;
      if (!c) return;
      const top = c.root + c.semi;
      if (c.dir === 'harmonic') VT.audio.sequence([{ midi: [c.root, top], beats: 2 }], beat);
      else if (c.dir === 'down') VT.audio.sequence([{ midi: top }, { midi: c.root, beats: 1.5 }], beat);
      else VT.audio.sequence([{ midi: c.root }, { midi: top, beats: 1.5 }], beat);
    }
    function next() {
      if (!alive) return;
      if (q >= N) return done();
      q++;
      $('#qn').textContent = q;
      $('#fb').textContent = '';
      $('#next').hidden = true;
      const semi = s.intervals[H.rand(0, s.intervals.length - 1)];
      const dir = s.directions[H.rand(0, s.directions.length - 1)];
      const root = H.rand(lo, Math.max(lo, hi - semi));
      cur = { semi, dir, root };
      $('#q').textContent = `2つの音の幅（音程）は？（${DIR[dir]}）`;
      opts.forEach((b) => { b.disabled = false; b.classList.remove('right', 'wrong'); });
      answered = false;
      play();
    }
    function answer(semi, btn) {
      if (answered || !cur) return;
      answered = true;
      const ok = semi === cur.semi;
      if (ok) correct++;
      $('#sc').textContent = correct;
      opts.forEach((b) => { b.disabled = true; if (+b.dataset.s === cur.semi) b.classList.add('right'); });
      if (!ok) btn.classList.add('wrong');
      const iv = M.interval(cur.semi);
      $('#fb').innerHTML = (ok ? '<span class="good">⭕ 正解！</span>' : `<span class="bad">❌ 正解は ${iv.name}</span>`)
        + `<br><small>${M.name(cur.root)} と ${M.name(cur.root + cur.semi)}／${iv.song}</small>`;
      $('#next').hidden = false;
    }
    function done() {
      cur = null;
      const score = Math.round((correct / N) * 100);
      const rec = VT.records.add('interval', score);
      $('#result').innerHTML = `<div class="result"><div class="score">${score}<small>点</small></div>
        <p>${N}問中 ${correct}問正解。${score >= 90 ? 'すばらしい！レベルを上げてもよいでしょう。' : score >= 60 ? 'いい調子です。間違えた音程は連想曲で復習しましょう。' : 'まずは連想曲を聴き比べて、響きの違いに慣れましょう。'}</p>
        <p class="hint">ベスト ${rec.best}点・${rec.count}回目</p>
        <button class="btn primary" id="again">もう一度</button></div>`;
      $('#again').onclick = () => VT.route();
      $('#replay').disabled = true;
      $('#next').hidden = true;
    }
    opts.forEach((b) => b.addEventListener('click', () => answer(+b.dataset.s, b)));
    $('#start').onclick = () => { $('#start').hidden = true; $('#replay').disabled = false; next(); };
    $('#replay').onclick = () => play();
    $('#next').onclick = next;
    el.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => {
      const semi = +b.dataset.demo;
      play({ root: Math.max(lo, Math.min(hi - semi, 60)), semi, dir: 'up' });
    }));
    return { unmount() { alive = false; } };
  };

  /* ---------- ピッチマッチ ---------- */
  VT.views['ear.match'] = function (el) {
    const s = VT.settings();
    const [lo, hi] = s.range;
    const N = s.setSize;
    let alive = true, phase = 'idle', target = null, q = 0, results = [], holdAcc = 0, singStart = 0, diffs = [];
    el.innerHTML = `
      ${H.header('ピッチマッチ', BACK)}
      <section class="card stage">
        <div class="row-between"><span class="label">第 <b id="qn">0</b> / ${N} 問</span><span class="label">成功 <b id="sc">0</b></span></div>
        <div class="target"><div class="tnote" id="tnote">♪</div><div class="tsub" id="tsub">スタートを押すとお手本の音が鳴ります</div></div>
        ${U.meterHTML(s.tol)}
        <div class="sung"><span id="sung">—</span> <small id="cents"></small></div>
        <div class="progress" title="キープ"><div id="hold"></div></div>
        <canvas class="roll" id="roll"></canvas>
        <p class="micmsg error" hidden></p>
        <div class="row"><button class="btn primary" id="start">🎙 スタート</button><button class="btn ghost" id="replay" disabled>🔊 もう一度聴く</button><button class="btn ghost" id="skip" disabled>スキップ</button></div>
        <div id="result"></div>
      </section>
      ${coachNotes(s)}
      ${H.tips('トレーナーからのポイント', [
        `お手本の音が鳴り終わってから「あー」または「うー」でまっすぐ伸ばします。緑の範囲（±${s.tol}セント）に${s.hold.toFixed(1)}秒キープできたら成功です。`,
        '声を出す前に、聴いた音を頭の中で鳴らしてから出す（内的聴覚）。いきなり声で探さないのがコツです。',
        '音を下からずり上げず、最初から目標の高さに「置く」ように出しましょう。',
        '大きな声は不要です。小さめの声のほうが音程のコントロールが正確になります。',
        s.octaveFree ? 'ノーマルメニューでは、1オクターブ違う高さで歌っても正解になります。' : 'あなたの音域の中から出題しています。苦しい音が出たら設定の音域を見直しましょう。',
      ])}`;
    const $ = (x) => el.querySelector(x);
    const roll = U.Roll($('#roll'), lo - 3, hi + 3);
    roll.scroll(5);

    function nextTarget() {
      const cand = [];
      for (let m = lo; m <= hi; m++) if (m !== target && (target == null || Math.abs(m - target) <= s.step)) cand.push(m);
      return cand[H.rand(0, cand.length - 1)];
    }
    async function playRef() {
      phase = 'ref';
      $('#tsub').textContent = 'お手本をよく聴いて…';
      $('#replay').disabled = true;
      VT.audio.tone(target, null, 1.3, { sustain: true });
      await H.wait(1550);
      if (!alive || phase !== 'ref') return;
      phase = 'sing';
      singStart = now();
      holdAcc = 0;
      $('#replay').disabled = false;
      $('#tsub').textContent = '同じ高さで「あー」と伸ばしてください';
    }
    async function ask() {
      if (!alive) return;
      if (q >= N) return done();
      q++;
      $('#qn').textContent = q;
      target = nextTarget();
      diffs = [];
      $('#tnote').innerHTML = `${M.name(target)} <span class="jp">${M.jp(target)}</span>`;
      $('#hold').style.width = '0';
      roll.setTargets([{ t0: -1e9, t1: 1e9, midi: target, active: true }]);
      await playRef();
    }
    function judge(ok) {
      phase = 'fb';
      results.push({ target, ok, bias: median(diffs) });
      $('#sc').textContent = results.filter((r) => r.ok).length;
      $('#tsub').innerHTML = ok ? '<span class="good">⭕ ナイス！ 音程が合いました</span>' : '<span class="bad">時間切れ。次の音へ進みます</span>';
      setTimeout(ask, 1300);
    }
    function onFrame(f) {
      roll.draw(f.t);
      if (phase !== 'sing') { roll.push(f.t, null); if (phase !== 'ref') U.setMeter(el, null); return; }
      if (f.t - singStart > s.timeout) return judge(false);
      if (f.midi == null) {
        U.setMeter(el, null);
        $('#sung').textContent = '—'; $('#cents').textContent = '';
        holdAcc = Math.max(0, holdAcc - f.dt);
        roll.push(f.t, null);
      } else {
        let cents = (f.midi - target) * 100;
        if (s.octaveFree) cents = M.foldCents(cents);
        const ok = Math.abs(cents) <= s.tol;
        roll.push(f.t, s.octaveFree ? target + cents / 100 : f.midi, ok);
        U.setMeter(el, cents, ok);
        $('#sung').textContent = M.name(Math.round(f.midi));
        $('#cents').textContent = Math.abs(cents) < 100 ? U.centsText(cents) : (cents < 0 ? 'もっと高く ↑' : 'もっと低く ↓');
        if (Math.abs(cents) < 100) diffs.push(cents);
        holdAcc = ok ? holdAcc + f.dt : Math.max(0, holdAcc - f.dt * 1.5);
      }
      $('#hold').style.width = Math.min(100, (holdAcc / s.hold) * 100) + '%';
      if (holdAcc >= s.hold) judge(true);
    }
    function done() {
      phase = 'done';
      VT.pitch.stop();
      const ok = results.filter((r) => r.ok).length;
      const score = Math.round((ok / N) * 100);
      const biases = results.map((r) => r.bias).filter((b) => b != null);
      const bias = biases.length ? Math.round(mean(biases)) : 0;
      const rec = VT.records.add('match', score);
      let advice;
      if (bias < -12) advice = `全体的に<b>低め（フラット）</b>の傾向です（平均 ${-bias}セント低い）。目標の音を少し上から狙うイメージで。口の奥を縦に開け、眉を軽く上げると響きが高くなりやすいです。`;
      else if (bias > 12) advice = `全体的に<b>高め（シャープ）</b>の傾向です（平均 ${bias}セント高い）。首やあごの力み、息の押しすぎが原因になりやすいので、肩の力を抜き息の量を少し減らしましょう。`;
      else advice = '音程の中心をしっかりとらえられています。次は判定時間を長くキープできるよう、息の流れを一定に保ちましょう。';
      $('#result').innerHTML = `<div class="result"><div class="score">${score}<small>点</small></div>
        <p>${N}問中 ${ok}問成功。</p><p>${advice}</p>
        <p class="hint">ベスト ${rec.best}点・${rec.count}回目</p>
        <button class="btn primary" id="again">もう一度</button></div>`;
      $('#again').onclick = () => VT.route();
      $('#tsub').textContent = 'おつかれさまでした';
      $('#replay').disabled = true; $('#skip').disabled = true;
    }
    $('#start').onclick = async () => {
      VT.audio.ctx();
      if (!(await startMic(el, onFrame))) return;
      $('#start').hidden = true;
      $('#skip').disabled = false;
      ask();
    };
    $('#replay').onclick = () => { if (phase === 'sing') playRef(); };
    $('#skip').onclick = () => { if (phase === 'sing' || phase === 'ref') { VT.audio.stopAll(); judge(false); } };
    return { unmount() { alive = false; roll.destroy(); } };
  };

  /* ---------- スケール発声 ---------- */
  const PATTERNS = {
    five: { name: '5トーン（ドレミファソファミレド）', offs: [0, 2, 4, 5, 7, 5, 4, 2, 0] },
    triad: { name: 'アルペジオ（ドミソドソミド）', offs: [0, 4, 7, 12, 7, 4, 0] },
    third: { name: '3度跳躍（ドミレファミソファレド）', offs: [0, 4, 2, 5, 4, 7, 5, 2, 0] },
    three: { name: '3トーン（ドレミレド）', offs: [0, 2, 4, 2, 0] },
    octave: { name: '1オクターブ音階（ド〜ド〜ド）', offs: [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0] },
  };
  VT.views['ear.scale'] = function (el) {
    const s = VT.settings();
    const saved = VT.store.get('scaleOpts', { pattern: 'five', demo: true });
    let alive = true, phase = 'idle', targets = [], samples = [], stats = [], running = false;
    el.innerHTML = `
      ${H.header('スケール発声', BACK)}
      <section class="card stage">
        <label class="field">パターン<select id="pat">${Object.entries(PATTERNS).map(([k, v]) => `<option value="${k}" ${saved.pattern === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></label>
        <label class="check"><input type="checkbox" id="demo" ${saved.demo ? 'checked' : ''}> 毎回お手本を流す（オフ：最初の音だけ）</label>
        <div class="row-between"><span class="label">キー <b id="key">—</b></span><span class="label" id="prog"></span></div>
        <div class="tsub center" id="tsub">♪ のあとに、お手本と同じメロディを「マ」「ナ」などで歌います</div>
        <canvas class="roll tall" id="roll"></canvas>
        <p class="micmsg error" hidden></p>
        <div class="row"><button class="btn primary" id="start">🎙 スタート</button><button class="btn ghost" id="stop" hidden>■ 終了</button></div>
        <div id="result"></div>
      </section>
      ${coachNotes(s)}
      ${H.tips('トレーナーからのポイント', [
        '半音ずつキーを上げ、音域の上端まで行ったら下りてきます。ピアノを使ったボイトレの基本の流れです。',
        '母音は「マ」「ナ」「ヌ」がおすすめ。慣れたらリップロール（唇をブルブル）で歌うと喉の力みが取れます。',
        '高くなるほど声を「張り上げる」のではなく、息のスピードを保ったまま声を軽くしていきましょう。',
        '1つひとつの音をはっきり区切るより、音と音をなめらかにつなぐ（レガート）意識で。',
        `判定は1音ごとに ±${Math.min(45, s.tol + 10)}セント以内かどうかです（動きのある練習なので少し広めです）。`,
        '苦しくなったら無理せず「終了」して休みましょう。声の練習は量より質です。',
      ])}`;
    const $ = (x) => el.querySelector(x);
    const roll = U.Roll($('#roll'), 48, 72);
    const tol = Math.min(45, s.tol + 10);
    const beat = 60 / s.tempo;

    function keysFor(pat) {
      const top = Math.max(...pat.offs);
      const [k0, kMax] = s.scaleKeys;
      const last = s.personal ? kMax - top : kMax;
      if (last < k0) return null;
      const up = [];
      for (let k = k0; k <= last; k++) up.push(k);
      return up.concat(up.slice(0, -1).reverse());
    }
    function layout(key, offs, t0) {
      let t = t0;
      return offs.map((o, i) => {
        const len = beat * (i === offs.length - 1 ? 2 : 1);
        const tg = { midi: key + o, t0: t, t1: t + len };
        t += len;
        return tg;
      });
    }
    async function rep(key, pat, idx, total) {
      $('#key').textContent = `${M.name(key)}（${M.jp(key)}）`;
      $('#prog').textContent = `${idx + 1} / ${total}`;
      // お手本：主和音 → メロディ
      phase = 'demo';
      $('#tsub').textContent = '🔊 お手本を聴いて…';
      const demoNotes = [{ midi: [key, key + 4, key + 7], beats: 1.5 }]
        .concat(($('#demo').checked ? pat.offs : [0]).map((o, i, a) => ({ midi: key + o, beats: i === a.length - 1 ? 2 : 1 })));
      const t0 = now() + 0.08 + beat * 1.5;
      const demoTargets = layout(key, $('#demo').checked ? pat.offs : [0], t0).map((tg) => Object.assign(tg, { state: 'demo' }));
      roll.setTargets(demoTargets);
      roll.fix(now(), demoTargets[demoTargets.length - 1].t1 + 0.2);
      roll.clear();
      const dur = VT.audio.sequence(demoNotes, beat);
      await H.wait(dur * 1000);
      if (!alive || !running) return false;
      // あなたの番：1拍のカウントのあと歌う
      const c = VT.audio.ctx();
      const singT0 = now() + beat;
      targets = layout(key, pat.offs, singT0);
      samples = targets.map(() => []);
      const end = targets[targets.length - 1].t1;
      VT.audio.click(c.currentTime, true);
      for (let i = 0; i < pat.offs.length; i++) VT.audio.click(c.currentTime + beat * (i + 1));
      roll.setTargets(targets);
      roll.fix(singT0 - beat, end + 0.3);
      roll.clear();
      phase = 'sing';
      $('#tsub').textContent = '🎤 あなたの番！';
      await H.wait((end - now() + 0.35) * 1000);
      if (!alive || !running) return false;
      phase = 'grade';
      let ok = 0;
      targets.forEach((tg, i) => {
        const md = median(samples[i]);
        const hit = md != null && Math.abs(md) <= tol;
        tg.state = hit ? 'ok' : 'miss';
        tg.active = false;
        if (hit) ok++;
        stats.push({ key, i, top: pat.offs[i] === Math.max(...pat.offs), hit, bias: md });
      });
      $('#tsub').innerHTML = `${ok} / ${targets.length} 音 正確 ${ok === targets.length ? '<span class="good">パーフェクト！</span>' : ''}`;
      roll.draw(now());
      await H.wait(700);
      return alive && running;
    }
    function onFrame(f) {
      if (phase === 'sing') {
        const i = targets.findIndex((tg) => f.t >= tg.t0 && f.t < tg.t1);
        targets.forEach((tg, j) => (tg.active = j === i));
        const ref = targets[i >= 0 ? i : f.t < targets[0].t0 ? 0 : targets.length - 1];
        if (f.midi != null) {
          let cents = (f.midi - ref.midi) * 100;
          if (s.octaveFree) cents = M.foldCents(cents);
          const ok = Math.abs(cents) <= tol;
          if (i >= 0) {
            const tg = targets[i];
            const len = tg.t1 - tg.t0;
            if (f.t > tg.t0 + len * 0.3 && f.t < tg.t1 - len * 0.1) samples[i].push(cents);
          }
          roll.push(f.t, s.octaveFree ? ref.midi + cents / 100 : f.midi, ok && i >= 0);
        } else roll.push(f.t, null);
      }
      if (phase !== 'grade') roll.draw(f.t);
    }
    function done() {
      running = false;
      phase = 'done';
      VT.pitch.stop();
      VT.audio.stopAll();
      $('#start').hidden = false; $('#stop').hidden = true;
      $('#pat').disabled = false;
      if (!stats.length) { $('#tsub').textContent = '♪ スタートで練習を始めます'; return; }
      const acc = (arr) => (arr.length ? arr.filter((x) => x.hit).length / arr.length : 1);
      const score = Math.round(acc(stats) * 100);
      const rec = VT.records.add('scale', score);
      const keys = stats.map((x) => x.key);
      const midKey = (Math.min(...keys) + Math.max(...keys)) / 2;
      const highAcc = acc(stats.filter((x) => x.key > midKey)), lowAcc = acc(stats.filter((x) => x.key <= midKey));
      const topAcc = acc(stats.filter((x) => x.top)), otherAcc = acc(stats.filter((x) => !x.top));
      const bs = stats.map((x) => x.bias).filter((b) => b != null);
      const bias = bs.length ? mean(bs) : 0;
      const adv = [];
      if (topAcc < otherAcc - 0.2) adv.push('パターンの<b>いちばん高い音</b>で外れやすい傾向です。頂点の音の手前から息のスピードを上げ、頂点は「上から軽く触れる」イメージで。');
      if (highAcc < lowAcc - 0.2) adv.push('<b>キーが高くなるほど</b>精度が下がっています。高音域では声量を落とし、あごや舌の力を抜いて歌いましょう。');
      if (bias < -15) adv.push('全体的に低めに外れる傾向です。お手本をよく聴き、音を下からずり上げないようにしましょう。');
      else if (bias > 15) adv.push('全体的に高めに外れる傾向です。力みすぎていないか、肩や首をチェックしましょう。');
      if (!adv.length) adv.push(score >= 80 ? '安定した音程です。テンポの速いパターンや1オクターブ音階にも挑戦しましょう。' : '1音1音のねらいを定めて、ゆっくり確実に。3トーンから始めるのもおすすめです。');
      $('#tsub').textContent = 'おつかれさまでした';
      $('#result').innerHTML = `<div class="result"><div class="score">${score}<small>点</small></div>
        <p>${stats.length}音中 ${stats.filter((x) => x.hit).length}音が正確でした。</p>${adv.map((a) => `<p>${a}</p>`).join('')}
        <p class="hint">ベスト ${rec.best}点・${rec.count}回目</p></div>`;
    }
    function remember() { VT.store.set('scaleOpts', { pattern: $('#pat').value, demo: $('#demo').checked }); }
    $('#pat').onchange = remember;
    $('#demo').onchange = remember;
    $('#start').onclick = async () => {
      const pat = PATTERNS[$('#pat').value];
      const keys = keysFor(pat);
      if (!keys) { $('#tsub').textContent = 'このパターンは設定した音域に収まりません。別のパターンを選んでください。'; return; }
      VT.audio.ctx();
      if (!(await startMic(el, onFrame))) return;
      const top = Math.max(...pat.offs);
      roll.setRange(Math.min(...keys) - 2, Math.max(...keys) + top + 2);
      $('#result').innerHTML = '';
      $('#start').hidden = true; $('#stop').hidden = false; $('#pat').disabled = true;
      stats = []; running = true;
      for (let i = 0; i < keys.length; i++) {
        if (!(await rep(keys[i], pat, i, keys.length))) break;
      }
      if (alive) done();
    };
    $('#stop').onclick = () => { running = false; done(); };
    return { unmount() { alive = false; running = false; roll.destroy(); } };
  };

  /* ---------- チューナー / 音域チェック ---------- */
  VT.views['ear.tuner'] = function (el) {
    const p = VT.profile.get();
    const lo = p ? p.low - 5 : 40, hi = p ? p.high + 5 : 84;
    let found = { low: null, high: null }, cand = null, candT = 0;
    el.innerHTML = `
      ${H.header('チューナー / 音域チェック', BACK)}
      <section class="card stage">
        <div class="target"><div class="tnote" id="note">—</div><div class="tsub" id="kar">声を出すと音名が表示されます</div></div>
        ${U.meterHTML(10)}
        <div class="sung"><small id="cents"></small></div>
        <canvas class="roll tall" id="roll"></canvas>
        <p class="micmsg error" hidden></p>
        <div class="row"><button class="btn primary" id="start">🎙 マイク開始</button><button class="btn ghost" id="stop" hidden>■ 停止</button></div>
      </section>
      <section class="card">
        <h3>音域チェック</h3>
        <p class="hint">「あー」で低い音からサイレンのようにゆっくり上がり、最高音から下りてきます。0.4秒以上安定して出せた音だけを記録します。</p>
        <div class="grid2 range-out">
          <div><span class="label">最低音</span><b id="flo">—</b></div>
          <div><span class="label">最高音</span><b id="fhi">—</b></div>
        </div>
        <div class="row"><button class="btn ghost" id="reset">リセット</button><button class="btn primary" id="save" disabled>この音域を設定に保存</button></div>
        <p class="hint" id="saved"></p>
      </section>
      ${H.tips('トレーナーからのポイント', [
        '音域チェックは、のどが温まってから（他の練習のあと）行うと本来の音域が測れます。',
        '叫ぶような声や、苦しい音は「使える音域」に含めません。楽に響かせられる音で測りましょう。',
        '高音は裏声（ファルセット）でもかまいません。裏声を含めた音域を設定すると練習の幅が広がります。',
        '声帯に負担をかけないよう、最高音・最低音の確認は数回までにしましょう。',
      ])}`;
    const $ = (x) => el.querySelector(x);
    const roll = U.Roll($('#roll'), lo, hi);
    roll.scroll(6);

    function show() {
      $('#flo').textContent = found.low != null ? M.label(found.low) : '—';
      $('#fhi').textContent = found.high != null ? M.label(found.high) : '—';
      $('#save').disabled = !(found.low != null && found.high != null && found.high - found.low >= 5);
    }
    function onFrame(f) {
      roll.draw(f.t);
      if (f.midi == null) { U.setMeter(el, null); $('#cents').textContent = ''; roll.push(f.t, null); cand = null; return; }
      const r = Math.round(f.midi);
      const cents = (f.midi - r) * 100;
      $('#note').innerHTML = `${M.name(r)} <span class="jp">${M.jp(r)}</span>`;
      $('#kar').textContent = `${M.karaoke(r)}・${Math.round(VT.music.freq(f.midi))} Hz`;
      $('#cents').textContent = U.centsText(cents);
      U.setMeter(el, cents, Math.abs(cents) <= 10);
      roll.push(f.t, f.midi, Math.abs(cents) <= 10);
      if (r === cand) candT += f.dt; else { cand = r; candT = 0; }
      if (candT >= 0.4) {
        if (found.low == null || r < found.low) found.low = r;
        if (found.high == null || r > found.high) found.high = r;
        show();
      }
    }
    $('#start').onclick = async () => {
      if (!(await startMic(el, onFrame))) return;
      $('#start').hidden = true; $('#stop').hidden = false;
    };
    $('#stop').onclick = () => { VT.pitch.stop(); $('#start').hidden = false; $('#stop').hidden = true; };
    $('#reset').onclick = () => { found = { low: null, high: null }; show(); $('#saved').textContent = ''; };
    $('#save').onclick = () => {
      const base = VT.profile.get() || { gender: 'other', age: 30, level: 'beginner' };
      VT.profile.save(Object.assign({}, base, { low: found.low, high: found.high }));
      VT.profile.setMode('personal');
      $('#saved').innerHTML = `保存しました：${M.name(found.low)}〜${M.name(found.high)}。<a href="#/setup">設定を確認する</a>`;
    };
    return { unmount() { roll.destroy(); } };
  };
})(window.VT);
