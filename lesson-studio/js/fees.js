// 月謝と年間回数(汎用版で追加)
// ・上の「💴 月謝」から開く。「月ごとの月謝」と「年間回数」の2つの画面
// ・月ごとの月謝:その月の生徒ごとに、料金・消化した回数・請求額・入金を一覧にする
//   - 請求額は自動で計算(月謝=そのまま、1回ごと=確約+欠席(消化)の回数×金額)。欄に入れるとその月だけ手入力の金額にする
//   - 「入金済み」をタップで記録(入金日は今日)。もう一度タップで未入金に戻す。どれも「戻す」で元に戻せる
//   - 「お知らせ」で月謝のお知らせの文面を作り、コピーか LINE で送る
// ・年間回数:年間の回数を決めてある生徒ごとに、消化・確約の予定・仮・残りと、今日までの目安を出す
// ・料金と年間回数は、生徒の画面の「料金と年間回数」で決める(store.savePlan)
import * as store from './store.js';
import { escapeHtml } from './calendar.js';
import { yen, feeLabel, progressHtml } from './plan-view.js';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const dialog = document.getElementById('fees-dialog');
const monthBox = document.getElementById('fees-month');
const annualBox = document.getElementById('fees-annual');
const monthLabel = document.getElementById('fees-month-label');
const sumBox = document.getElementById('fees-sum');
const list = document.getElementById('fees-list');
const annualList = document.getElementById('annual-list');
const badge = document.getElementById('fees-badge');
const notice = {
  dialog: document.getElementById('fee-notice-dialog'),
  title: document.getElementById('fee-notice-title'),
  to: document.getElementById('fee-notice-to'),
  text: document.getElementById('fee-notice-text'),
  copy: document.getElementById('fee-notice-copy'),
  line: document.getElementById('fee-notice-line'),
};

let getMonth = () => ({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
let onChanged = () => {};
let openStudent = () => {};
let shown = null;        // 表示中の月 { year, month }
let rows = [];           // store.getMonthFees の結果
let types = [];
let tab = 'month';

export function initFees(opts) {
  getMonth = opts.getMonth;
  onChanged = opts.onChanged;
  openStudent = opts.openStudent;
  document.getElementById('open-fees').addEventListener('click', open);
  for (const d of [dialog, notice.dialog]) {
    d.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => d.close()));
  }
  dialog.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  dialog.querySelectorAll('[data-month]').forEach(b => b.addEventListener('click', () => {
    const d = new Date(shown.year, shown.month - 1 + Number(b.dataset.month), 1);
    shown = { year: d.getFullYear(), month: d.getMonth() + 1 };
    renderMonth();
  }));
  list.addEventListener('click', onListClick);
  list.addEventListener('change', onAmountChange);
  annualList.addEventListener('click', e => {
    const b = e.target.closest('[data-student]');
    if (b) { dialog.close(); openStudent(b.dataset.student); }
  });
  notice.copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(notice.text.value); showToast('文面をコピーしました'); }
    catch { notice.text.select(); document.execCommand('copy'); showToast('文面をコピーしました'); }
  });
  notice.text.addEventListener('input', updateLineLink);
  updateBadge();
}

async function open() {
  shown = { ...getMonth() };
  await showTab(tab);
  dialog.showModal();
  dialog.querySelector('h2').focus();
}

async function showTab(name) {
  tab = name;
  dialog.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === name)));
  monthBox.hidden = name !== 'month';
  annualBox.hidden = name !== 'annual';
  document.getElementById('fees-title').textContent = name === 'month' ? '月謝' : '年間回数';
  if (name === 'month') await renderMonth(); else await renderAnnual();
}

