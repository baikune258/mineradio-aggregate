// 创作者专区（二改新增）：浏览已审核上架的作品并播放
(function () {
  'use strict';
  var API = '/api/creator';

  var panelEl = null;
  var overlayEl = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function toast(msg) {
    if (typeof showToast === 'function') showToast(msg);
    else if (typeof window.showToast === 'function') window.showToast(msg);
  }
  function isMemberActive() {
    return typeof window.isMineradioMemberActive === 'function' && window.isMineradioMemberActive();
  }

  function panelStyles() {
    if (document.getElementById('mr-browse-styles')) return;
    var s = document.createElement('style');
    s.id = 'mr-browse-styles';
    s.textContent = [
      '#mr-browse-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99996}',
      '#mr-browse-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:420px;max-height:82vh;overflow-y:auto;background:#16161d;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:20px;z-index:99997;color:#eee;font-size:13px;box-shadow:0 18px 50px rgba(0,0,0,.5)}',
      '#mr-browse-panel h3{margin:0 0 6px;font-size:16px;color:#fff}',
      '.mb-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.mb-card{background:rgba(255,255,255,.05);border-radius:12px;padding:10px 12px;margin:8px 0;cursor:pointer;transition:background .15s}',
      '.mb-card:hover{background:rgba(255,255,255,.1)}',
      '.mb-badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:8px;margin-left:6px}',
      '.mb-badge.vip{background:rgba(168,85,247,.25);color:#d8b4fe}',
      '.mb-badge.free{background:rgba(148,163,184,.2);color:#cbd5e1}',
      '.mb-close{position:absolute;right:14px;top:10px;background:none;border:none;color:#aaa;font-size:20px;cursor:pointer}',
      '.mb-dim{color:#889}',
      '.mb-play{margin-left:auto;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;color:#fff;border-radius:10px;padding:5px 12px;font-size:12px;cursor:pointer}',
    ].join('\n');
    document.head.appendChild(s);
  }

  function closePanel() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    if (panelEl) { panelEl.remove(); panelEl = null; }
  }

  function openBrowse() {
    if (panelEl) { panelEl.style.display = ''; if (overlayEl) overlayEl.style.display = ''; return; }
    panelStyles();
    overlayEl = el('div');
    overlayEl.id = 'mr-browse-overlay';
    overlayEl.onclick = closePanel;
    document.body.appendChild(overlayEl);
    panelEl = el('div');
    panelEl.id = 'mr-browse-panel';
    var closeBtn = el('button', 'mb-close', '×');
    closeBtn.onclick = closePanel;
    panelEl.appendChild(closeBtn);
    panelEl.appendChild(el('h3', '', '创作者专区'));
    panelEl.appendChild(el('div', 'mb-dim', '已上架的创作者原创作品'));
    var listBox = el('div');
    panelEl.appendChild(listBox);
    listBox.appendChild(el('div', 'mb-dim', '加载中…'));
    fetch(API + '/songs')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        listBox.innerHTML = '';
        var songs = d.ok ? (d.songs || []) : [];
        if (!songs.length) { listBox.appendChild(el('div', 'mb-dim', '暂无作品上架')); return; }
        songs.forEach(function (s) {
          var card = el('div', 'mb-card');
          var head = el('div', 'mb-row');
          var info = el('div');
          var nameLine = el('div', '');
          nameLine.appendChild(document.createTextNode(s.title + ' — ' + s.artist));
          var badge = el('span', 'mb-badge ' + (s.memberOnly ? 'vip' : 'free'), s.memberOnly ? '会员' : '免费');
          nameLine.appendChild(badge);
          info.appendChild(nameLine);
          info.appendChild(el('div', 'mb-dim', '创作者：' + s.creatorName + ' ｜ 播放 ' + (s.playsFree + s.playsMember) + ' 次'));
          head.appendChild(info);
          var playBtn = el('button', 'mb-play', '播放');
          playBtn.onclick = function (ev) {
            ev.stopPropagation();
            playCreatorSong(s);
          };
          head.appendChild(playBtn);
          card.appendChild(head);
          card.onclick = function () { playCreatorSong(s); };
          listBox.appendChild(card);
        });
      })
      .catch(function () { listBox.innerHTML = ''; listBox.appendChild(el('div', 'mb-dim', '加载失败')); });
    document.body.appendChild(panelEl);
  }

  function playCreatorSong(s) {
    if (s.memberOnly && !isMemberActive()) {
      toast('会员专属歌曲，请先激活会员');
      if (typeof window.openMineradioMemberPanel === 'function') window.openMineradioMemberPanel();
      return;
    }
    // 播放计数
    try {
      fetch(API + '/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: s.id, isMember: isMemberActive() }),
      }).catch(function () {});
    } catch (_) {}
    var song = {
      name: s.title,
      artist: s.artist,
      localUrl: '/api/creator/audio/' + s.id,
      localKey: 'creator-' + s.id,
      memberOnly: s.memberOnly,
      coverUrl: s.coverFile ? '/api/creator/cover/' + s.id : '',
      provider: 'creator',
    };
    try {
      if (typeof playQueue !== 'undefined' && Array.isArray(playQueue)) {
        playQueue.push(song);
        if (typeof playQueueAt === 'function') {
          playQueueAt(playQueue.length - 1, { manual: true });
          return;
        }
      }
    } catch (_) {}
    toast('播放失败：播放核心未就绪');
  }

  // "开始听歌"兜底：优先播放创作者专区已上架的免费歌（无需登录）；没有则平台热门搜索自动播放
  function tryPlayCreatorFreeFallback() {
    return fetch(API + '/songs')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var free = (d.ok && d.songs || []).filter(function (s) { return s.status === 'approved' && !s.memberOnly; });
        if (!free.length) return playHotSearchFallback();
        var queue = free.map(function (s) {
          return {
            name: s.title,
            artist: s.artist,
            localUrl: '/api/creator/audio/' + s.id,
            localKey: 'creator-' + s.id,
            memberOnly: false,
            provider: 'creator',
            coverUrl: s.coverFile ? '/api/creator/cover/' + s.id : '',
          };
        });
        return playQueueList(queue, 'creator-fallback');
      })
      .catch(function () { return playHotSearchFallback(); });
  }

  function playQueueList(queue, reason) {
    try {
      if (typeof playQueue === 'undefined' || !Array.isArray(playQueue)) return undefined;
      playQueue = queue;
      currentIdx = 0;
      if (typeof safeRenderQueuePanel === 'function') safeRenderQueuePanel(reason || 'home-fallback');
      if (typeof safeShelfRebuild === 'function') safeShelfRebuild(reason || 'home-fallback', true);
      if (typeof forcePlaybackControlsInteractive === 'function') forcePlaybackControlsInteractive();
      if (typeof playQueueAt === 'function') {
        return playQueueAt(0).then(function () { return true; }).catch(function () { return false; });
      }
      return true;
    } catch (_) { return undefined; }
  }

  // 每日推荐兜底（游客可用）：关键词池按日期轮换 + 结果随机打乱 + 当日去重，
  // 保证像汽水音乐一样每天自动换一批新歌，同一天内不重复。
  var HOT_KEYWORD_POOL = [
    '热歌', '纯音乐', '轻音乐', '经典老歌', '民谣', '治愈系', '翻唱',
    '摇滚', '电子', '爵士', '钢琴曲', '古风', '粤语歌', '英文歌',
    '动漫音乐', '游戏音乐', '冥想', '咖啡馆', '夜跑', '怀旧', '清新'
  ];
  var DAY_KEY = 'mineradio-daily-played';
  function dailySeed() {
    var d = new Date();
    var key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    var h = 2166136261;
    for (var i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return { key: key, hash: h };
  }
  function pickDailyKeywords(hash) {
    var pool = HOT_KEYWORD_POOL;
    var start = hash % pool.length;
    var picks = [];
    for (var i = 0; i < 4; i++) {
      var idx = (start + i * 3) % pool.length;
      if (picks.indexOf(pool[idx]) === -1) picks.push(pool[idx]);
    }
    return picks;
  }
  function dailyPlayedIds() {
    var seed = dailySeed();
    try {
      var raw = JSON.parse(localStorage.getItem(DAY_KEY) || '{}');
      return (raw && raw.key === seed.key && Array.isArray(raw.ids)) ? raw.ids : [];
    } catch (_) { return []; }
  }
  function rememberDailyPlayed(ids) {
    var seed = dailySeed();
    try { localStorage.setItem(DAY_KEY, JSON.stringify({ key: seed.key, ids: ids })); } catch (_) {}
  }
  function shuffled(list, seedHash) {
    var arr = list.slice();
    var s = seedHash || 1;
    for (var i = arr.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) >>> 0;
      var j = s % (i + 1);
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }
  function playHotSearchFallback() {
    var seed = dailySeed();
    var keywords = pickDailyKeywords(seed.hash);
    var played = dailyPlayedIds();
    var collected = [];
    var chain = Promise.resolve();
    keywords.forEach(function (kw) {
      chain = chain.then(function () {
        if (collected.length >= 5) return undefined;
        return fetch('/api/search?keywords=' + encodeURIComponent(kw) + '&limit=20')
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var songs = (d && d.songs) || [];
            songs.forEach(function (s) {
              if (collected.length >= 5) return;
              if (Number(s.fee) !== 0) return;
              var sid = String(s.id || '');
              if (played.indexOf(sid) !== -1) return;
              collected.push(s);
            });
          })
          .catch(function () { /* 单关键词失败继续下一个 */ });
      });
    });
    return chain.then(function () {
      if (!collected.length) {
        // 当天全听过了：清空当日记录再来一轮，保证一定有歌
        try { localStorage.removeItem(DAY_KEY); } catch (_) {}
        collected = [];
        return undefined;
      }
      var fresh = shuffled(collected, seed.hash).slice(0, 5);
      rememberDailyPlayed(played.concat(fresh.map(function (s) { return String(s.id); })));
      var queue = fresh.map(function (s) {
        return {
          name: s.name || '未知歌曲',
          artist: String(s.artist || '').slice(0, 60),
          source: 'netease',
          id: String(s.id || ''),
          cover: s.cover || '',
          memberOnly: false,
        };
      });
      return playQueueList(queue, 'home-daily-fresh');
    });
  }

  window.openCreatorBrowse = openBrowse;
  window.closeCreatorBrowse = closePanel;
  window.tryPlayCreatorFreeFallback = tryPlayCreatorFreeFallback;
})();
