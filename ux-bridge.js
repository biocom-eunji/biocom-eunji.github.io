/* 비코 UX 개선안 · 화면 브리지
   AS-IS 앱(8776)과 TO-BE 화면(8775/tobe) 안에서 돌며
   ① ux-pins.js 의 점(핫스팟)을 화면에 붙이고
   ② 화면 이동 · 스크롤을 부모(쉘)에 알려 두 화면이 같이 움직이게 한다. */
(function () {
  if (window.parent === window) return;
  var VARIANT = /^\/tobe\//.test(location.pathname) ? 'tobe' : 'asis';
  var COLOR = VARIANT === 'asis' ? '#C4553F' : '#3FAFD3';
  var KEYS = { '/': 'home', '/goal/score': 'goal-score', '/record/diet/add': 'diet-add' };
  function pageKey() {
    if (VARIANT === 'tobe') { var m = location.pathname.match(/tobe-([a-z-]+)\.html$/); return m ? m[1] : 'other'; }
    return KEYS[decodeURIComponent(location.pathname)] || 'other';
  }
  function send(msg) { msg.src = 'ux'; msg.variant = VARIANT; msg.page = pageKey(); window.parent.postMessage(msg, '*'); }

  /* ---------- 점 ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.uxpin{position:absolute;z-index:2147483000;width:14px;height:14px;border-radius:50%;background:' + COLOR + ';cursor:help;box-shadow:0 0 0 3px ' + COLOR + '40;margin:0;padding:0;border:0;pointer-events:auto}' +
    '.uxpin::before{content:"";position:absolute;inset:-12px}' +
    '@media (prefers-reduced-motion:no-preference){.uxpin{animation:uxp 2.4s ease-out infinite}@keyframes uxp{0%{box-shadow:0 0 0 0 ' + COLOR + '80}80%,100%{box-shadow:0 0 0 9px ' + COLOR + '00}}}' +
    '.ux-on{outline:2px solid ' + COLOR + '!important;outline-offset:-2px!important}' +
    'html[data-ux-pins="off"] .uxpin{display:none!important}';
  document.head.appendChild(css);

  /* 글자로 요소 찾기: 글자가 그대로 같은 가장 안쪽 요소 */
  function byText(t, i) {
    var hit = [].filter.call(document.querySelectorAll('body *'), function (e) {
      if (e.classList.contains('uxpin')) return false;
      var x = (e.innerText || '').trim().replace(/\s+/g, ' ');
      return x === t || x.indexOf(t) === 0 && x.length < t.length + 24;
    });
    hit = hit.filter(function (e) { return ![].some.call(e.children, function (c) { return hit.indexOf(c) >= 0; }); });
    return hit[i || 0];
  }
  function locate(p) {
    var el = p.sel ? document.querySelectorAll(p.sel)[p.i || 0] : p.text ? byText(p.text, p.i) : null;
    for (var n = 0; el && n < (p.up || 0); n++) el = el.parentElement;
    /* card: 폭이 이 값 이상이 될 때까지 부모로 올라감(큰 카드 전체에 점을 달 때) */
    for (var m = 0; el && p.card && el.parentElement && el.getBoundingClientRect().width < p.card && m < 12; m++) el = el.parentElement;
    return el;
  }
  function pins() { var s = (window.UX_PINS || {})[pageKey()]; return (s && s[VARIANT]) || []; }
  function ok(p) {
    if (p.needs && !document.querySelector(p.needs)) return false;
    if (p.not && document.querySelector(p.not)) return false;
    return true;
  }
  var placed = [];
  function place() {
    var list = pins();
    list.forEach(function (p, n) {
      var shown = ok(p), cur = placed[n];
      if (!shown) { if (cur) { cur.remove(); placed[n] = null; } return; }
      if (cur && cur.isConnected) return;
      var el = locate(p);
      if (!el || !el.getClientRects().length) return;
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      var d = document.createElement('i');
      d.className = 'uxpin'; d.setAttribute('role', 'button'); d.setAttribute('tabindex', '0'); d.setAttribute('aria-label', p.t);
      var at = p.at || { top: '6px', right: '6px' };
      for (var k in at) d.style[k] = at[k];
      d.addEventListener('pointerenter', function () { on(d, el, p); });
      d.addEventListener('pointerleave', function () { off(el); });
      d.addEventListener('focus', function () { on(d, el, p); });
      d.addEventListener('blur', function () { off(el); });
      ['click', 'pointerdown', 'mousedown', 'touchstart'].forEach(function (ev) { d.addEventListener(ev, function (e) { e.stopPropagation(); e.preventDefault(); }); });
      el.appendChild(d); placed[n] = d;
    });
  }
  function on(d, el, p) {
    el.classList.add('ux-on');
    var r = d.getBoundingClientRect();
    send({ type: 'pin', t: p.t, d: p.d, kind: p.kind || '', ref: p.ref || '', rect: { l: r.left, t: r.top, w: r.width, h: r.height } });
  }
  function off(el) { el.classList.remove('ux-on'); send({ type: 'pin-off' }); }
  var timer;
  new MutationObserver(function () { clearTimeout(timer); timer = setTimeout(place, 150); })
    .observe(document.documentElement, { childList: true, subtree: true });
  [0, 400, 1200, 2500].forEach(function (ms) { setTimeout(place, ms); });
  window.addEventListener('load', place);

  /* ---------- 화면 이동 ---------- */
  if (VARIANT === 'asis') {
    var last = '';
    setInterval(function () {
      var cur = location.pathname + location.search;
      if (cur !== last) { last = cur; placed.forEach(function (d) { d && d.remove(); }); placed = []; send({ type: 'route', path: decodeURIComponent(location.pathname), search: location.search }); setTimeout(place, 300); }
    }, 200);
  } else {
    send({ type: 'route', path: new URLSearchParams(location.search).get('path') || '' });
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-nav]') : null;
      if (t) { e.preventDefault(); e.stopPropagation(); send({ type: 'nav', path: t.getAttribute('data-nav') }); }
    }, true);
  }

  /* ---------- 체크인 표정 누름 되풀이: 한쪽에서 답하면 다른 쪽도 같은 답을 누름 ---------- */
  var mirroring = false;
  document.addEventListener('click', function (e) {
    if (mirroring) return;
    var r = e.target && e.target.closest ? e.target.closest('[role=radio]') : null;
    if (r) send({ type: 'click', label: r.getAttribute('aria-label') });
  }, true);

  /* ---------- 스크롤: 만지고 있는 화면만 상대 화면을 따라오게 함 ---------- */
  function scroller() {
    var best = null, h = 0;
    [].forEach.call(document.querySelectorAll('body *'), function (e) {
      if (e.scrollHeight > e.clientHeight + 50 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > h) { best = e; h = e.scrollHeight; }
    });
    return best || document.scrollingElement;
  }
  var active = 0, ignoreUntil = 0, tick = false;
  ['wheel', 'touchstart', 'touchmove', 'pointerdown', 'keydown'].forEach(function (n) {
    window.addEventListener(n, function () { active = Date.now(); }, { passive: true, capture: true });
  });
  document.addEventListener('scroll', function (e) {
    send({ type: 'pin-off' });
    [].forEach.call(document.querySelectorAll('.ux-on'), function (n) { n.classList.remove('ux-on'); });
    if (tick || Date.now() < ignoreUntil || Date.now() - active > 1200) return;
    tick = true;
    requestAnimationFrame(function () {
      tick = false;
      var s = scroller(), max = s.scrollHeight - s.clientHeight;
      send({ type: 'scroll', ratio: max > 0 ? s.scrollTop / max : 0 });
    });
  }, true);
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.src !== 'ux-parent') return;
    if (d.type === 'click') {
      var el = [].filter.call(document.querySelectorAll('[role=radio]'), function (x) { return x.getAttribute('aria-label') === d.label && x.getClientRects().length; })[0];
      if (el) { mirroring = true; try { el.click(); } finally { mirroring = false; } }
    } else if (d.type === 'scroll') {
      var s = scroller(), max = s.scrollHeight - s.clientHeight;
      ignoreUntil = Date.now() + 250; s.scrollTop = Math.max(0, d.ratio * max);
    } else if (d.type === 'pins') {
      document.documentElement.setAttribute('data-ux-pins', d.on ? 'on' : 'off');
    }
  });
})();
