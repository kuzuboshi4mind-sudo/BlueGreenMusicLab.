// 料金と年間回数の見せ方(生徒の画面と月謝の画面で共通に使う)
import { escapeHtml } from './calendar.js';

export function yen(n) {
  return '¥' + Math.round(Number(n) || 0).toLocaleString('ja-JP');
}

function md(date) {
  const [, m, d] = date.split('-').map(Number);
  return `${m}/${d}`;
}

// 料金の一言(「月謝 ¥8,000」「1回 ¥4,000」「未設定」)
export function feeLabel(plan) {
  const f = plan?.fee || {};
  if (f.kind === 'monthly') return `月謝 ${yen(f.amount)}`;
  if (f.kind === 'per') return `1回 ${yen(f.amount)}`;
  return '料金未設定';
}

// 年間回数の進み具合(store.getAnnualProgress の結果)を、棒グラフと文で出す
export function progressHtml(p, { name = '' } = {}) {
  if (!p) return '';
  const pct = v => Math.max(0, Math.min(100, v / p.count * 100));
  const doneW = pct(p.done);
  const bookedW = Math.min(100 - doneW, pct(p.booked));
  const tentW = Math.min(100 - doneW - bookedW, pct(p.tentative));
  const gap = Math.round(p.pace);
  const pace = gap >= 1 ? `<span class="pace ahead">目安より ${gap}回 先</span>`
    : gap <= -1 ? `<span class="pace behind">目安より ${-gap}回 遅れ</span>`
    : '<span class="pace">ほぼ目安どおり</span>';
  const warns = [];
  if (p.remaining < 0) warns.push(`確約の予定が年間回数を ${-p.remaining}回 超えています`);
  else if (p.over) warns.push('仮の予定まで入れると年間回数を超えます');
  if (p.remaining > 0 && p.remaining > p.weeksLeft) warns.push(`年度末まで残り約${p.weeksLeft}週で、まだ ${p.remaining}回 入れる必要があります`);
  return `<div class="annual">
    ${name ? `<strong class="annual-name">${escapeHtml(name)}</strong>` : ''}
    <div class="annual-head">
      <span>年度 ${md(p.from)}〜${md(p.to)}</span>
      <strong>${p.done} / ${p.count}回 消化</strong>
      ${pace}
    </div>
    <div class="annual-bar" role="img" aria-label="${p.count}回のうち 消化 ${p.done}回・確約の予定 ${p.booked}回・仮 ${p.tentative}回">
      <span class="seg done" style="width:${doneW}%"></span><span class="seg booked" style="width:${bookedW}%"></span><span class="seg tent" style="width:${tentW}%"></span>
      <span class="expected" style="left:${pct(p.expected)}%" title="今日までの目安 ${p.expected}回"></span>
    </div>
    <div class="annual-legend">
      <span><i class="dot done"></i>消化 ${p.done}</span>
      <span><i class="dot booked"></i>確約の予定 ${p.booked}</span>
      <span><i class="dot tent"></i>仮 ${p.tentative}</span>
      <span>まだ入れていない ${Math.max(0, p.remaining)}回</span>
      ${p.cancelled ? `<span>キャンセル ${p.cancelled}</span>` : ''}
    </div>
    ${warns.map(w => `<p class="annual-warn">⚠ ${escapeHtml(w)}</p>`).join('')}
  </div>`;
}
