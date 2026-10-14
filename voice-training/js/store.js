/* localStorage の安全なラッパー（使えない環境でも動くように） */
window.VT = window.VT || {};
(function (VT) {
  const mem = {};
  VT.store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('vt.' + key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) {
        return key in mem ? mem[key] : fallback;
      }
    },
    set(key, value) {
      mem[key] = value;
      try { localStorage.setItem('vt.' + key, JSON.stringify(value)); } catch (e) {}
    },
    remove(key) {
      delete mem[key];
      try { localStorage.removeItem('vt.' + key); } catch (e) {}
    },
  };

  // 練習記録：ベストスコアと実施回数
  VT.records = {
    get(id) { return VT.store.get('rec.' + id, null); },
    add(id, score, betterIsLower) {
      const r = VT.records.get(id) || { best: null, count: 0, last: null };
      r.count += 1;
      r.last = score;
      if (r.best == null || (betterIsLower ? score < r.best : score > r.best)) r.best = score;
      r.date = new Date().toISOString().slice(0, 10);
      VT.store.set('rec.' + id, r);
      return r;
    },
  };
})(window.VT);
