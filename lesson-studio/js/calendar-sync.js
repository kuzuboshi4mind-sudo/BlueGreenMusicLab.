// カレンダーと同期(汎用版で追加)
// レッスンの予定を、スマホのカレンダー(iPhone・iPad・Mac・Android)や Google カレンダーに出す。
// このアプリ → カレンダー の一方向(カレンダー側で直しても、このアプリには戻らない)。
//
// しくみ:
// ・予定を iCalendar 形式(.ics。どのカレンダーアプリも読める共通の形)にする
// ・クラウド保存のとき:できた .ics をクラウドの calendar_feeds 表に置き、
//   Supabase の Edge Function「calendar-feed」が、推測できない鍵(token)付きの URL で配る。
//   カレンダーアプリにこの URL を「購読」として追加すると、あとは自動で新しくなる。
//   予定を変えるたびに(3秒まとめて)作り直して置き直す。アプリを開いたときにも作り直す
// ・この端末に保存のとき(またはクラウドでも):.ics ファイルを書き出して、1回だけ取り込める
// 選べること:同期する先(スマホ / Google)、入れる予定(確約だけ / 仮も)、通知、生徒の名前を出すか、自分の予定も入れるか
import * as store from './store.js';
import { cloudEnabled, supabase, currentUser } from './cloud.js';
import { SUPABASE_URL } from '../config.js';
import { offerFile } from './trash-backup.js';

const PAST_DAYS = 30;      // 何日前の予定から入れるか
const FUTURE_DAYS = 200;   // 何日先の予定まで入れるか

const $ = id => document.getElementById(id);
let settings = null;
let uploadTimer = null;

export function initCalendarSync() {
  $('open-settings').addEventListener('click', render);
  for (const id of ['cal-target-phone', 'cal-target-google', 'cal-statuses', 'cal-alarm', 'cal-names', 'cal-private']) {
    $(id).addEventListener('change', onOptionChange);
  }
  $('cal-start').addEventListener('click', startSync);
  $('cal-stop').addEventListener('click', stopSync);
  $('cal-renew').addEventListener('click', renewUrl);
  $('cal-copy').addEventListener('click', copyUrl);
  $('cal-ics').addEventListener('click', exportIcsFile);
  // 予定や設定が変わったら、少しまとめてから置き直す
  store.onDataChanged(scheduleUpload);
}

// アプリを開いたとき(ログインのあと)に1回、最新にしておく
export async function refreshCalendarFeed() {
  settings = await store.getCalendarSync();
  if (cloudEnabled && settings.enabled && settings.token) await uploadFeed().catch(() => {});
}

