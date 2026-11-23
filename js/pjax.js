(function () {
  'use strict';

  if (!window.history || !window.history.pushState || !window.fetch || !window.DOMParser) return;

  var BODY_ATTRS = [
    'class',
    'data-default-accent',
    'data-code-theme',
    'data-note-style',
    'data-note-icons',
    'data-button-style',
    'data-strong-accent'
  ];

  var isNavigating = false;

  function sameOrigin(url) {
    return url.origin === window.location.origin && /^https?:$/.test(url.protocol);
  }

  function isPjaxable(anchor) {
    if (anchor.hasAttribute('download')) return false;
    if (anchor.hasAttribute('data-pjax-disable')) return false;
    if (anchor.closest('[data-pjax-disable]')) return false;
    if (anchor.getAttribute('target') && anchor.getAttribute('target') !== '_self') return false;
    var href = anchor.getAttribute('href');
    if (!href) return false;
    if (/^(#|javascript:|mailto:|tel:|data:|blob:)/i.test(href)) return false;
    if (/\.(?:pdf|zip|rar|7z|tar|gz|mp3|wav|mp4|webm|png|jpe?g|gif|webp|svg|ico|txt|json|xml|woff2?)$/i.test(href.split(/[?#]/)[0])) return false;
    try {
      var url = new URL(anchor.href, window.location.href);
      if (!sameOrigin(url)) return false;
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return false;
      return true;
    } catch (error) {
      return false;
    }
  }

  function showProgress() {
    var bar = document.getElementById('flatpaper-pjax-progress');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'flatpaper-pjax-progress';
      bar.style.cssText = 'position:fixed;top:0;left:0;height:2px;width:0;z-index:10000;pointer-events:none;background:#f60;transition:width .25s ease,opacity .25s ease;';
      document.body.appendChild(bar);
    }
    bar.style.opacity = '1';
    bar.style.width = '55%';
  }

  function hideProgress() {
    var bar = document.getElementById('flatpaper-pjax-progress');
    if (!bar) return;
    bar.style.width = '100%';
    window.setTimeout(function () {
      bar.style.opacity = '0';
    }, 160);
  }

  function swapRegion(doc, selector, fallbackBefore) {
    var oldEl = document.querySelector(selector);
    var newEl = doc.querySelector(selector);

    if (!newEl) {
      if (oldEl && oldEl.parentNode) oldEl.parentNode.removeChild(oldEl);
      return;
    }

    if (oldEl && oldEl.parentNode) {
      oldEl.parentNode.replaceChild(newEl, oldEl);
      return;
    }

    var before = null;
    for (var i = 0; i < fallbackBefore.length; i++) {
      before = document.querySelector(fallbackBefore[i]);
      if (before) break;
    }
    if (before && before.parentNode) before.parentNode.insertBefore(newEl, before);
    else document.body.appendChild(newEl);
  }

  function applyDocument(doc) {
    document.title = doc.title || document.title;

    var fancybox = doc.documentElement.getAttribute('data-fancybox-enabled');
    if (fancybox) document.documentElement.setAttribute('data-fancybox-enabled', fancybox);
    else document.documentElement.removeAttribute('data-fancybox-enabled');

    var searchPanel = document.querySelector('.search-panel');
    if (searchPanel) {
      searchPanel.classList.remove('is-open');
      searchPanel.setAttribute('aria-hidden', 'true');
    }

    BODY_ATTRS.forEach(function (name) {
      var value = doc.body.getAttribute(name);
      if (name === 'class') {
        var keep = [];
        if (document.body.classList.contains('gm-night')) keep.push('gm-night');
        document.body.className = (value || '') + (keep.length ? ' ' + keep.join(' ') : '');
      } else if (value == null) {
        document.body.removeAttribute(name);
      } else {
        document.body.setAttribute(name, value);
      }
    });

    swapRegion(doc, '.home-hero', ['header.site-header', 'main.paper-shell', 'footer.site-footer', '.sidebar-backdrop', '.search-panel']);
    swapRegion(doc, 'header.site-header', ['main.paper-shell', 'footer.site-footer', '.sidebar-backdrop', '.search-panel']);
    swapRegion(doc, 'main.paper-shell', ['.sidebar-backdrop', 'footer.site-footer', '.search-panel']);
    swapRegion(doc, 'footer.site-footer', ['.search-panel', '.gm-float']);
  }

  function collectInlineScripts(root, bucket) {
    if (!root) return;
    var scripts = root.querySelectorAll('script');
    for (var i = 0; i < scripts.length; i++) bucket.push(scripts[i].cloneNode(true));
  }

  function runInlineScripts(scripts) {
    scripts.forEach(function (oldScript) {
      var script = document.createElement('script');
      var attrs = oldScript.attributes;
      for (var i = 0; i < attrs.length; i++) {
        script.setAttribute(attrs[i].name, attrs[i].value);
      }
      if (oldScript.src) {
        script.async = false;
        script.src = oldScript.src;
      } else {
        script.textContent = oldScript.textContent;
      }
      document.body.appendChild(script);
      if (!script.src) document.body.removeChild(script);
    });
  }

  function reloadMainScript() {
    document.querySelectorAll('script[data-flatpaper-main]').forEach(function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
    var script = document.createElement('script');
    script.src = '/js/main.js';
    script.async = false;
    script.setAttribute('data-flatpaper-main', '1');
    document.body.appendChild(script);
  }

  function refreshPlayerUI() {
    if (typeof window.flatpaperPlayerRemount === 'function') {
      try { window.flatpaperPlayerRemount(); } catch (error) { /* 播放器未就绪时忽略 */ }
    }
  }

  function trackPageview() {
    if (window.gtag) {
      try { window.gtag('config', 'G-12345678', { page_path: window.location.pathname + window.location.search }); } catch (error) { /* noop */ }
    }
    if (window.umami && typeof window.umami.track === 'function') {
      try { window.umami.track(); } catch (error) { /* noop */ }
    }
  }

  function navigate(href, isPop) {
    if (isNavigating) return;
    isNavigating = true;
    showProgress();

    window.fetch(href, {
      credentials: 'same-origin',
      headers: { 'X-Flatpaper-PJAX': '1' }
    }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.text();
    }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      if (!doc.body) throw new Error('Invalid document');

      var scripts = [];
      ['.home-hero', 'header.site-header', 'main.paper-shell', 'footer.site-footer'].forEach(function (selector) {
        var node = doc.querySelector(selector);
        if (node) collectInlineScripts(node, scripts);
      });

      applyDocument(doc);

      if (!isPop) window.history.pushState({ flatpaperPjax: true }, '', href);

      var hash = window.location.hash;
      var hashTarget = null;
      if (hash) {
        try { hashTarget = document.getElementById(decodeURIComponent(hash.slice(1))); } catch (error) { /* noop */ }
      }
      if (hashTarget) hashTarget.scrollIntoView();
      else window.scrollTo(0, 0);

      runInlineScripts(scripts);
      reloadMainScript();
      refreshPlayerUI();
      trackPageview();
      hideProgress();
    }).catch(function () {
      window.location.href = href;
    }).then(function () {
      isNavigating = false;
    });
  }

  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var target = event.target;
    if (target && target.nodeType !== 1) target = target.parentNode;
    var anchor = target && target.closest ? target.closest('a[href]') : null;
    if (!anchor || !isPjaxable(anchor)) return;
    event.preventDefault();
    navigate(anchor.href, false);
  });

  window.addEventListener('popstate', function () {
    navigate(window.location.href, true);
  });

  if (!window.history.state) {
    try { window.history.replaceState({ flatpaperPjax: true }, '', window.location.href); } catch (error) { /* noop */ }
  }
})();
