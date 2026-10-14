/* 画面遷移・ホーム・初期設定 */
window.VT = window.VT || {};
(function (VT) {
  const $app = document.getElementById('app');
  VT.views = VT.views || {};
  let current = null;

  const MENU = [
    { id: 'ear', icon: '🎵', title: '音感', sub: '音程・音高を正確にとらえる', ready: true },
    { id: 'breath', icon: '🌬️', title: '呼吸', sub: '腹式呼吸・ブレスコントロール' },
    { id: 'longtone', icon: '〰️', title: 'ロングトーン', sub: '息と声を安定して保つ' },
    { id: 'artic', icon: '👄', title: '構音', sub: '母音・子音・滑舌' },
    { id: 'stretch', icon: '🧘', title: 'ストレッチ', sub: '首・肩・表情筋をほぐす' },
    { id: 'diagram', icon: '📖', title: '図解', sub: '発声のしくみを図で理解' },
    { id: 'test', icon: '📝', title: 'テスト', sub: '今の実力をチェック' },
  ];

  VT.h = {
    header(title, back) {
      return `<header class="bar">
        ${back ? `<a class="back" href="${back.href}" aria-label="戻る">‹ ${back.label}</a>` : '<span></span>'}
        <h1>${title}</h1><span></span></header>`;
    },
    tips(title, items) {
      return `<details class="tips" open><summary>🎓 ${title}</summary><ul>${items.map((t) => `<li>${t}</li>`).join('')}</ul></details>`;
    },
    wait(ms) { return new Promise((r) => setTimeout(r, ms)); },
    shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    rand(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); },
  };

  function noteOptions(sel) {
    let s = '';
    for (let m = 84 + 4; m >= 36; m--) s += `<option value="${m}"${m === sel ? ' selected' : ''}>${VT.music.label(m)}</option>`;
    return s;
  }

  function profileLine(p) {
    if (!p) return '未設定';
    return `${VT.profile.GENDERS[p.gender]}・${p.age}歳・${VT.profile.LEVELS[p.level].label}・音域 ${VT.music.name(p.low)}〜${VT.music.name(p.high)}`;
  }

  /* ---------- ホーム ---------- */
  VT.views.home = function (el) {
    const p = VT.profile.get();
    const mode = VT.profile.mode();
    el.innerHTML = `
      <header class="hero">
        <div class="brand">BlueGreen <b>Voice Lab</b></div>
        <p class="lead">ボイストレーナー監修のトレーニングメニュー</p>
      </header>
      <section class="card profile-card">
        <div class="row-between">
          <div><div class="label">あなたの設定</div><div class="pline">${profileLine(p)}</div></div>
          <a class="btn small ghost" href="#/setup">${p ? '変更' : '設定する'}</a>
        </div>
        <div class="seg" role="tablist" aria-label="メニューの種類">
          <button data-mode="personal" class="${mode === 'personal' && p ? 'on' : ''}" ${p ? '' : 'disabled'}>あなた向けメニュー</button>
          <button data-mode="normal" class="${mode === 'normal' || !p ? 'on' : ''}">ノーマルメニュー</button>
        </div>
        <p class="hint">${VT.settings().summary}</p>
      </section>
      <h2 class="section">トレーニング項目</h2>
      <nav class="menu">
        ${MENU.map((m) => `
          <a class="tile${m.ready ? '' : ' soon'}" ${m.ready ? `href="#/${m.id}"` : 'aria-disabled="true"'}>
            <span class="ticon">${m.icon}</span>
            <span class="ttitle">${m.title}</span>
            <span class="tsub">${m.sub}</span>
            ${m.ready ? '' : '<span class="badge">準備中</span>'}
          </a>`).join('')}
      </nav>
      <p class="foot">🎧 イヤホン・ヘッドホンの使用と、静かな場所での練習がおすすめです。</p>`;
    el.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
      VT.profile.setMode(b.dataset.mode);
      route();
    }));
  };

  /* ---------- 初期設定 ---------- */
  VT.views.setup = function (el) {
    const p = VT.profile.get() || { gender: 'male', age: 30, level: 'beginner', ...VT.profile.suggestRange('male', 30) };
    const first = !VT.profile.get();
    el.innerHTML = `
      ${VT.h.header('あなたの設定', first ? null : { href: '#/', label: 'ホーム' })}
      ${first ? '<p class="lead pad">最初に声のプロフィールを設定すると、あなたの音域に合わせたメニューになります。あとからいつでも変更・ノーマルメニューへの切り替えができます。</p>' : ''}
      <form class="card form" id="f">
        <fieldset><legend>性別</legend>
          <div class="seg">
            ${Object.entries(VT.profile.GENDERS).map(([k, v]) => `<label><input type="radio" name="gender" value="${k}" ${p.gender === k ? 'checked' : ''}><span>${v}</span></label>`).join('')}
          </div>
        </fieldset>
        <label class="field">年齢<input type="number" name="age" min="5" max="100" value="${p.age}" inputmode="numeric" required></label>
        <fieldset><legend>経験</legend>
          <div class="seg">
            ${Object.entries(VT.profile.LEVELS).map(([k, v]) => `<label><input type="radio" name="level" value="${k}" ${p.level === k ? 'checked' : ''}><span>${v.label}</span></label>`).join('')}
          </div>
        </fieldset>
        <div class="grid2">
          <label class="field">最高音<select name="high">${noteOptions(p.high)}</select></label>
          <label class="field">最低音<select name="low">${noteOptions(p.low)}</select></label>
        </div>
        <p class="hint">裏声も含めて「無理なく出せる」最高音・最低音を選んでください。わからなければ目安を入れるか、マイクで測れます。</p>
        <div class="row">
          <button type="button" class="btn ghost" id="suggest">目安を入れる</button>
          <button type="button" class="btn ghost" id="measure">🎙 マイクで測る</button>
        </div>
        <p class="error" id="err" hidden></p>
        <button class="btn primary block" type="submit">この設定をデフォルトにする</button>
        ${first ? '<button type="button" class="btn link block" id="skip">設定せずにノーマルメニューで始める</button>' : ''}
      </form>`;
    const f = el.querySelector('#f');
    const read = () => ({
      gender: f.gender.value, age: Math.max(5, Math.min(100, parseInt(f.age.value, 10) || 30)),
      level: f.level.value, low: +f.low.value, high: +f.high.value,
    });
    el.querySelector('#suggest').onclick = () => {
      const v = read(); const r = VT.profile.suggestRange(v.gender, v.age);
      f.low.value = r.low; f.high.value = r.high;
    };
    const save = () => {
      const v = read();
      const err = el.querySelector('#err');
      if (v.high - v.low < 5) { err.textContent = '最高音は最低音より5半音以上高く設定してください。'; err.hidden = false; return false; }
      VT.profile.save(v); VT.profile.setMode('personal');
      return true;
    };
    el.querySelector('#measure').onclick = () => { if (save()) location.hash = '#/ear/tuner'; };
    const skip = el.querySelector('#skip');
    if (skip) skip.onclick = () => { VT.store.set('skipped', true); VT.profile.setMode('normal'); location.hash = '#/'; };
    f.addEventListener('submit', (e) => { e.preventDefault(); if (save()) location.hash = '#/'; });
  };

  /* ---------- ルーター ---------- */
  function route() {
    if (current && current.unmount) try { current.unmount(); } catch (e) {}
    current = null;
    VT.pitch.stop();
    VT.audio.stopAll();
    let path = location.hash.replace(/^#/, '') || '/';
    if (path === '/' && !VT.profile.get() && !VT.store.get('skipped', false)) path = '/setup';
    const key = path === '/' ? 'home' : path.slice(1).replace(/\//g, '.');
    const view = VT.views[key] || VT.views.home;
    $app.innerHTML = '';
    $app.scrollTop = 0; window.scrollTo(0, 0);
    current = view($app) || null;
  }
  VT.route = route;
  window.addEventListener('hashchange', route);
  document.addEventListener('DOMContentLoaded', route);
})(window.VT);
