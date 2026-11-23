(function () {
  'use strict';

  var CONFIG = {
    api: 'https://api.i-meto.com/meting/api',
    songId: '',
    playlistId: '18627532243',
    cacheHours: 6
  };

  var STATE_KEY = 'flatpaper-gm-player-v1';
  var THEME_KEY = 'flatpaper-gm-theme';
  var MODES = ['list', 'single', 'shuffle'];

  var ICON = {
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h2v14H4V5zm15 0v14L8 12 19 5z"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l11 7-11 7V5zm13 0h2v14h-2V5z"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4.8v14.4L19 12 8 4.8z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 5h3.6v14H6.5V5zm7.4 0h3.6v14h-3.6V5z"/></svg>',
    note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v10.6A4 4 0 1 0 14 17V7.2h4.2V3H12z"/></svg>',
    loop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h9V4l5 4-5 4V9H9v4H7V7zm10 10H8v3l-5-4 5-4v3h8v-4h2v6z"/></svg>',
    loopOne: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h9V4l5 4-5 4V9H9v4H7V7zm10 10H8v3l-5-4 5-4v3h8v-4h2v6zM12 10h1v6h-2v-4h1z"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3l4 4-4 4V8h-2.2c-1.3 0-2.2.5-3.1 1.6L9 13.4C8.1 14.6 7 15 5.6 15H3v-2h2.6c.8 0 1.3-.3 1.9-1.1l2.7-3.7C11 6.8 12.2 6 14.8 6H17V3zM3 9h2.6c1.3 0 2.2.5 3.1 1.6l.7 1-1.5 1.3-.8-1.1c-.5-.7-1-1-1.5-1H3V9zm14 4v-2l4 4-4 4v-2h-2.2c-2.6 0-3.8-.8-5-2.6l-.8-1.1 1.5-1.3.7 1c.9 1.1 1.8 1.6 3.1 1.6H17z"/></svg>',
    volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4V9zm12.5-1.2a6 6 0 0 1 0 8.4l-1.4-1.4a4 4 0 0 0 0-5.6l1.4-1.4zm2.8-2.8a10 10 0 0 1 0 14l-1.4-1.4a8 8 0 0 0 0-11.2l1.4-1.4z"/></svg>',
    volumeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4V9zm12.6 1.4L18 9l1.4 1.4-1.6 1.6 1.6 1.6L18 15l-1.4-1.4-1.6 1.6L13.6 14l1.6-1.6-1.6-1.6 1.4-1.4 1.6 1.6z"/></svg>'
  };

  var state = {
    tracks: [],
    index: 0,
    currentTime: 0,
    volume: 0.8,
    playing: false,
    mode: 'list',
    muted: false
  };

  var theme = 'day';
  var lyricLines = [];
  var cards = [];
  var restorePending = true;
  var saveTimer = 0;
  var lrcRequest = 0;

  var audio = new Audio();
  audio.preload = 'auto';
  audio.volume = state.volume;

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    return pad(Math.floor(seconds / 60)) + ':' + pad(Math.floor(seconds % 60));
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function currentTrack() {
    return state.tracks[state.index] || null;
  }

  function setHint(message) {
    cards.forEach(function (card) {
      var hint = $('.gm-hint', card);
      if (hint) hint.textContent = message || '';
    });
  }

  function applyTheme(value, persist) {
    theme = value === 'night' ? 'night' : 'day';
    document.body.classList.toggle('gm-night', theme === 'night');
    $$('[data-gm="theme"]').forEach(function (button) {
      button.textContent = theme === 'night' ? '☀' : '☾';
      button.title = theme === 'night' ? '切换日间主题' : '切换暗夜主题';
    });
    if (persist) {
      try { localStorage.setItem(THEME_KEY, theme); } catch (error) { /* 忽略存储限制 */ }
    }
  }

  function fetchJSON(url) {
    return fetch(url, { credentials: 'omit' }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    });
  }

  function loadTracks() {
    var requests = [
      fetchJSON(CONFIG.api + '?server=netease&type=song&id=' + CONFIG.songId).catch(function () { return []; }),
      fetchJSON(CONFIG.api + '?server=netease&type=playlist&id=' + CONFIG.playlistId).catch(function () { return []; })
    ];

    return Promise.all(requests).then(function (results) {
      var tracks = [];
      var seen = {};
      results.forEach(function (list) {
        if (!Array.isArray(list)) return;
        list.forEach(function (track) {
          if (!track || !track.url || !track.title) return;
          var key = track.title + '|' + track.author;
          if (seen[key]) return;
          seen[key] = 1;
          tracks.push(track);
        });
      });
      if (!tracks.length) throw new Error('empty playlist');
      return tracks;
    });
  }

  function restore() {
    var saved = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null');
    } catch (error) {
      return false;
    }
    if (!saved || !Array.isArray(saved.tracks) || !saved.tracks.length) return false;
    if (saved.savedAt && Date.now() - saved.savedAt > CONFIG.cacheHours * 3600000) return false;

    state.tracks = saved.tracks;
    state.index = typeof saved.index === 'number' && saved.index < saved.tracks.length ? saved.index : 0;
    state.currentTime = typeof saved.currentTime === 'number' ? saved.currentTime : 0;
    state.volume = typeof saved.volume === 'number' ? saved.volume : 0.8;
    state.playing = saved.playing === true;
    state.mode = MODES.indexOf(saved.mode) > -1 ? saved.mode : 'list';
    state.muted = saved.muted === true;
    audio.volume = state.volume;
    audio.muted = state.muted;
    return true;
  }

  function save() {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({
        savedAt: Date.now(),
        tracks: state.tracks,
        index: state.index,
        currentTime: audio.currentTime || state.currentTime,
        playing: state.playing || !audio.paused,
        volume: state.volume,
        mode: state.mode,
        muted: state.muted
      }));
    } catch (error) {
      /* 隐私模式下 sessionStorage 可能不可写 */
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 600);
  }

  function playAudio() {
    var promise = audio.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch(function () {
        state.playing = false;
        render();
        setHint('当前歌曲音源不可用，自动切换下一首');
      });
    }
  }

  function parseLRC(text) {
    var credits = [];
    var lines = [];
    var hasTimedLine = false;

    text.split(/\r?\n/).forEach(function (row) {
      var meta = row.match(/^\[(ar|ti|by|album|offset):([^\]]*)\]$/i);
      if (meta) {
        if (meta[1].toLowerCase() === 'ar' && meta[2].trim()) credits.push('歌手：' + meta[2].trim());
        return;
      }

      var timed = row.match(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]([\s\S]*)$/);
      if (timed) {
        hasTimedLine = true;
        var content = timed[4].trim();
        if (!content) return;
        var seconds = parseInt(timed[1], 10) * 60 + parseInt(timed[2], 10);
        if (timed[3]) seconds += parseInt(timed[3], 10) / Math.pow(10, timed[3].length);
        lines.push({ time: seconds, text: content });
        return;
      }

      if (!hasTimedLine) {
        var plain = row.replace(/^\[[^\]]+\]\s*/, '').trim();
        if (plain) credits.push(plain);
      }
    });

    lines.sort(function (a, b) { return a.time - b.time; });
    return { credits: credits, lines: lines };
  }

  function highlightLyric() {
    if (!lyricLines.length) return;
    var host = $('.gm-lyrics');
    if (!host) return;

    var active = -1;
    for (var i = 0; i < lyricLines.length; i++) {
      if (audio.currentTime >= lyricLines[i].time) active = i;
      else break;
    }

    var nodes = $$('.gm-lrc-line', host);
    nodes.forEach(function (node, index) {
      node.classList.toggle('is-active', index === active);
    });

    if (active >= 0 && nodes[active]) {
      var panel = host.parentNode;
      var target = nodes[active].offsetTop - panel.clientHeight / 2 + nodes[active].offsetHeight / 2;
      panel.scrollTop = Math.max(0, target);
    }
  }

  function renderLyrics(data) {
    var host = $('.gm-lyrics');
    if (!host) return;

    var html = '';
    data.credits.forEach(function (credit) {
      var main = /^(编曲|作词|作曲|制作人|歌手)/.test(credit);
      html += '<div class="gm-credit' + (main ? ' gm-credit--main' : '') + '">' + escapeHTML(credit) + '</div>';
    });
    if (!data.lines.length && !data.credits.length) {
      html = '<div class="gm-lrc-empty">暂无歌词</div>';
    }
    data.lines.forEach(function (line) {
      html += '<div class="gm-lrc-line">' + escapeHTML(line.text) + '</div>';
    });

    host.innerHTML = html;
    lyricLines = data.lines;
    highlightLyric();
  }

  function loadLyrics(track) {
    lrcRequest++;
    var requestId = lrcRequest;
    lyricLines = [];
    var host = $('.gm-lyrics');
    if (host) host.innerHTML = '<div class="gm-lrc-empty">歌词加载中…</div>';
    if (!track || !track.lrc) {
      if (host) host.innerHTML = '<div class="gm-lrc-empty">暂无歌词</div>';
      return;
    }

    fetch(track.lrc).then(function (response) {
      if (!response.ok) throw new Error('lrc failed');
      return response.text();
    }).then(function (text) {
      if (requestId === lrcRequest) renderLyrics(parseLRC(text));
    }).catch(function () {
      if (requestId === lrcRequest && host) host.innerHTML = '<div class="gm-lrc-empty">暂无歌词</div>';
    });
  }

  function renderPlaylist() {
    var host = $('.gm-playlist');
    if (!host) return;
    if (!state.tracks.length) {
      host.innerHTML = '<div class="gm-lrc-empty">歌单加载中…</div>';
      return;
    }
    var html = '';
    state.tracks.forEach(function (track, index) {
      html += '<div class="gm-list-item' + (index === state.index ? ' is-active' : '') + '" data-gm="pick" data-index="' + index + '" role="button" tabindex="0">' +
        '<span class="gm-list-index">' + (index + 1) + '</span>' +
        '<span class="gm-list-title">' + escapeHTML(track.title) + '</span>' +
        '<span class="gm-list-artist">' + escapeHTML(track.author || '') + '</span>' +
        '</div>';
    });
    host.innerHTML = html;
  }

  function loadCurrent(autoplay) {
    var track = currentTrack();
    if (!track) return;
    restorePending = true;
    audio.src = track.url;
    audio.load();
    if (autoplay) playAudio();
    render();
    renderPlaylist();
    loadLyrics(track);
  }

  function next(forcePlay) {
    if (!state.tracks.length) return;
    if (state.mode === 'single' && forcePlay === true) {
      try { audio.currentTime = 0; } catch (error) { /* 忽略 */ }
      playAudio();
      return;
    }
    if (state.mode === 'shuffle' && state.tracks.length > 1) {
      var picked = state.index;
      while (picked === state.index) picked = Math.floor(Math.random() * state.tracks.length);
      state.index = picked;
    } else {
      state.index = (state.index + 1) % state.tracks.length;
    }
    state.currentTime = 0;
    setHint('');
    loadCurrent(forcePlay === true || state.playing);
    save();
  }

  function previous() {
    if (!state.tracks.length) return;
    if (audio.currentTime > 4) {
      try { audio.currentTime = 0; } catch (error) { /* 忽略 */ }
      return;
    }
    state.index = (state.index - 1 + state.tracks.length) % state.tracks.length;
    state.currentTime = 0;
    setHint('');
    loadCurrent(state.playing);
    save();
  }

  function pick(index) {
    if (index < 0 || index >= state.tracks.length) return;
    state.index = index;
    state.currentTime = 0;
    setHint('');
    loadCurrent(true);
    save();
  }

  function cycleMode() {
    state.mode = MODES[(MODES.indexOf(state.mode) + 1) % MODES.length];
    updateModeUI();
    save();
  }

  function updateModeUI() {
    var labels = { list: '列表循环', single: '单曲循环', shuffle: '随机播放' };
    cards.forEach(function (card) {
      var button = $('.gm-loop', card);
      if (!button) return;
      button.innerHTML = state.mode === 'single' ? ICON.loopOne : (state.mode === 'shuffle' ? ICON.shuffle : ICON.loop);
      button.title = labels[state.mode];
      button.setAttribute('aria-label', labels[state.mode]);
    });
  }

  function updateMuteUI() {
    cards.forEach(function (card) {
      var button = $('.gm-mute', card);
      if (!button) return;
      button.innerHTML = audio.muted || state.volume === 0 ? ICON.volumeOff : ICON.volume;
      button.title = audio.muted ? '取消静音' : '静音';
    });
  }

  function updateProgress() {
    var duration = audio.duration || 0;
    var played = audio.currentTime || 0;
    var ratio = duration ? Math.min(1, played / duration) : 0;

    cards.forEach(function (card) {
      var fill = $('.gm-fill', card);
      var dot = $('.gm-dot', card);
      var current = $('.gm-cur', card);
      var total = $('.gm-dur', card);
      if (fill) fill.style.width = (ratio * 100).toFixed(2) + '%';
      if (dot) dot.style.left = (ratio * 100).toFixed(2) + '%';
      if (current) current.textContent = formatTime(played);
      if (total) total.textContent = formatTime(duration);
    });
  }

  function render() {
    var track = currentTrack();
    var title = track ? track.title : '加载中…';
    var artist = track ? track.author : 'Meting Music';
    var pic = track && track.pic ? track.pic : '';

    cards.forEach(function (card) {
      var titleEl = $('.gm-title', card);
      var artistEl = $('.gm-artist', card);
      var cover = $('.gm-cover-img', card);
      var bg = $('.gm-card__bg', card);
      var playButton = $('.gm-play', card);

      if (titleEl) titleEl.textContent = title;
      if (artistEl) artistEl.textContent = artist;
      if (cover && cover.getAttribute('src') !== pic) cover.setAttribute('src', pic);
      if (bg) bg.style.backgroundImage = pic ? 'url("' + pic.replace(/"/g, '%22') + '")' : 'none';
      if (playButton) playButton.innerHTML = state.playing ? ICON.pause : ICON.play;
    });

    var fab = $('.gm-fab');
    if (fab) {
      var fabImage = $('.gm-fab-img', fab);
      if (fabImage && pic && fabImage.getAttribute('src') !== pic) fabImage.setAttribute('src', pic);
      fab.classList.toggle('is-playing', state.playing);
    }
    updateModeUI();
    updateMuteUI();
    updateProgress();
  }

  function playerCardMarkup(compact) {
    return '' +
      '<div class="gm-card__bg"></div>' +
      '<button class="gm-theme-toggle" type="button" data-gm="theme" aria-label="切换暗夜主题">☾</button>' +
      '<div class="gm-vinyl-wrap">' +
        '<div class="gm-vinyl"><img class="gm-cover-img" alt=""><span class="gm-vinyl-hole"></span></div>' +
      '</div>' +
      '<div class="gm-song">' +
        '<div class="gm-title">加载中…</div>' +
        '<div class="gm-artist">Meting Music</div>' +
      '</div>' +
      '<div class="gm-progress">' +
        '<div class="gm-track" data-gm="seek" role="slider" aria-label="播放进度">' +
          '<div class="gm-fill"></div><div class="gm-dot"></div>' +
        '</div>' +
        '<div class="gm-time"><span class="gm-cur">00:00</span><span class="gm-dur">00:00</span></div>' +
      '</div>' +
      '<div class="gm-actions">' +
        '<button class="gm-btn gm-loop" type="button" data-gm="loop" aria-label="播放模式">' + ICON.loop + '</button>' +
        '<button class="gm-btn gm-prev" type="button" data-gm="prev" aria-label="上一首">' + ICON.prev + '</button>' +
        '<button class="gm-btn gm-play" type="button" data-gm="toggle" aria-label="播放或暂停">' + ICON.play + '</button>' +
        '<button class="gm-btn gm-next" type="button" data-gm="next" aria-label="下一首">' + ICON.next + '</button>' +
        '<button class="gm-btn gm-mute" type="button" data-gm="mute" aria-label="静音">' + ICON.volume + '</button>' +
      '</div>' +
      '<div class="gm-hint" aria-live="polite"></div>';
  }

  function sideCardMarkup() {
    return '' +
      '<div class="gm-tabs">' +
        '<div class="gm-tab-group">' +
          '<button class="gm-tab is-active" type="button" data-gm="tab-lrc">歌词</button>' +
          '<button class="gm-tab" type="button" data-gm="tab-list">歌单</button>' +
        '</div>' +
      '</div>' +
      '<div class="gm-panel gm-panel--lrc is-active"><div class="gm-lyrics"><div class="gm-lrc-empty">歌词加载中…</div></div></div>' +
      '<div class="gm-panel gm-panel--list"><div class="gm-playlist"></div></div>';
  }

  function mount() {
    var pageHost = document.getElementById('gm-page-player');
    var oldFloat = $('.gm-float');
    cards = [];

    if (pageHost) {
      document.body.classList.add('gm-has-page-player');
      if (oldFloat && oldFloat.parentNode) oldFloat.parentNode.removeChild(oldFloat);
      pageHost.innerHTML =
        '<div class="gm-stage">' +
          '<div class="gm-card gm-card--player">' + playerCardMarkup(false) + '</div>' +
          '<div class="gm-card gm-card--side">' + sideCardMarkup() + '</div>' +
        '</div>';
      cards.push($('.gm-card--player', pageHost));
      return;
    }

    document.body.classList.remove('gm-has-page-player');
    var float = oldFloat;
    if (!float) {
      float = document.createElement('div');
      float.className = 'gm-float';
      float.innerHTML =
        '<div class="gm-card gm-card--compact">' + playerCardMarkup(true) + '</div>' +
        '<button class="gm-fab" type="button" data-gm="expand" aria-label="展开播放器">' +
          '<img class="gm-fab-img" alt="">' +
          '<span class="gm-fab-note">' + ICON.note + '</span>' +
        '</button>';
      document.body.appendChild(float);
    }
    cards.push($('.gm-card--compact', float));
  }

  function switchTab(name) {
    $$('.gm-tab').forEach(function (tab) {
      tab.classList.toggle('is-active', tab.getAttribute('data-gm') === 'tab-' + name);
    });
    $$('.gm-panel').forEach(function (panel) {
      panel.classList.toggle('is-active', panel.classList.contains('gm-panel--' + name));
    });
  }

  function bindEvents() {
    document.addEventListener('click', function (event) {
      var target = event.target;
      if (target && target.nodeType !== 1) target = target.parentNode;
      var button = target && target.closest ? target.closest('[data-gm]') : null;
      if (!button) return;

      var action = button.getAttribute('data-gm');

      if (action === 'toggle') {
        if (!audio.paused) {
          audio.pause();
        } else if (!audio.src) {
          setHint('歌单加载中，请稍候');
        } else {
          playAudio();
        }
      } else if (action === 'prev') {
        previous();
      } else if (action === 'next') {
        next();
      } else if (action === 'expand') {
        var float = $('.gm-float');
        if (float) float.classList.toggle('is-open');
      } else if (action === 'theme') {
        applyTheme(theme === 'night' ? 'day' : 'night', true);
      } else if (action === 'loop') {
        cycleMode();
      } else if (action === 'mute') {
        audio.muted = !audio.muted;
        updateMuteUI();
        save();
      } else if (action === 'tab-lrc' || action === 'tab-list') {
        switchTab(action === 'tab-lrc' ? 'lrc' : 'list');
      } else if (action === 'pick') {
        pick(parseInt(button.getAttribute('data-index'), 10));
      } else if (action === 'seek') {
        var duration = audio.duration;
        if (!duration || !isFinite(duration)) return;
        var rect = button.getBoundingClientRect();
        var ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        try { audio.currentTime = ratio * duration; } catch (error) { /* 忽略不可跳转的音源 */ }
      }
    });

    audio.addEventListener('loadedmetadata', function () {
      if (restorePending) {
        try {
          audio.currentTime = Math.min(state.currentTime, audio.duration || 0);
        } catch (error) { /* 忽略 */ }
        restorePending = false;
        save();
      }
      render();
    });
    audio.addEventListener('timeupdate', function () {
      state.currentTime = audio.currentTime;
      updateProgress();
      highlightLyric();
      scheduleSave();
    });
    audio.addEventListener('play', function () {
      state.playing = true;
      render();
      save();
    });
    audio.addEventListener('pause', function () {
      state.playing = false;
      render();
      save();
    });
    audio.addEventListener('ended', function () {
      next(true);
    });
    audio.addEventListener('error', function () {
      setHint('当前歌曲音源不可用，点“下一首”试试');
    });
    audio.addEventListener('volumechange', function () {
      state.volume = audio.volume;
      state.muted = audio.muted;
      updateMuteUI();
    });

    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) save();
    });
  }

  function init() {
    var savedTheme = 'day';
    try { savedTheme = localStorage.getItem(THEME_KEY) || 'day'; } catch (error) { /* 忽略 */ }
    applyTheme(savedTheme, false);

    mount();
    bindEvents();
    render();
    renderPlaylist();

    window.flatpaperPlayerRemount = function () {
      mount();
      render();
      renderPlaylist();
      loadLyrics(currentTrack());
    };

    if (restore()) {
      loadCurrent(state.playing);
      return;
    }

    loadTracks().then(function (tracks) {
      state.tracks = tracks;
      state.index = 0;
      state.currentTime = 0;
      loadCurrent(false);
      save();
    }).catch(function () {
      setHint('歌单加载失败，请检查网络，或点击页面下方链接去网易云收听');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
