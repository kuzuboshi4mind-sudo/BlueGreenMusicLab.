// 外部のメモアプリとつなぐ機能(個人版にあったもの)
// 汎用版では使わないので、何もしない部品にしている(呼び出し側はそのまま動く)
export function wasConnected() { return false; }
export async function currentUser() { return null; }
export async function connect() { throw new Error('この版では使えません'); }
export async function disconnect() {}
export async function memosFor() { return null; }
export function errorText(e) { return e?.message || ''; }
export async function renderInto(box) { if (box) { box.hidden = true; box.innerHTML = ''; } }
