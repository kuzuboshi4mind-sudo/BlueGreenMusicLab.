/* 音名・周波数・音程の定義 */
window.VT = window.VT || {};
(function (VT) {
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const JP = ['ド', 'ド#', 'レ', 'レ#', 'ミ', 'ファ', 'ファ#', 'ソ', 'ソ#', 'ラ', 'ラ#', 'シ'];
  const pc = (m) => ((Math.round(m) % 12) + 12) % 12;
  const oct = (m) => Math.floor(Math.round(m) / 12) - 1;

  // カラオケ表記（lowA = A2, mid1C = C3, mid2C = C4, hiC = C5）
  function karaoke(m) {
    const o = oct(m);
    const prefix = o <= 1 ? 'lowlow' : o === 2 ? 'low' : o === 3 ? 'mid1' : o === 4 ? 'mid2' : 'hi'.repeat(o - 4);
    return prefix + NAMES[pc(m)];
  }

  // 音程（半音数）。連想曲は音程を覚えるための目安
  const INTERVALS = [
    { semi: 1, name: '短2度', song: '「ジョーズ」のテーマ' },
    { semi: 2, name: '長2度', song: '「かえるの合唱」ド→レ' },
    { semi: 3, name: '短3度', song: '「グリーンスリーブス」冒頭' },
    { semi: 4, name: '長3度', song: '「聖者の行進」ド→ミ' },
    { semi: 5, name: '完全4度', song: '「蛍の光」冒頭 ソ→ド' },
    { semi: 6, name: '増4度', song: '「マリア」(ウエスト・サイド物語)' },
    { semi: 7, name: '完全5度', song: '「きらきら星」ド→ソ' },
    { semi: 8, name: '短6度', song: '「ジ・エンターテイナー」ミ→ド' },
    { semi: 9, name: '長6度', song: '「マイ・ボニー」冒頭' },
    { semi: 10, name: '短7度', song: '「サムウェア」(ウエスト・サイド物語)' },
    { semi: 11, name: '長7度', song: '「テイク・オン・ミー」サビ' },
    { semi: 12, name: '完全8度', song: '「虹の彼方に」冒頭' },
  ];

  VT.music = {
    NAMES, JP, INTERVALS,
    name: (m) => NAMES[pc(m)] + oct(m),
    jp: (m) => JP[pc(m)],
    karaoke,
    label: (m) => `${NAMES[pc(m)]}${oct(m)}（${karaoke(m)}）`,
    freq: (m) => 440 * Math.pow(2, (m - 69) / 12),
    midi: (f) => 69 + 12 * Math.log2(f / 440),
    interval: (semi) => INTERVALS.find((i) => i.semi === semi),
    // 目標音に一番近いオクターブへ折りたたんだ差（セント）
    foldCents: (cents) => cents - 1200 * Math.round(cents / 1200),
  };
})(window.VT);