function dateLabel(date) {
  const [y, m, d] = date.split('-').map(Number);
  return `${m}/${d}(${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const ymOf = ({ year, month }) => `${year}-${String(month).padStart(2, '0')}`;

// ---------------------------------------------------------
// 月ごとの月謝
// ---------------------------------------------------------
async function renderMonth() {
  monthLabel.textContent = `${shown.year}年${shown.month}月`;
  [rows, types] = await Promise.all([store.getMonthFees(shown.year, shown.month), store.getTypes()]);
  const typeById = Object.fromEntries(types.map(t => [t.id, t]));
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const paid = rows.filter(r => r.paid).reduce((a, r) => a + r.amount, 0);
  sumBox.innerHTML = `
    <div><span>請求の合計</span><strong>${yen(total)}</strong></div>
    <div><span>入金済み</span><strong class="ok">${yen(paid)}</strong></div>
    <div><span>未入金</span><strong class="${total - paid ? 'ng' : ''}">${yen(total - paid)}</strong></div>`;
  if (!rows.length) {
    list.innerHTML = '<li class="students-empty">この月はまだ請求するレッスンがありません。生徒の画面の「料金と年間回数」で料金を決めると、ここに並びます。</li>';
    return;
  }
  list.innerHTML = rows.map(r => {
    const type = typeById[r.typeId];
    const how = r.plan.fee.kind === 'monthly' ? `月謝・レッスン ${r.consumed}回`
      : r.plan.fee.kind === 'per' ? `${yen(r.plan.fee.amount)} × ${r.consumed}回`
      : '料金未設定';
    const extra = [r.tentative ? `仮 ${r.tentative}件(未確定)` : '', r.cancelled ? `キャンセル ${r.cancelled}件` : '',
      r.overridden ? '手入力の金額' : '', r.paid && r.paidDate ? `${dateLabel(r.paidDate)}入金` : ''].filter(Boolean).join('・');
    return `<li class="fee-row ${r.paid ? 'is-paid' : ''}">
      <span class="slot-swatch" style="background:${type?.color || 'transparent'}"></span>
      <button type="button" class="fee-main" data-student="${escapeHtml(r.name)}">
        <strong>${escapeHtml(r.name)}</strong>
        <small>${escapeHtml(how)}${extra ? `<br>${escapeHtml(extra)}` : ''}</small>
      </button>
      <input type="number" inputmode="numeric" min="0" step="100" class="fee-amount" data-amount="${escapeHtml(r.name)}"
        value="${r.overridden ? r.amount : ''}" placeholder="${r.calc}" aria-label="${escapeHtml(r.name)}さんの請求額">
      <span class="fee-buttons">
        <button type="button" class="btn btn-small fee-paid" data-paid="${escapeHtml(r.name)}" aria-pressed="${r.paid}">${r.paid ? '入金済み ✓' : '未入金'}</button>
        <button type="button" class="btn btn-small" data-notice="${escapeHtml(r.name)}">お知らせ</button>
      </span>
    </li>`;
  }).join('');
}

async function onListClick(e) {
  const stu = e.target.closest('[data-student]');
  if (stu) { dialog.close(); openStudent(stu.dataset.student); return; }
  const paidBtn = e.target.closest('[data-paid]');
  if (paidBtn) {
    const r = rows.find(x => x.name === paidBtn.dataset.paid);
    const now = !r.paid;
    await store.setPayment(ymOf(shown), r.name, { paid: now, paidDate: now ? todayKey() : '' },
      `${r.name}さんを${now ? '入金済み' : '未入金'}にする(${shown.month}月)`);
    await renderMonth();
    updateBadge();
    onChanged();
    return;
  }
  const n = e.target.closest('[data-notice]');
  if (n) openNotice(rows.find(x => x.name === n.dataset.notice));
}

async function onAmountChange(e) {
  const input = e.target.closest('[data-amount]');
  if (!input) return;
  const v = input.value.trim();
  await store.setPayment(ymOf(shown), input.dataset.amount, { amount: v === '' ? null : Math.max(0, Number(v)) },
    `${input.dataset.amount}さんの請求額(${shown.month}月)`);
  await renderMonth();
  updateBadge();
}

// ---- お知らせの文面 ----
async function openNotice(r) {
  const [profile, extras] = await Promise.all([store.getProfile(), store.getStudentExtras()]);
  const consumedLessons = r.lessons.filter(l => ['confirmed', 'absent'].includes(l.status || 'tentative'));
  const lines = [`${r.name}さん`, '', `${shown.month}月分のレッスン料のお知らせです。`];
  if (consumedLessons.length) lines.push(`レッスン日:${consumedLessons.map(l => dateLabel(l.date)).join('、')}(${consumedLessons.length}回)`);
  if (r.plan.fee.kind === 'per' && !r.overridden) lines.push(`${yen(r.plan.fee.amount)} × ${r.consumed}回`);
  else if (r.plan.fee.kind === 'monthly' && !r.overridden) lines.push(`月謝 ${yen(r.plan.fee.amount)}`);
  lines.push(`ご請求額 ${yen(r.amount)}`, '', 'よろしくお願いいたします。');
  const sign = [profile.studio, profile.teacher].filter(Boolean).join(' ');
  if (sign) lines.push(sign);
  notice.title.textContent = `${r.name}さん・${shown.month}月分`;
  const lineName = extras[r.name]?.lineName;
  notice.to.innerHTML = lineName ? `送り先:<strong>${escapeHtml(lineName)}</strong>(LINE の画面でこの人を選んでください)` : '文面は送る前に直せます。';
  notice.text.value = lines.join('\n');
  updateLineLink();
  notice.dialog.showModal();
}

function updateLineLink() {
  // LINE 公式のしくみ。送信先を選ぶ画面が開く(自動では送らない)
  notice.line.href = `https://line.me/R/share?text=${encodeURIComponent(notice.text.value)}`;
}

// ---------------------------------------------------------
// 年間回数
// ---------------------------------------------------------
async function renderAnnual() {
  const all = await store.getAllAnnualProgress();
  if (!all.length) {
    annualList.innerHTML = '<p class="students-empty">年間の回数を決めてある生徒はいません。生徒の画面の「料金と年間回数」で「年間の回数」を入れると、ここに並びます。</p>';
    return;
  }
  annualList.innerHTML = all.map(({ name, plan, progress }) => `<div class="annual-card">
    <button type="button" class="annual-open" data-student="${escapeHtml(name)}">
      ${progressHtml(progress, { name })}
      <small class="muted">${escapeHtml(feeLabel(plan))}・年間${plan.annual.count}回</small>
    </button></div>`).join('');
}

// ---------------------------------------------------------
// 上の「💴 月謝」ボタンの数字:先月分で、まだ入金していない人(請求額が0より大きい人)
// ---------------------------------------------------------
export async function updateBadge() {
  try {
    const d = new Date();
    const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const r = await store.getMonthFees(prev.getFullYear(), prev.getMonth() + 1);
    const n = r.filter(x => !x.paid && x.amount > 0).length;
    badge.hidden = !n;
    badge.textContent = n;
    badge.title = n ? `${prev.getMonth() + 1}月分の未入金 ${n}人` : '';
  } catch { badge.hidden = true; }
}

function showToast(text) {
  const toast = document.getElementById('toast');
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 3000);
}