// ---------------------------------------------------------
// iCalendar(.ics)を作る
// ---------------------------------------------------------
const pad = n => String(n).padStart(2, '0');
function addDaysKey(date, n) {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
// '2026-11-09' と '16:00' → '20261109T160000'(日をまたぐ長い予定にも対応)
function stamp(date, minutes) {
  const day = addDaysKey(date, Math.floor(minutes / 1440));
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${day.replaceAll('-', '')}T${pad(Math.floor(m / 60))}${pad(m % 60)}00`;
}
// 文字の中の , ; \ と改行は、iCalendar の決まりで前に \ を付ける
const icsText = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');
// 1行は75バイトまで。超えたら折り返す(次の行の頭に空白)。日本語の途中で切らないように1文字ずつ数える
function fold(line) {
  const enc = new TextEncoder();
  let out = '', cur = '', bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (out ? 74 : 75)) { out += (out ? '\r\n ' : '') + cur; cur = ''; bytes = 0; }
    cur += ch; bytes += b;
  }
  return out ? `${out}\r\n ${cur}` : cur;
}

// lessons:予定の一覧、types:種類、opt:同期の設定、profile:教室の情報
export function buildIcs(lessons, types, opt, profile = {}) {
  const typeById = Object.fromEntries(types.map(t => [t.id, t]));
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const calName = profile.studio ? `${profile.studio}のレッスン` : 'レッスン帳';
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LessonBook//JA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(calName)}`, 'X-WR-TIMEZONE:Asia/Tokyo',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
    'BEGIN:VTIMEZONE', 'TZID:Asia/Tokyo', 'BEGIN:STANDARD', 'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:JST', 'END:STANDARD', 'END:VTIMEZONE',
  ];
  let count = 0;
  for (const l of lessons) {
    const status = l.status || 'tentative';
    const type = typeById[l.typeId];
    const isPrivate = status === 'none' || !type?.countInTotal;
    if (status === 'cancelled' || status === 'absent') continue;          // 行わない予定は出さない
    if (status === 'tentative' && opt.statuses !== 'all') continue;
    if (isPrivate && !opt.includePrivate) continue;
    const start = toMin(l.start);
    const who = isPrivate ? (l.student || type?.name || '予定') : opt.showNames ? `${l.student || '(名前なし)'}` : 'レッスン';
    const summary = `${who}${status === 'tentative' ? '(仮)' : ''}`;
    const desc = [type?.name, opt.showNames && l.memo ? l.memo : ''].filter(Boolean).join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsText(String(l.id).replace(/[^A-Za-z0-9:._-]/g, '-'))}@lessonbook`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Asia/Tokyo:${stamp(l.date, start)}`,
      `DTEND;TZID=Asia/Tokyo:${stamp(l.date, start + Number(l.duration || 30))}`,
      `SUMMARY:${icsText(summary)}`,
    );
    if (desc) lines.push(`DESCRIPTION:${icsText(desc)}`);
    if (type?.name && !isPrivate) lines.push(`LOCATION:${icsText(type.name)}`);
    lines.push(`STATUS:${status === 'tentative' ? 'TENTATIVE' : 'CONFIRMED'}`);
    if (Number(opt.alarm) > 0) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(summary)}`, `TRIGGER:-PT${Number(opt.alarm)}M`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
    count++;
  }
  lines.push('END:VCALENDAR');
  return { text: lines.map(fold).join('\r\n') + '\r\n', count };
}

async function makeIcs() {
  const today = todayKey();
  const [lessons, types, profile] = await Promise.all([
    store.getLessonsInRange(addDaysKey(today, -PAST_DAYS), addDaysKey(today, FUTURE_DAYS)), store.getTypes(), store.getProfile(),
  ]);
  return buildIcs(lessons, types, settings || await store.getCalendarSync(), profile);
}

// ---------------------------------------------------------
// クラウドに置く(購読用の URL)
// ---------------------------------------------------------
function newToken() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');   // 48文字
}
const feedUrl = token => `${SUPABASE_URL}/functions/v1/calendar-feed?token=${token}`;
const webcalUrl = token => feedUrl(token).replace(/^https?:/, 'webcal:');
const googleUrl = token => `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(token))}`;

async function uploadFeed() {
  if (!cloudEnabled || !supabase || !settings?.enabled || !settings.token) return;
  if (store.isOffline()) return;
  const user = await currentUser();
  if (!user) return;
  const { text, count } = await makeIcs();
  const { error } = await supabase.from('calendar_feeds').upsert({
    user_id: user.id, token: settings.token, ics: text, updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  settings = await store.saveCalendarSync({ lastUploadAt: new Date().toISOString(), lastCount: count });
}

function scheduleUpload() {
  if (!cloudEnabled) return;
  clearTimeout(uploadTimer);
  uploadTimer = setTimeout(async () => {
    settings = await store.getCalendarSync();
    if (settings.enabled) uploadFeed().catch(err => console.warn('カレンダーの同期に失敗しました', err));
  }, 3000);
}

async function startSync() {
  const btn = $('cal-start');
  btn.disabled = true;
  try {
    settings = await store.saveCalendarSync({ enabled: true, token: settings.token || newToken() });
    await uploadFeed();
  } catch (err) {
    settings = await store.saveCalendarSync({ enabled: false });
    alert(`同期をはじめられませんでした(${err.message})\nクラウドの準備(README の「カレンダーの同期の準備」)ができているか確かめてください。`);
  } finally {
    btn.disabled = false;
    await render();
  }
}

async function stopSync() {
  if (!confirm('カレンダーの同期を止めますか?\n(カレンダーに追加した予定は、カレンダーアプリ側で購読を削除すると消えます)')) return;
  settings = await store.saveCalendarSync({ enabled: false });
  if (supabase) await supabase.from('calendar_feeds').delete().eq('token', settings.token);
  await render();
}

async function renewUrl() {
  if (!confirm('同期用の URL を作り直しますか?\n前の URL は使えなくなります(人に知られたかもしれないとき用)。カレンダーアプリには、新しい URL を追加し直してください。')) return;
  if (supabase && settings.token) await supabase.from('calendar_feeds').delete().eq('token', settings.token);
  settings = await store.saveCalendarSync({ token: newToken() });
  try { await uploadFeed(); } catch (err) { alert(`作り直せませんでした(${err.message})`); }
  await render();
}

async function copyUrl() {
  const url = feedUrl(settings.token);
  try { await navigator.clipboard.writeText(url); } catch { prompt('この URL をコピーしてください', url); return; }
  $('cal-copy').textContent = 'コピーしました';
  setTimeout(() => { $('cal-copy').textContent = 'URL をコピー'; }, 2000);
}

// ---------------------------------------------------------
// .ics ファイルを書き出す(1回だけ取り込む)
// ---------------------------------------------------------
async function exportIcsFile() {
  settings = await store.getCalendarSync();
  const { text, count } = await makeIcs();
  if (!count) { alert('書き出す予定がありません(「入れる予定」の選び方も確かめてください)'); return; }
  const file = new File([text], `lessons-${todayKey()}.ics`, { type: 'text/calendar' });
  offerFile(file, 'カレンダー用のファイルを保存',
    `${count}件の予定(${PAST_DAYS}日前〜${FUTURE_DAYS}日先)。iPhone はファイルをタップ →「すべてを追加」、Google カレンダーはパソコンの「設定 → インポート」で取り込めます。1回だけの取り込みなので、あとの変更は反映されません。`);
}

// ---------------------------------------------------------
// 設定画面
// ---------------------------------------------------------
async function onOptionChange() {
  const targets = [];
  if ($('cal-target-phone').checked) targets.push('phone');
  if ($('cal-target-google').checked) targets.push('google');
  settings = await store.saveCalendarSync({
    targets, statuses: $('cal-statuses').value, alarm: Number($('cal-alarm').value),
    showNames: $('cal-names').checked, includePrivate: $('cal-private').checked,
  });
  renderLinks();
  scheduleUpload();
}

async function render() {
  settings = await store.getCalendarSync();
  $('cal-target-phone').checked = settings.targets.includes('phone');
  $('cal-target-google').checked = settings.targets.includes('google');
  $('cal-statuses').value = settings.statuses;
  $('cal-alarm').value = String(settings.alarm);
  $('cal-names').checked = settings.showNames;
  $('cal-private').checked = settings.includePrivate;
  $('cal-cloud-off').hidden = cloudEnabled;
  $('cal-cloud').hidden = !cloudEnabled;
  renderLinks();
}

function renderLinks() {
  const on = cloudEnabled && settings.enabled && settings.token;
  $('cal-start').hidden = !cloudEnabled || on;
  $('cal-on').hidden = !on;
  if (!on) { $('cal-status').textContent = cloudEnabled ? 'まだ同期していません。' : ''; return; }
  const last = settings.lastUploadAt ? new Date(settings.lastUploadAt) : null;
  $('cal-status').textContent = last
    ? `同期中:${settings.lastCount ?? 0}件の予定を ${last.getMonth() + 1}/${last.getDate()} ${pad(last.getHours())}:${pad(last.getMinutes())} に送りました。予定を変えると自動で送り直します。`
    : '同期中';
  const phone = settings.targets.includes('phone');
  const google = settings.targets.includes('google');
  $('cal-add-phone').hidden = !phone;
  $('cal-add-phone').href = webcalUrl(settings.token);
  $('cal-help-phone').hidden = !phone;
  $('cal-add-google').hidden = !google;
  $('cal-add-google').href = googleUrl(settings.token);
  $('cal-help-google').hidden = !google;
  $('cal-none').hidden = phone || google;
}
