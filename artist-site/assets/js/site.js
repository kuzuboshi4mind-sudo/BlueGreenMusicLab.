// モバイルメニュー
document.querySelector('.nav-toggle')?.addEventListener('click', e => {
  const nav = document.getElementById('site-nav');
  const open = nav.classList.toggle('open');
  e.currentTarget.setAttribute('aria-expanded', open);
});
// YouTube：クリックしてから読み込む（ページを軽く保つ）
document.querySelectorAll('.yt').forEach(el => {
  el.querySelector('.yt-play').addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${el.dataset.id}?autoplay=1`;
    f.allow = 'autoplay; encrypted-media; picture-in-picture';
    f.allowFullscreen = true;
    el.replaceChildren(f);
  }, { once: true });
});
// 動画の絞り込み
document.querySelectorAll('.filter button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.filter button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.video-grid figure').forEach(f => {
    f.hidden = b.dataset.filter !== 'all' && f.dataset.cat !== b.dataset.filter;
  });
}));
// お問い合わせフォーム（Web3Forms）をページ遷移なしで送信
document.querySelectorAll('.contact-form').forEach(form => form.addEventListener('submit', async e => {
  e.preventDefault();
  const status = form.querySelector('.form-status');
  const btn = form.querySelector('button');
  btn.disabled = true; status.textContent = '送信中…';
  try {
    const res = await fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    const reserved = form.classList.contains('reserve-form');
    form.reset(); if (reserved) syncLive();
    status.textContent = reserved ? 'ご予約を受け付けました。確認のご連絡をお待ちください。' : '送信しました。折り返しご連絡いたします。';
  } catch (err) {
    status.textContent = '送信できませんでした。時間をおいて再度お試しいただくか、SNSからご連絡ください。';
  } finally { btn.disabled = false; }
}));
// 予約フォーム：?live= で公演を選択済みにし、件名に公演名を入れる
const liveSel = document.querySelector('.reserve-form select[name="公演"]');
function syncLive() {
  if (!liveSel) return;
  const opt = liveSel.selectedOptions[0];
  liveSel.form.subject.value = '【予約】' + opt.value;
  liveSel.parentElement.querySelector('.live-info').textContent = opt.dataset.info;
}
if (liveSel) {
  const key = new URLSearchParams(location.search).get('live');
  const hit = [...liveSel.options].find(o => o.dataset.key === key);
  if (hit) hit.selected = true;
  liveSel.addEventListener('change', syncLive);
  syncLive();
}
