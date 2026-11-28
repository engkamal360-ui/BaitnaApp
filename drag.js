// Long-press drag & drop reordering.
// Markup: a container with data-dl="<list>" whose direct children carry data-di="<id>".
// Hold an item ~0.3s, drag it up/down, release; onDrop(list, ids) gets the new order.
export function installDrag(onDrop) {
  const HOLD = 320, SLOP = 9;
  let st = null; // { item, box, items, from, to, y0, sc, sc0, timer, active, h, mids }
  const itemsOf = (box) => [...box.children].filter((x) => x.dataset && x.dataset.di);
  const scroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p; } return document.scrollingElement; };
  const find = (t) => {
    if (!t || !t.closest || t.closest('input,textarea,select,.sw,.nodrag')) return null;
    const item = t.closest('[data-di]'); if (!item || !item.dataset.di) return null;
    const box = item.parentElement; if (!box || !box.dataset || !box.dataset.dl) return null;
    return { item, box };
  };
  const clear = () => { if (!st) return; clearTimeout(st.timer);
    if (st.active) { st.items.forEach((x) => { x.style.transition = 'none'; x.style.transform = ''; x.classList.remove('drg', 'drg-sib'); }); st.box.classList.remove('drg-box'); document.documentElement.classList.remove('drg-doc');
      requestAnimationFrame(() => st0.forEach((x) => { x.style.transition = ''; })); }
    st = null; };
  let st0 = [];
  const start = (x, y, t) => {
    const f = find(t); if (!f) return;
    st = { ...f, x0: x, y0: y, y: y, active: false };
    st.timer = setTimeout(activate, HOLD);
  };
  const activate = () => {
    if (!st) return;
    const items = itemsOf(st.box); if (items.length < 2) { st = null; return; }
    const rects = items.map((x) => x.getBoundingClientRect());
    const from = items.indexOf(st.item);
    const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
    st.sc = scroller(st.box); st.sc0 = st.sc.scrollTop;
    Object.assign(st, { items, from, to: from, active: true, h: rects[from].height + gap, mids: rects.map((r) => r.top + r.height / 2) });
    st0 = items;
    items.forEach((x) => { if (x !== st.item) x.classList.add('drg-sib'); });
    st.item.classList.add('drg'); st.box.classList.add('drg-box'); document.documentElement.classList.add('drg-doc');
    try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
    const sel = window.getSelection && window.getSelection(); if (sel) sel.removeAllRanges();
    step();
  };
  let raf = 0;
  const step = () => {
    if (!st || !st.active) return;
    // auto-scroll near the edges of the scroller
    const sr = st.sc === document.scrollingElement ? { top: 0, bottom: innerHeight } : st.sc.getBoundingClientRect();
    if (st.y < sr.top + 56) st.sc.scrollTop -= 8; else if (st.y > sr.bottom - 56) st.sc.scrollTop += 8;
    const dy = st.y - st.y0 + (st.sc.scrollTop - st.sc0);
    st.item.style.transform = 'translateY(' + dy + 'px) scale(1.02)';
    const mid = st.y0 + dy; // follow the finger (works for tall items too)
    let to = 0; st.mids.forEach((m, i) => { if (i !== st.from && m < mid) to++; });
    st.to = to;
    st.items.forEach((x, i) => { if (i === st.from) return;
      let s = 0; if (st.from < to && i > st.from && i <= to) s = -st.h; else if (to < st.from && i >= to && i < st.from) s = st.h;
      x.style.transform = s ? 'translateY(' + s + 'px)' : ''; });
    raf = requestAnimationFrame(step);
  };
  const move = (x, y, e) => {
    if (!st) return;
    if (!st.active) { if (Math.hypot(x - st.x0, y - st.y0) > SLOP) { clearTimeout(st.timer); st = null; } return; }
    if (e && e.cancelable) e.preventDefault();
    st.y = y;
  };
  const end = () => {
    if (!st) return;
    cancelAnimationFrame(raf);
    if (st.active) {
      const ids = st.items.map((x) => x.dataset.di); const [m] = ids.splice(st.from, 1); ids.splice(st.to, 0, m);
      const list = st.box.dataset.dl, changed = st.to !== st.from;
      // swallow the click that follows the release
      const eat = (ev) => { ev.stopPropagation(); ev.preventDefault(); }; document.addEventListener('click', eat, true); setTimeout(() => document.removeEventListener('click', eat, true), 400);
      clear();
      if (changed) onDrop(list, ids, m);
    } else clear();
  };
  document.addEventListener('touchstart', (e) => { if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY, e.target); else { clearTimeout(st && st.timer); st = null; } }, { passive: true });
  document.addEventListener('touchmove', (e) => move(e.touches[0].clientX, e.touches[0].clientY, e), { passive: false });
  document.addEventListener('touchend', end); document.addEventListener('touchcancel', () => { cancelAnimationFrame(raf); clear(); });
  document.addEventListener('mousedown', (e) => { if (e.button === 0) start(e.clientX, e.clientY, e.target); });
  document.addEventListener('mousemove', (e) => { if (st) move(e.clientX, e.clientY, st.active ? e : null); });
  document.addEventListener('mouseup', end);
  document.addEventListener('contextmenu', (e) => { if (st || find(e.target)) e.preventDefault(); });
}
