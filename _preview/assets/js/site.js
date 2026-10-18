/* ==========================================================================
   Site behaviour. No dependencies. Every feature checks its markup exists.
     theme toggle · sticky nav · mobile menu · project filters · footage reel
     scroll reveals · YouTube facade · gallery strip · image lightbox
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- theme toggle ---------- */
  var toggle = document.getElementById('theme-toggle');
  function labelTheme() {
    if (!toggle) return;
    var dark = root.getAttribute('data-theme') === 'dark';
    toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }
  if (toggle) {
    labelTheme();
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      labelTheme();
    });
  }

  /* ---------- hairline under the nav once the page scrolls ---------- */
  var nav = document.getElementById('nav');
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      if (nav) nav.classList.toggle('is-stuck', (window.scrollY || window.pageYOffset) > 8);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- mobile menu ---------- */
  var burger = document.getElementById('nav-burger');
  var mobile = document.getElementById('nav-mobile');
  function setMenu(open) {
    mobile.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  if (burger && mobile) {
    burger.addEventListener('click', function () { setMenu(!mobile.classList.contains('is-open')); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobile.classList.contains('is-open')) { setMenu(false); burger.focus(); }
    });
  }

  /* ---------- project filters (/projects/) ---------- */
  var chips = document.querySelectorAll('.chip[data-filter]');
  if (chips.length) {
    var items = document.querySelectorAll('[data-domains]');
    var empty = document.querySelector('.filter-empty');
    var apply = function (f, push) {
      var known = false;
      chips.forEach(function (c) {
        var on = c.getAttribute('data-filter') === f;
        if (on) known = true;
        c.setAttribute('aria-pressed', String(on));
      });
      if (!known) return apply('all', push);
      var shown = 0;
      items.forEach(function (el) {
        var match = f === 'all' || (' ' + el.getAttribute('data-domains')).indexOf(' ' + f + ' ') > -1;
        el.classList.toggle('is-filtered', !match);
        if (match) shown++;
      });
      if (empty) empty.classList.toggle('is-shown', shown === 0);
      if (push && history.replaceState) history.replaceState(null, '', f === 'all' ? location.pathname : '#' + f);
    };
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () { apply(chip.getAttribute('data-filter'), true); });
    });
    var h = location.hash.slice(1).toLowerCase();
    if (h && document.querySelector('.chip[data-filter="' + h + '"]')) apply(h, false);
  }

  /* ---------- footage reel (home) ---------- */
  var reel = document.getElementById('reel');
  if (reel) {
    var vid = reel.querySelector('video');
    var btn = document.getElementById('reel-toggle');
    var link = document.getElementById('reel-link');
    var title = document.getElementById('reel-title');
    var detail = document.getElementById('reel-detail');
    var dots = reel.querySelectorAll('.reel__dots i');
    var clips = [];
    try { clips = JSON.parse(reel.getAttribute('data-clips')) || []; } catch (e) {}
    var current = 0;

    var setPaused = function (paused) {
      reel.classList.toggle('is-paused', paused);
      btn.setAttribute('aria-pressed', String(paused));
      btn.querySelector('span').textContent = paused ? 'Play' : 'Pause';
      if (paused) vid.pause(); else { var p = vid.play(); if (p && p.catch) p.catch(function () {}); }
    };
    btn.addEventListener('click', function () { setPaused(!vid.paused); });
    // reduced motion: start paused on the poster, the visitor can still press Play
    if (calm) setPaused(true);

    vid.addEventListener('timeupdate', function () {
      var t = vid.currentTime, i = 0;
      for (var k = 0; k < clips.length; k++) if (t >= clips[k].start) i = k;
      if (i === current || !clips[i]) return;
      current = i;
      title.textContent = clips[i].title;
      detail.textContent = clips[i].detail;
      link.setAttribute('href', clips[i].link);
      dots.forEach(function (d, k) { d.classList.toggle('is-on', k === i); });
    });
  }

  /* ---------- scroll reveals: short and light, About-page style ---------- */
  if ('IntersectionObserver' in window && !calm) {
    var targets = document.querySelectorAll('.card, .row-item, .tl__item, .skill, .pub, .news__row, .interest, .workshop');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.classList.add('is-in');
        io.unobserve(el);
        setTimeout(function () { el.style.transitionDelay = ''; }, 800);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    targets.forEach(function (el) {
      // only things below the fold animate; what is already visible stays put
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
      var i = el.parentNode ? Array.prototype.indexOf.call(el.parentNode.children, el) : 0;
      if (el.classList.contains('card') || el.classList.contains('interest')) el.style.transitionDelay = (i % 3) * 70 + 'ms';
      else if (el.classList.contains('skill')) el.style.transitionDelay = Math.min(i, 8) * 30 + 'ms';
      el.classList.add('rv');
      io.observe(el);
    });
  }

  /* ---------- YouTube: thumbnail first, player on click ---------- */
  document.querySelectorAll('.yt').forEach(function (box) {
    var play = box.querySelector('.yt__play');
    if (!play) return;
    play.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube.com/embed/' + box.getAttribute('data-id') + '?autoplay=1&rel=0&playsinline=1';
      f.title = (play.getAttribute('aria-label') || 'YouTube video').replace(' (loads YouTube)', '');
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
      f.setAttribute('allowfullscreen', '');
      f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      box.innerHTML = '';
      box.appendChild(f);
      f.focus();
    });
  });

  /* ---------- gallery strip arrows ---------- */
  document.querySelectorAll('.gallery').forEach(function (g) {
    var strip = g.querySelector('.strip');
    g.querySelectorAll('.strip-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        strip.scrollBy({ left: Number(b.getAttribute('data-dir')) * strip.clientWidth * 0.8, behavior: calm ? 'auto' : 'smooth' });
      });
    });
  });

  /* ---------- image lightbox ---------- */
  var shots = Array.prototype.slice.call(document.querySelectorAll('a.zoom'));
  if (shots.length) {
    var box = document.createElement('div');
    box.className = 'lb';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Image viewer');
    box.innerHTML =
      '<button class="lb__close" type="button" aria-label="Close image viewer">×</button>' +
      (shots.length > 1 ? '<button class="lb__prev" type="button" aria-label="Previous image">‹</button>' : '') +
      '<figure><img alt=""><figcaption></figcaption></figure>' +
      (shots.length > 1 ? '<button class="lb__next" type="button" aria-label="Next image">›</button>' : '');
    document.body.appendChild(box);
    var img = box.querySelector('img'), cap = box.querySelector('figcaption');
    var at = 0, opener = null;

    var show = function (i) {
      at = (i + shots.length) % shots.length;
      img.src = shots[at].getAttribute('href');
      img.alt = cap.textContent = shots[at].getAttribute('data-caption') || '';
    };
    var open = function (i) {
      opener = document.activeElement;
      show(i);
      box.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      box.querySelector('.lb__close').focus();
    };
    var close = function () {
      box.classList.remove('is-open');
      document.body.style.overflow = '';
      if (opener && opener.focus) opener.focus();
    };

    shots.forEach(function (a, i) {
      a.addEventListener('click', function (e) { e.preventDefault(); open(i); });
    });
    box.querySelector('.lb__close').addEventListener('click', close);
    var prev = box.querySelector('.lb__prev'), next = box.querySelector('.lb__next');
    if (prev) prev.addEventListener('click', function () { show(at - 1); });
    if (next) next.addEventListener('click', function () { show(at + 1); });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft' && prev) show(at - 1);
      else if (e.key === 'ArrowRight' && next) show(at + 1);
      else if (e.key === 'Tab') {
        // keep focus inside the dialog
        var f = box.querySelectorAll('button');
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }
})();
