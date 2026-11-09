// ログイン画面
// クラウド保存(config.js に接続先あり)のときだけ使う。ログインするまで表は見せない。
import { cloudEnabled, currentUser, signIn, signOut, onSignedOut, cloudReachable, signUp, sendPasswordReset, consumeAuthLink, updatePassword } from './cloud.js';
import * as store from './store.js';

const screen = document.getElementById('login-screen');
const form = document.getElementById('login-form');
const email = document.getElementById('login-email');
const password = document.getElementById('login-password');
const error = document.getElementById('login-error');
const submit = form.querySelector('button[type="submit"]');

// ログインが済んでいれば、ログインした人を返す。済んでいなければログイン画面を出し、ログインできるまで待つ
// クラウドを使わないとき(この端末に保存)は、すぐに null を返す
export async function requireLogin() {
  if (!cloudEnabled) return null;
  // 確認メール・パスワード再設定メールのリンクから開いたとき
  const link = await consumeAuthLink();
  if (link === 'recovery') return showLoginScreen('newpass');
  // 機内モード・圏外がはっきりしているときは、待たずにこの端末の写しで開く
  if (navigator.onLine === false && await store.goOffline('通信できません(圏外・機内モード)')) {
    return { email: store.deviceCopyInfo().email, offline: true };
  }
  // ログインの確認(期限切れのときは通信が要る)。電波が弱くて返事が来ないときは6秒で見切る
  const user = await Promise.race([currentUser(), new Promise(r => setTimeout(() => r(undefined), 6000))]);
  if (user) return user;
  const reachable = await cloudReachable();
  if (user === undefined && reachable) {
    const u = await currentUser();   // つながってはいるので、返事を待つ
    if (u) return u;
  }
  // ログインの確認ができないとき、クラウドにつながらないせいなら、この端末の写しを読むだけで開く
  // (ログインの期限が切れたまま圏外で開いたときなど。写しはこの端末で前にログインしたときに作ったもの)
  if (!reachable) {
    if (await store.goOffline('クラウドにつながらないため、ログインを確かめられません')) {
      const info = store.deviceCopyInfo();
      return { email: info.email, offline: true };
    }
    error.textContent = 'クラウドにつながりません。通信の状態を確認してください(この端末にはまだ写しがないため、表示できません)。';
  }
  return showLoginScreen('login');
}

// ---- ログイン画面の切り替え ----
// mode:'login'=ログイン / 'signup'=新規登録 / 'reset'=パスワードを忘れた / 'newpass'=新しいパスワードを決める
const el = id => document.getElementById(id);
const MODES = {
  login: { lead: '', submit: 'ログイン', email: true, pass: true, pass2: false, terms: false, passLabel: 'パスワード', ac: 'current-password' },
  signup: { lead: 'アカウントを作ります。登録すると、この講師だけのデータになります(ほかの講師からは見えません)。', submit: '登録する', email: true, pass: true, pass2: true, terms: true, passLabel: 'パスワード(8文字以上)', ac: 'new-password' },
  reset: { lead: '登録したメールアドレスに、パスワードを決め直すためのメールを送ります。', submit: 'メールを送る', email: true, pass: false, pass2: false, terms: false },
  newpass: { lead: '新しいパスワードを決めてください。', submit: 'パスワードを変える', email: false, pass: true, pass2: true, terms: false, passLabel: '新しいパスワード(8文字以上)', ac: 'new-password' },
};
let mode = 'login';
function setMode(next) {
  mode = next;
  const m = MODES[mode];
  el('login-lead').textContent = m.lead;
  el('login-lead').hidden = !m.lead;
  el('login-email-field').hidden = !m.email;
  el('login-password-field').hidden = !m.pass;
  el('login-password2-field').hidden = !m.pass2;
  el('login-terms-field').hidden = !m.terms;
  if (m.passLabel) el('login-password-label').textContent = m.passLabel;
  if (m.ac) password.autocomplete = m.ac;
  submit.textContent = m.submit;
  error.textContent = '';
  el('login-info').textContent = '';
  form.querySelectorAll('[data-mode]').forEach(b => {
    b.hidden = mode === 'newpass' || b.dataset.mode === mode || (b.dataset.mode === 'login' && mode === 'login');
  });
}

function showLoginScreen(startMode) {
  document.body.classList.add('locked');
  screen.hidden = false;
  setMode(startMode);
  form.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  (MODES[startMode].email ? email : password).focus();
  return new Promise(resolve => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      error.textContent = '';
      el('login-info').textContent = '';
      const label = submit.textContent;
      try {
        const addr = email.value.trim();
        const pw = password.value;
        if (MODES[mode].email && !addr) throw new Error('メールアドレスを入れてください');
        if (MODES[mode].pass && !pw) throw new Error('パスワードを入れてください');
        if (MODES[mode].pass2) {
          if (pw.length < 8) throw new Error('パスワードは8文字以上にしてください');
          if (pw !== el('login-password2').value) throw new Error('2つのパスワードが同じではありません');
        }
        if (mode === 'signup' && !el('login-terms').checked) throw new Error('利用規約とプライバシーポリシーへの同意にチェックを付けてください');
        submit.disabled = true;
        submit.textContent = '送っています…';
        if (mode === 'login') {
          const u = await signIn(addr, pw);
          return done(u);
        }
        if (mode === 'signup') {
          const r = await signUp(addr, pw);
          if (!r.needConfirm) return done(r.user);
          setMode('login');
          email.value = addr;
          el('login-info').textContent = `${addr} に確認のメールを送りました。メールのリンクを開くと登録が終わり、このアプリが開きます。`;
          return;
        }
        if (mode === 'reset') {
          await sendPasswordReset(addr);
          el('login-info').textContent = `${addr} にメールを送りました。メールのリンクから、新しいパスワードを決めてください。`;
          return;
        }
        if (mode === 'newpass') {
          await updatePassword(pw);
          return done(await currentUser());
        }
      } catch (err) {
        error.textContent = err.message;
      } finally {
        submit.disabled = false;
        if (submit.textContent === '送っています…') submit.textContent = label;
      }
    });
    function done(u) {
      password.value = '';
      el('login-password2').value = '';
      screen.hidden = true;
      document.body.classList.remove('locked');
      resolve(u);
    }
  });
}

// ログアウトしたら(ほかの端末からのログアウトや期限切れを含む)、画面を読み込み直してログイン画面に戻す
export function watchLogout() {
  onSignedOut(() => location.reload());
}

export async function logout() {
  if (!confirm('ログアウトしますか?\n(この端末に残している予定の写しも消します。クラウドのデータはそのまま残ります)')) return;
  await store.clearDeviceCopies();
  await signOut();
  location.reload();
}
