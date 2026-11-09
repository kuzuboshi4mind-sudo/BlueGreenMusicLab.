// Supabase への接続とログイン
// config.js に接続先が入っているときだけ使う。空なら supabase は null(この端末に保存)
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config.js';
export const cloudEnabled = !!(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

// Supabase の公式の部品。版を固定して、クラウドを使うときだけ読み込む(勝手に新しい版に変わらないように)
// 圏外などで読み込めなくても、アプリ全体は止めない(この端末の写しを読むだけで開けるように。2026-11-09)
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
let createClient = null;
if (cloudEnabled) {
  try {
    ({ createClient } = await import(SUPABASE_JS));
  } catch (err) {
    console.warn('Supabase の部品を読み込めませんでした', err);
  }
}

// 電波が弱いときに待ち続けないよう、クラウドとのやりとりは20秒で打ち切る
const FETCH_TIMEOUT_MS = 20000;
function fetchWithTimeout(input, init = {}) {
  if (init.signal || typeof AbortController === 'undefined') return fetch(input, init);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  return fetch(input, { ...init, signal: ctl.signal }).finally(() => clearTimeout(timer));
}

export const supabase = createClient
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      global: { fetch: fetchWithTimeout },
    })
  : null;

// クラウドにつながるか(圏外・Supabase の一時停止中などは false)
export async function cloudReachable() {
  if (!supabase) return false;
  if (navigator.onLine === false) return false;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY }, signal: ctl.signal, cache: 'no-store',
    });
    return res.status < 500;   // 返事があればつながっている(5xx は止まっている)
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// いまログインしている人(いなければ null)
export async function currentUser() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user || null;
  } catch {
    return null;
  }
}

// メールとパスワードでログイン。失敗したら日本語のメッセージを投げる
export async function signIn(email, password) {
  if (!supabase) throw new Error('クラウドの部品を読み込めませんでした。通信の状態を確認して、アプリを開き直してください。');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const msg = /invalid login credentials/i.test(error.message)
      ? 'メールアドレスかパスワードが違います'
      : /email not confirmed/i.test(error.message)
        ? 'メールアドレスの確認が終わっていません(Supabase の管理画面でユーザーを確認済みにしてください)'
        : `ログインできませんでした(${error.message})`;
    throw new Error(msg);
  }
  return data.user;
}

// ---- 新規登録・パスワードの再設定(汎用版:1つのクラウドに複数の講師が登録する)----
// 講師ごとのデータは RLS(行単位のアクセス制限)で分かれていて、ほかの講師のデータは見えない
const appUrl = () => location.origin + location.pathname;

function authMessage(error) {
  const m = error?.message || '';
  if (/already registered|already exists/i.test(m)) return 'このメールアドレスはもう登録されています。ログインしてください';
  if (/password should be at least|weak password/i.test(m)) return 'パスワードが短すぎます(8文字以上にしてください)';
  if (/signups not allowed|signup is disabled/i.test(m)) return '今は新規登録を受け付けていません';
  if (/rate limit|too many/i.test(m)) return '短い時間に何度も送ったため、しばらく待ってからやり直してください';
  if (/invalid email|unable to validate email/i.test(m)) return 'メールアドレスの形が正しくありません';
  return m;
}

// 新規登録。確認メールが必要な設定なら { needConfirm: true } を返す
export async function signUp(email, password) {
  if (!supabase) throw new Error('クラウドの部品を読み込めませんでした。通信の状態を確認して、アプリを開き直してください。');
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } });
  if (error) throw new Error(`登録できませんでした(${authMessage(error)})`);
  // 同じメールで登録済みのときも error にならないことがある(identities が空になる)
  if (data.user && Array.isArray(data.user.identities) && !data.user.identities.length) {
    throw new Error('このメールアドレスはもう登録されています。ログインしてください');
  }
  return { user: data.user, needConfirm: !data.session };
}

// パスワードを忘れたとき:再設定のメールを送る(メールのリンクからアプリが開き、新しいパスワードを決める)
export async function sendPasswordReset(email) {
  if (!supabase) throw new Error('クラウドの部品を読み込めませんでした');
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
  if (error) throw new Error(`送れませんでした(${authMessage(error)})`);
}

// 確認メール・再設定メールのリンクから開いたとき:URL の # のあとにある鍵でログインする
// 戻り値:'recovery'(パスワードの再設定) / 'signup'(登録の確認) / null(リンクから開いたのではない)
export async function consumeAuthLink() {
  if (!supabase) return null;
  const params = new URLSearchParams(location.hash.slice(1));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const type = params.get('type');
  if (!access_token || !refresh_token) return null;
  history.replaceState(null, '', appUrl());   // 鍵を URL に残さない
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) return null;
  return type === 'recovery' ? 'recovery' : 'signup';
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(`変えられませんでした(${authMessage(error)})`);
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

// ログイン状態が変わったとき(ログアウト・期限切れなど)に呼ぶ関数を登録する
export function onSignedOut(fn) {
  if (!supabase) return;
  supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') fn();
  });
}
