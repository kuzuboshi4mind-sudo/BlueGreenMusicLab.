/* プロフィールと、そこから導く練習設定（あなた向け／ノーマル） */
window.VT = window.VT || {};
(function (VT) {
  const LEVELS = {
    beginner: { label: '初心者', tol: 40, hold: 0.7, tempo: 80, step: 4, intervals: [2, 4, 7, 12], directions: ['up'], discStart: 200 },
    intermediate: { label: '中級', tol: 25, hold: 1.0, tempo: 96, step: 7, intervals: [2, 3, 4, 5, 7, 9, 12], directions: ['up', 'down'], discStart: 100 },
    advanced: { label: '上級', tol: 15, hold: 1.5, tempo: 112, step: 12, intervals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], directions: ['up', 'down', 'harmonic'], discStart: 60 },
  };
  const GENDERS = { male: '男性', female: '女性', other: 'その他・回答しない' };

  // 音域がわからない人向けの一般的な目安（地声〜無理のない裏声を含む）
  function suggestRange(gender, age) {
    let lo, hi;
    if (age < 12) { lo = 57; hi = 76; }           // A3–E5
    else if (gender === 'male') { lo = 43; hi = 67; }   // G2–G4
    else if (gender === 'female') { lo = 53; hi = 77; } // F3–F5
    else { lo = 48; hi = 72; }                    // C3–C5
    if (age >= 12 && age < 18 && gender === 'male') { lo = 45; hi = 67; }
    if (age >= 60) hi -= 2;
    return { low: lo, high: hi };
  }

  function ageGroup(age) {
    if (age < 12) return 'child';
    if (age < 18) return 'teen';
    if (age >= 60) return 'senior';
    return 'adult';
  }

  const profile = {
    LEVELS, GENDERS, suggestRange, ageGroup,
    get() { return VT.store.get('profile', null); },
    save(p) { VT.store.set('profile', p); },
    mode() { return VT.store.get('mode', profile.get() ? 'personal' : 'normal'); },
    setMode(m) { VT.store.set('mode', m); },
  };

  // 現在のモードに合わせた練習パラメータ
  VT.settings = function () {
    const p = profile.get();
    const personal = profile.mode() === 'personal' && !!p;
    if (!personal) {
      return {
        personal: false, octaveFree: true, range: [48, 72], scaleKeys: [60, 67],
        tol: 30, hold: 1.0, tempo: 92, step: 7, setSize: 10, timeout: 9,
        intervals: LEVELS.intermediate.intervals, directions: ['up', 'down'], discStart: 100,
        summary: 'ノーマルメニュー：標準設定（C3〜C5・オクターブ違いもOK）',
        notes: [],
      };
    }
    const L = LEVELS[p.level] || LEVELS.beginner;
    const g = ageGroup(p.age);
    let lo = p.low, hi = p.high;
    // 音域の端は避けて、余裕のある範囲で練習する
    if (hi - lo >= 10) { lo += 1; hi -= 2; }
    const s = {
      personal: true, octaveFree: false, tol: L.tol, hold: L.hold, tempo: L.tempo, step: L.step,
      setSize: 10, timeout: 9, intervals: L.intervals, directions: L.directions, discStart: L.discStart,
      notes: [],
    };
    if (g === 'child') {
      s.setSize = 8; s.tempo -= 10; s.hold *= 0.8; s.tol += 10;
      s.notes.push('お子さま向けに、1セットを短く・判定をやさしくしています。楽しく歌える範囲で、疲れたらすぐ休みましょう。');
    } else if (g === 'teen') {
      // 変声期：中央付近の楽な音域に絞る
      const mid = Math.round((lo + hi) / 2);
      lo = Math.max(lo, mid - 6); hi = Math.min(hi, mid + 6);
      s.notes.push('変声期は声帯が急に成長する時期です。高音や大声を無理に出さず、楽に出る中音域を中心に練習しましょう。声がかすれる日は休むのも練習です。');
    } else if (g === 'senior') {
      s.tempo -= 10; s.tol += 5; s.timeout = 11;
      s.notes.push('テンポをゆっくりめにしています。こまめに水分をとり、喉に違和感があれば休憩してください。');
    }
    if (p.gender === 'male' && g !== 'child') {
      s.notes.push('男性はおおよそ D4〜F4（mid2D〜mid2F）付近で地声と裏声の切り替わりが起こりやすい音域です。ひっくり返っても失敗ではありません。');
    } else if (p.gender === 'female' && g !== 'child') {
      s.notes.push('女性は E4〜A4（mid2E〜mid2A）付近で地声と裏声の切り替わりが起こりやすい音域です。境目は息を流したまま軽く通過しましょう。');
    }
    s.range = [lo, hi];
    s.scaleKeys = [lo, hi];
    s.summary = `あなた向け：${L.label}・練習音域 ${VT.music.name(lo)}〜${VT.music.name(hi)}・判定 ±${s.tol}セント`;
    return s;
  };

  VT.profile = profile;
})(window.VT);
