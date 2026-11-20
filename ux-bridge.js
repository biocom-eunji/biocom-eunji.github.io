/* 비코 UX 개선안 · 화면 브리지
   AS-IS 앱(8776)과 TO-BE 화면(8775/tobe) 안에서 돌며
   ① ux-pins.js 의 점(핫스팟)을 화면에 붙이고
   ② 화면 이동 · 스크롤을 부모(쉘)에 알려 두 화면이 같이 움직이게 한다. */
(function () {
  if (window.parent === window) return;
  var VARIANT = /\/tobe\/tobe-/.test(location.pathname) ? 'tobe' : 'asis';
  var COLOR = VARIANT === 'asis' ? '#C4553F' : '#3FAFD3';
  var KEYS = { '/': 'home', '/goal/score': 'goal-score', '/completeness': 'completeness', '/care/식단': 'care', '/care/영양': 'care', '/care/스킨케어': 'care', '/care/배변': 'care', '/care/회복': 'care', '/record/diet/add': 'diet-add' };
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
    'html:not([data-ux-pins="on"]) .uxpin{display:none!important}';
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
    if (r) { var vis = [].filter.call(document.querySelectorAll('[role=radio]'), function (x) { return x.getClientRects().length; }); send({ type: 'click', label: r.getAttribute('aria-label'), idx: vis.indexOf(r) }); }
  }, true);

  /* ---------- 「홈(문진 후)」 칩: AS-IS 앱에는 완료 상태 값이 없어서, ?demo=checked 로 열리면 문진 문항을 가운데 표정으로 끝까지 대신 눌러 줌 ---------- */
  if (VARIANT === 'asis' && /[?&]demo=checked/.test(location.search)) {
    /* 문진을 대신 끝내는 과정은 보이지 않게 가리고(투명), 다 끝나면 완료 화면만 보여 준다(바로 화면이 뜬 것처럼). 안전장치: 6초 뒤에는 무조건 보여 줌 */
    /* 시간 빨리감기: 문진을 대신 끝내는 동안만 앱의 시계 · 타이머 · 애니메이션 프레임을 5배로 돌려 문항 넘김(슬라이드 · 스프링)을 줄임. 화면을 보여 주는 순간 원래 속도로 돌아옴(시간은 끊기지 않고 이어짐) */
    var K = 5, warp = true, rp = window.performance, rNow = rp.now.bind(rp), r0 = rNow(), d0 = Date.now(), rEnd = 0;
    var oRAF = window.requestAnimationFrame.bind(window), oST = window.setTimeout.bind(window), oSI = window.setInterval.bind(window), oCI = window.clearInterval.bind(window);
    var vt = function () { var r = rNow() - r0; return warp ? r * K : rEnd * K + (r - rEnd); };
    try {
      rp.now = function () { return r0 + vt(); }; Date.now = function () { return d0 + vt(); };
      window.requestAnimationFrame = function (cb) { return oRAF(function () { cb(rp.now()); }); };
      window.setTimeout = function (f, d) { var a = [].slice.call(arguments, 2); return oST.apply(window, [f, (d || 0) / (warp ? K : 1)].concat(a)); };
      window.setInterval = function (f, d) { var a = [].slice.call(arguments, 2); return oSI.apply(window, [f, (d || 0) / (warp ? K : 1)].concat(a)); };
    } catch (e) { warp = false; }
    var cover = document.createElement('style'); cover.id = 'ux-cover'; cover.textContent = '*{transition-duration:0s!important}#root{opacity:0!important}body::after{content:"문진 후 화면을 불러오는 중";position:fixed;left:0;right:0;top:46%;text-align:center;font:500 13px/1.4 -apple-system,sans-serif;color:#8a8d94}'; (document.head || document.documentElement).appendChild(cover);
    var reveal = function () { if (warp) { rEnd = rNow() - r0; warp = false; } if (cover.parentNode) { cover.textContent = '#root{opacity:1;transition:opacity .15s}body::after{content:none}'; oST(function () { cover.remove(); }, 250); } };
    oST(reveal, 6000);
    var tries = 0, clicked = 0, gone = 0, auto = oSI(function () {
      var rs = [].filter.call(document.querySelectorAll('[role=radio]'), function (x) { return x.getClientRects().length; });
      if (rs.length) { gone = 0; mirroring = true; try { rs[Math.min(2, rs.length - 1)].click(); clicked++; } finally { mirroring = false; } }
      else if (clicked) { if (++gone >= 4) { oCI(auto); reveal(); } }       /* 눌러 본 뒤 문항이 사라진 채 잠깐 가만 있으면 완료 */
      else if (++tries > 60) { oCI(auto); reveal(); }
    }, 60);
  }

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
      /* 두 화면의 표정 이름이 달라서(2단계 ↔ 별로 아니에요) 자리(몇 번째 표정)로 맞춤 */
      var vis2 = [].filter.call(document.querySelectorAll('[role=radio]'), function (x) { return x.getClientRects().length; });
      var el = d.idx >= 0 && vis2.length === 5 ? vis2[d.idx] : vis2.filter(function (x) { return x.getAttribute('aria-label') === d.label; })[0];
      if (el) { mirroring = true; try { el.click(); } finally { mirroring = false; } }
    } else if (d.type === 'scroll') {
      var s = scroller(), max = s.scrollHeight - s.clientHeight;
      ignoreUntil = Date.now() + 250; s.scrollTop = Math.max(0, d.ratio * max);
    } else if (d.type === 'pins') {
      document.documentElement.setAttribute('data-ux-pins', d.on ? 'on' : 'off');
    }
  });
})();
