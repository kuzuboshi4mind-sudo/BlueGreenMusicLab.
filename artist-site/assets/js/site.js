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
