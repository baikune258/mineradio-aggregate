'use strict';

// =============================================================
// Mineradio 听众账号（二改新增）
// 全局 API：
//   window.openListenerAccountPanel()
//   window.refreshListenerAccountStatus()
//   window.notifyListenerPlaybackStart(track)
// 账号数据跟随安装目录 data/listeners，重装同目录不丢；
// 换设备可用账号备份导入或直接拷贝安装目录 data 文件夹。
// =============================================================

(function initListenerAccountModule() {
  const TOKEN_KEY = 'mineradio-listener-token';
  const accountState = { loggedIn: false, token: '', account: null, memberUntil: 0 };
  window._listenerAccountState = accountState;
  let panelEl = null;

  function listenerApi() {
    const dw = window.desktopWindow || {};
    if (dw && typeof dw.listenerRegister === 'function' && typeof dw.listenerStatus === 'function') return dw;
    // 浏览器/无 IPC 环境：走本地服务端账号路由（桌面版内嵌服务同样可用）
    const post = (pn, payload) => fetch(pn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    }).then(r => r.json());
    const get = (pn) => fetch(pn).then(r => r.json());
    return {
      listenerRegister: (p) => post('/api/listener/register', p),
      listenerLogin: (p) => post('/api/listener/login', p),
      listenerLogout: (t) => post('/api/listener/logout', { token: t }),
      listenerStatus: (t) => get('/api/listener/status?token=' + encodeURIComponent(t)),
      listenerMemberBind: (t, e) => post('/api/listener/member-bind', { token: t, expireAt: e }),
      listenerAddPlaylist: (t, n) => post('/api/listener/add-playlist', { token: t, name: n }),
      listenerRenamePlaylist: (t, id, n) => post('/api/listener/rename-playlist', { token: t, playlistId: id, name: n }),
      listenerDeletePlaylist: (t, id) => post('/api/listener/delete-playlist', { token: t, playlistId: id }),
      listenerAddTrack: (t, id, tr) => post('/api/listener/add-track', { token: t, playlistId: id, track: tr }),
      listenerRemoveTrack: (t, id, k) => post('/api/listener/remove-track', { token: t, playlistId: id, trackKey: k }),
      listenerToggleFavorite: (t, tr) => post('/api/listener/toggle-favorite', { token: t, track: tr }),
      listenerIsFavorite: (t, k) => get('/api/listener/is-favorite?token=' + encodeURIComponent(t) + '&trackKey=' + encodeURIComponent(k)),
      listenerRecordPlay: (t, tr) => post('/api/listener/record-play', { token: t, track: tr }),
      listenerCreateOrder: (t, plan) => post('/api/listener/create-order', { token: t, plan: plan }),
      listenerMyOrders: (t) => get('/api/listener/my-orders?token=' + encodeURIComponent(t)),
      listenerPendingOrders: (p) => get('/api/listener/pending-orders?password=' + encodeURIComponent(p)),
      listenerApproveOrder: (p, id) => post('/api/listener/approve-order', { password: p, orderId: id }),
    };
  }

  function pad2(n) { return String(n).length < 2 ? '0' + n : String(n); }
  function expireText(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function toast(text) {
    if (typeof window.showToast === 'function') window.showToast(text);
  }

  // ---------------- 状态 ---------------- 

  function refreshListenerAccountStatus() {
    const saved = (function () {
      try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; }
    })();
    if (!accountState.token && saved) accountState.token = saved;
    if (!accountState.token) {
      accountState.loggedIn = false;
      accountState.account = null;
      accountState.memberUntil = 0;
      return Promise.resolve(accountState);
    }
    if (typeof listenerApi().listenerStatus !== 'function') return Promise.resolve(accountState);
    return listenerApi().listenerStatus({ token: accountState.token })
      .then(function (res) {
        res = res || {};
        if (res.ok && res.loggedIn && res.account) {
          accountState.loggedIn = true;
          accountState.account = res.account;
          accountState.memberUntil = Number(res.account.memberUntil) || 0;
          (function () { try { localStorage.setItem(TOKEN_KEY, accountState.token); } catch (_) {} })();
        } else {
          accountState.loggedIn = false;
          accountState.account = null;
          accountState.memberUntil = 0;
          accountState.token = '';
          (function () { try { localStorage.removeItem(TOKEN_KEY); } catch (_) {} })();
        }
        return accountState;
      })
      .catch(function () {
        accountState.loggedIn = false;
        accountState.account = null;
        accountState.memberUntil = 0;
        return accountState;
      });
  }

  // ---------------- 收听记录（播放开始时由播放核心回调） ----------------

  function notifyListenerPlaybackStart(track) {
    if (!accountState.loggedIn || !accountState.token || !track) return;
    const t = {
      name: track.name || track.title || '',
      artist: track.artist || '',
      source: track.source || track.provider || '',
      id: track.id || track.songid || track.mid || track.localKey || track.hash || '',
      localUrl: track.localUrl || track.url || '',
      cover: track.cover || track.coverUrl || '',
      memberOnly: !!track.memberOnly,
    };
    listenerApi().listenerRecordPlay({ token: accountState.token, track: t }).catch(function () {});
  }

  // ---------------- 面板 ----------------

  function panelStyles() {
    const style = document.createElement('style');
    style.textContent = [
      '#mineradio-listener-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:460px;max-width:92vw;max-height:84vh;overflow:auto;background:linear-gradient(112deg,rgba(72,74,76,.72),rgba(24,27,30,.80) 48%,rgba(8,12,14,.84));backdrop-filter:blur(18px) saturate(1.5);-webkit-backdrop-filter:blur(18px) saturate(1.5);border:1px solid rgba(0,245,212,.28);border-radius:18px;padding:0 0 22px;color:#e8ecf3;font-family:inherit;font-size:14px;z-index:99999;box-shadow:0 22px 64px rgba(0,0,0,.60),0 0 34px rgba(0,245,212,.06),inset 0 1px 0 rgba(255,255,255,.14)}',
      '#mineradio-listener-panel .mr-panel-inner{padding:0 24px}',
      '#mineradio-listener-panel h3{margin:0 0 4px;font-size:18px;font-weight:700;color:#fff}',
      '#mineradio-listener-panel .mr-sub{color:#9aa3c7;font-size:12px;margin-bottom:16px}',
      '#mineradio-listener-panel .mr-status{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;background:rgba(0,245,212,.10);border:1px solid rgba(0,245,212,.18);margin-bottom:14px}',
      '#mineradio-listener-panel .mr-dot{width:8px;height:8px;border-radius:50%;background:#5d6b8f}',
      '#mineradio-listener-panel .mr-dot.on{background:#00f5d4;box-shadow:0 0 10px #00f5d4}',
      // 汽水音乐式个人主页头部：顶部渐变封面 + 大头像叠放 + 昵称 + 徽章 + 统计
      '#mineradio-listener-panel .mr-profile{position:relative;margin:0 0 14px;border-radius:16px;overflow:hidden;background:linear-gradient(112deg,rgba(72,74,76,.62),rgba(24,27,30,.70) 48%,rgba(8,12,14,.74));border:1px solid rgba(0,245,212,.22);box-shadow:0 14px 40px rgba(0,0,0,.35)}',
      '#mineradio-listener-panel .mr-profile-banner{height:104px;background:linear-gradient(120deg,rgba(0,245,212,.55),rgba(9,132,255,.42) 52%,rgba(168,85,247,.38));position:relative}',
      '#mineradio-listener-panel .mr-profile-banner::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 82% 8%,rgba(255,255,255,.22),transparent 46%)}',
      '#mineradio-listener-panel .mr-profile-body{display:flex;align-items:flex-end;gap:14px;padding:0 16px 14px;position:relative;margin-top:-34px}',
      '#mineradio-listener-panel .mr-avatar{width:68px;height:68px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;background:linear-gradient(135deg,#00f5d4,#0a84ff);border:3px solid rgba(255,255,255,.95);box-shadow:0 0 18px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.25);user-select:none}',
      '#mineradio-listener-panel .mr-profile-main{flex:1;min-width:0}',
      '#mineradio-listener-panel .mr-profile-name{font-size:18px;font-weight:800;color:#fff;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 2px 8px rgba(0,0,0,.4)}',
      '#mineradio-listener-panel .mr-profile-stats{font-size:12.5px;color:#aab4d8;display:flex;gap:14px;flex-wrap:wrap}',
      '#mineradio-listener-panel .mr-profile-stats b{color:#fff;font-weight:700}',
      '#mineradio-listener-panel .mr-profile-badge{flex:none;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:linear-gradient(135deg,#00f5d4,#0a84ff);color:#03120f;white-space:nowrap;box-shadow:0 0 12px rgba(0,245,212,.35)}',
      '#mineradio-listener-panel .mr-profile-badge.off{background:rgba(255,255,255,.12);color:#9aa3c7;border:1px solid rgba(255,255,255,.18);box-shadow:none}',
      '#mineradio-listener-panel .mr-profile-badge.off{background:rgba(255,255,255,.1);color:#9aa3c7;border:1px solid rgba(255,255,255,.15)}',
      '#mineradio-listener-panel .mr-field{margin-bottom:10px}',
      '#mineradio-listener-panel .mr-field label{display:block;font-size:12px;color:#9aa3c7;margin-bottom:4px}',
      '#mineradio-listener-panel input[type=text],#mineradio-listener-panel input[type=password],#mineradio-listener-panel textarea{width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:1px solid rgba(0,245,212,.22);border-radius:8px;color:#fff;padding:8px 10px;font-size:14px;outline:none;font-family:inherit}',
      '#mineradio-listener-panel input:focus,#mineradio-listener-panel textarea:focus{border-color:rgba(0,245,212,.55);box-shadow:0 0 0 2px rgba(0,245,212,.12)}',
      '#mineradio-listener-panel textarea{height:64px;resize:vertical;font-family:monospace;font-size:12px}',
      '#mineradio-listener-panel .mr-btn{display:inline-block;background:linear-gradient(135deg,#00f5d4,#0a84ff);border:none;color:#03120f;border-radius:8px;padding:8px 16px;font-size:14px;font-weight:700;cursor:pointer;margin:4px 6px 4px 0;box-shadow:0 4px 14px rgba(0,245,212,.22)}',
      '#mineradio-listener-panel .mr-btn:hover{filter:brightness(1.1)}',
      '#mineradio-listener-panel .mr-btn.ghost{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);color:#dde5f5;box-shadow:none;font-weight:500}',
      '#mineradio-listener-panel .mr-btn.small{padding:4px 10px;font-size:12px;border-radius:6px}',
      '#mineradio-listener-panel .mr-close{position:absolute;right:14px;top:12px;background:none;border:none;color:#9aa3c7;font-size:20px;cursor:pointer}',
      '#mineradio-listener-panel .mr-sec{font-size:13px;font-weight:700;color:#00f5d4;margin:16px 0 8px;letter-spacing:.4px}',
      '#mineradio-listener-panel .mr-track-list{max-height:190px;overflow:auto;border:1px solid rgba(0,245,212,.14);border-radius:10px;padding:4px 8px;margin-top:6px;background:rgba(0,0,0,.14)}',
      '#mineradio-listener-panel .mr-track-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px}',
      '#mineradio-listener-panel .mr-track-row .mr-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}',
      '#mineradio-listener-panel .mr-hr{border:none;border-top:1px solid rgba(255,255,255,.1);margin:14px 0}',
      '#mineradio-listener-panel .mr-picker{display:flex;gap:6px;align-items:center;margin-top:6px}',
      '#mineradio-listener-panel .mr-picker select{flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(0,245,212,.22);border-radius:6px;color:#fff;padding:6px 8px;font-size:12px;outline:none}',
      '#mineradio-listener-overlay{position:fixed;inset:0;background:rgba(0,0,0,.28);z-index:99998}',
    ].join('');
    document.head.appendChild(style);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function closePanel() {
    if (panelEl) { panelEl.remove(); panelEl = null; }
    const overlay = document.getElementById('mineradio-listener-overlay');
    if (overlay) overlay.remove();
  }

  function playTrack(track) {
    try {
      if (typeof playQueue !== 'undefined' && Array.isArray(playQueue)) {
        const song = {
          name: track.name || track.title || '未知歌曲',
          artist: track.artist || '',
          source: track.source || track.provider || 'creator',
          id: track.id || track.localKey || '',
          localUrl: track.localUrl || (track.source === 'creator' ? '/api/creator/audio/' + (track.id || '') : ''),
          localKey: track.localKey || (track.source === 'creator' ? 'creator-' + (track.id || '') : ''),
          cover: track.cover || '',
          memberOnly: !!track.memberOnly,
        };
        playQueue.push(song);
        if (typeof playQueueAt === 'function') playQueueAt(playQueue.length - 1, { manual: true });
        else toast('播放核心未就绪');
      } else toast('播放核心未就绪');
    } catch (_) { toast('播放失败'); }
  }

  function trackRow(track, extraButtons) {
    const row = el('div', 'mr-track-row');
    const name = el('span', 'mr-name', (track.name || track.title || '未知') + (track.artist ? ' — ' + track.artist : ''));
    row.appendChild(name);
    const play = el('button', 'mr-btn small ghost', '播放');
    play.onclick = function () { playTrack(track); };
    row.appendChild(play);
    (extraButtons || []).forEach(function (mk) {
      const btn = mk(track);
      if (btn) row.appendChild(btn);
    });
    return row;
  }

  // ---------------- 已登录视图 ----------------

  function buildLoggedInView(container) {
    container.innerHTML = '';
    // 个人主页头部（汽水音乐式）：顶部渐变封面 + 大头像叠放 + 昵称 + 统计 + 会员徽章
    const isMember = Number(accountState.memberUntil) > Date.now();
    const profile = el('div', 'mr-profile');
    profile.appendChild(el('div', 'mr-profile-banner'));
    const body = el('div', 'mr-profile-body');
    const avatar = el('div', 'mr-avatar');
    avatar.textContent = String(accountState.account.name || 'M').slice(0, 1).toUpperCase();
    const main = el('div', 'mr-profile-main');
    main.appendChild(el('div', 'mr-profile-name', accountState.account.name || ''));
    const stats = el('div', 'mr-profile-stats');
    const statPl = el('span'); statPl.innerHTML = '<b>' + (accountState.account.playlists || []).length + '</b> 歌单';
    const statFav = el('span'); statFav.innerHTML = '<b>' + (accountState.account.favorites || []).length + '</b> 收藏';
    const statFol = el('span'); statFol.innerHTML = '<b>0</b> 关注';
    const statFan = el('span'); statFan.innerHTML = '<b>0</b> 粉丝';
    stats.appendChild(statPl); stats.appendChild(statFav); stats.appendChild(statFol); stats.appendChild(statFan);
    main.appendChild(stats);
    body.appendChild(avatar);
    body.appendChild(main);
    body.appendChild(el('div', 'mr-profile-badge' + (isMember ? '' : ' off'), isMember ? 'MR 会员' : '未开通会员'));
    profile.appendChild(body);
    container.appendChild(profile);

    const statusRow = el('div', 'mr-status');
    const dot = el('span', 'mr-dot on');
    const text = el('span');
    text.textContent = '已登录：' + (accountState.account.name || '') +
      (isMember ? ' · 账号会员至 ' + expireText(accountState.memberUntil) : ' · 账号未绑定会员');
    statusRow.appendChild(dot);
    statusRow.appendChild(text);
    container.appendChild(statusRow);

    const actions = el('div');
    const logoutBtn = el('button', 'mr-btn ghost small', '退出登录');
    logoutBtn.onclick = function () {
      const token = accountState.token;
      accountState.loggedIn = false;
      accountState.account = null;
      accountState.memberUntil = 0;
      accountState.token = '';
      (function () { try { localStorage.removeItem(TOKEN_KEY); } catch (_) {} })();
      if (typeof listenerApi().listenerLogout === 'function') {
        listenerApi().listenerLogout({ token: token }).catch(function () {});
      }
      toast('已退出登录');
      rebuildPanel();
    };
    const refreshBtn = el('button', 'mr-btn ghost small', '刷新');
    refreshBtn.onclick = function () { refreshListenerAccountStatus().then(rebuildPanel); };
    actions.appendChild(logoutBtn);
    actions.appendChild(refreshBtn);
    container.appendChild(actions);

    // 个人歌单
    container.appendChild(el('div', 'mr-sec', '我的歌单'));
    const plAdd = el('div', 'mr-picker');
    const plNameInput = el('input');
    plNameInput.type = 'text';
    plNameInput.placeholder = '新歌单名称';
    const plAddBtn = el('button', 'mr-btn small', '新建');
    plAddBtn.onclick = function () {
      const name = plNameInput.value.trim();
      if (!name) { toast('请输入歌单名'); return; }
      listenerApi().listenerAddPlaylist({ token: accountState.token, name: name })
        .then(function (res) {
          if (res && res.ok) { accountState.account = res.account; toast('歌单已创建'); rebuildPanel(); }
          else toast((res && res.error) || '创建失败');
        }).catch(function () { toast('创建失败'); });
    };
    plAdd.appendChild(plNameInput);
    plAdd.appendChild(plAddBtn);
    container.appendChild(plAdd);

    const playlists = (accountState.account.playlists || []);
    if (playlists.length) {
      const plList = el('div', 'mr-track-list');
      playlists.forEach(function (pl) {
        const head = el('div', 'mr-track-row');
        head.appendChild(el('span', 'mr-name', pl.name + '（' + (pl.tracks || []).length + ' 首）'));
        const expand = el('button', 'mr-btn small ghost', '展开');
        expand.onclick = function () { togglePlaylistDetail(pl, head, plList); };
        const playPl = el('button', 'mr-btn small ghost', '播放');
        playPl.onclick = function () {
          const tracks = pl.tracks || [];
          if (!tracks.length) { toast('歌单为空'); return; }
          try {
            playQueue = tracks.map(function (t) { return {
              name: t.name, artist: t.artist, source: t.source || 'creator',
              id: t.id || t.localKey || '', localUrl: t.localUrl, localKey: t.localKey, cover: t.cover, memberOnly: !!t.memberOnly,
            }; });
            currentIdx = 0;
            if (typeof playQueueAt === 'function') playQueueAt(0, { manual: true });
          } catch (_) { toast('播放失败'); }
        };
        const renameBtn = el('button', 'mr-btn small ghost', '改名');
        renameBtn.onclick = function () {
          const nn = prompt('新歌单名：', pl.name);
          if (nn === null || !nn.trim()) return;
          listenerApi().listenerRenamePlaylist({ token: accountState.token, playlistId: pl.id, name: nn.trim() })
            .then(function (res) {
              if (res && res.ok) { accountState.account = res.account; rebuildPanel(); }
              else toast((res && res.error) || '改名失败');
            }).catch(function () { toast('改名失败'); });
        };
        const delBtn = el('button', 'mr-btn small ghost', '删除');
        delBtn.onclick = function () {
          if (!confirm('删除歌单「' + pl.name + '」？')) return;
          listenerApi().listenerDeletePlaylist({ token: accountState.token, playlistId: pl.id })
            .then(function (res) {
              if (res && res.ok) { accountState.account = res.account; rebuildPanel(); }
              else toast((res && res.error) || '删除失败');
            }).catch(function () { toast('删除失败'); });
        };
        head.appendChild(expand);
        head.appendChild(playPl);
        head.appendChild(renameBtn);
        head.appendChild(delBtn);
        plList.appendChild(head);
      });
      container.appendChild(plList);
    }

    // 收藏
    container.appendChild(el('div', 'mr-sec', '我的收藏'));
    const favs = accountState.account.favorites || [];
    if (favs.length) {
      const favList = el('div', 'mr-track-list');
      favs.forEach(function (t) {
        favList.appendChild(trackRow(t, [
          function (track) {
            const btn = el('button', 'mr-btn small ghost', '取消收藏');
            btn.onclick = function () {
              listenerApi().listenerToggleFavorite({ token: accountState.token, track: track })
                .then(function (res) {
                  if (res && res.ok) { accountState.account = res.account; rebuildPanel(); }
                }).catch(function () {});
            };
            return btn;
          },
          function (track) { return addToPlaylistButton(track); },
        ]));
      });
      container.appendChild(favList);
    } else {
      container.appendChild(el('div', 'mr-dim', '还没有收藏，播放歌曲时点收藏即可加入'));
    }

    // 备份
    container.appendChild(el('div', 'mr-sec', '账号备份（换设备/重装恢复）'));
    container.appendChild(el('div', 'mr-dim', '数据在本机安装目录 data/listeners：重装到同一目录不丢；换设备可导出备份文本，在新设备导入，或直接拷贝整个 data 文件夹。'));
    const exportBtn = el('button', 'mr-btn small', '导出备份');
    exportBtn.onclick = function () {
      listenerApi().listenerExport({ token: accountState.token })
        .then(function (res) {
          if (res && res.ok) {
            const box = el('textarea');
            box.value = res.backup;
            box.readOnly = true;
            box.style.height = '90px';
            box.onclick = function () { box.select(); };
            container.appendChild(box);
            const hint = el('div', 'mr-dim', '已复制上方备份文本？点击输入框全选 → 复制。');
            container.appendChild(hint);
            toast('备份已生成');
          } else toast((res && res.error) || '导出失败');
        }).catch(function () { toast('导出失败'); });
    };
    container.appendChild(exportBtn);

    const importField = el('div', 'mr-field');
    const importLabel = el('label', '', '导入备份（在新设备登录同名账号前导入）');
    const importInput = el('textarea');
    const importBtn = el('button', 'mr-btn small', '导入');
    importBtn.onclick = function () {
      const backup = importInput.value.trim();
      if (!backup) { toast('请粘贴备份文本'); return; }
      listenerApi().listenerImport({ backup: backup })
        .then(function (res) {
          if (res && res.ok) {
            accountState.token = res.session.token;
            accountState.account = res.account;
            accountState.loggedIn = true;
            accountState.memberUntil = Number(res.account.memberUntil) || 0;
            (function () { try { localStorage.setItem(TOKEN_KEY, accountState.token); } catch (_) {} })();
            toast('账号导入成功');
            rebuildPanel();
          } else toast((res && res.error) || '导入失败');
        }).catch(function () { toast('导入失败'); });
    };
    importField.appendChild(importLabel);
    importField.appendChild(importInput);
    importField.appendChild(importBtn);
    container.appendChild(importField);
  }

  function addToPlaylistButton(track) {
    const btn = el('button', 'mr-btn small ghost', '加歌单');
    btn.onclick = function () {
      const playlists = (accountState.account.playlists || []);
      if (!playlists.length) { toast('请先创建歌单'); return; }
      const picker = el('div', 'mr-picker');
      const sel = document.createElement('select');
      playlists.forEach(function (pl) {
        const opt = document.createElement('option');
        opt.value = pl.id;
        opt.textContent = pl.name;
        sel.appendChild(opt);
      });
      const okBtn = el('button', 'mr-btn small', '加入');
      okBtn.onclick = function () {
        listenerApi().listenerAddTrack({ token: accountState.token, playlistId: sel.value, track: track })
          .then(function (res) {
            if (res && res.ok) { accountState.account = res.account; toast('已加入歌单'); rebuildPanel(); }
            else toast((res && res.error) || '加入失败');
          }).catch(function () { toast('加入失败'); });
      };
      picker.appendChild(sel);
      picker.appendChild(okBtn);
      btn.parentNode && btn.parentNode.insertBefore(picker, btn.nextSibling);
      btn.style.display = 'none';
    };
    return btn;
  }

  function togglePlaylistDetail(pl, headRow, listBox) {
    const detailKey = 'mr-pl-detail-' + pl.id;
    const existing = listBox.querySelector('.' + detailKey);
    if (existing) { existing.remove(); return; }
    const detail = el('div', 'mr-track-list ' + detailKey);
    detail.style.margin = '6px 0 6px 8px';
    const tracks = pl.tracks || [];
    if (!tracks.length) detail.appendChild(el('div', 'mr-dim', '歌单为空，可从收听记录/收藏添加'));
    tracks.forEach(function (t) {
      detail.appendChild(trackRow(t, [
        function (track) {
          const btn = el('button', 'mr-btn small ghost', '移除');
          btn.onclick = function () {
            listenerApi().listenerRemoveTrack({ token: accountState.token, playlistId: pl.id, trackKey: track.key })
              .then(function (res) {
                if (res && res.ok) { accountState.account = res.account; rebuildPanel(); }
              }).catch(function () {});
          };
          return btn;
        },
      ]));
    });
    headRow.parentNode.insertBefore(detail, headRow.nextSibling);
  }

  // ---------------- 未登录视图 ----------------

  function buildLoggedOutView(container) {
    container.innerHTML = '';
    container.appendChild(el('div', 'mr-status', '未登录 · 注册后：个人歌单 / 收藏 / 收听记录，会员绑定账号，换设备不丢'));
    const nameField = el('div', 'mr-field');
    nameField.appendChild(el('label', '', '昵称（2-24 字符）'));
    const nameInput = el('input');
    nameInput.type = 'text';
    nameInput.placeholder = '你的昵称';
    nameField.appendChild(nameInput);
    const passField = el('div', 'mr-field');
    passField.appendChild(el('label', '', '口令（至少 6 位）'));
    const passInput = el('input');
    passInput.type = 'password';
    passInput.placeholder = '登录口令';
    passField.appendChild(passInput);
    container.appendChild(nameField);
    container.appendChild(passField);

    function doAuth(mode) {
      const name = nameInput.value.trim();
      const password = passInput.value;
      if (!name) { toast('请输入昵称'); return; }
      if (!password) { toast('请输入口令'); return; }
      const api = listenerApi();
      const fn = mode === 'register' ? api.listenerRegister : api.listenerLogin;
      if (typeof fn !== 'function') {
        toast('账号功能请在桌面版（安装包）中使用，浏览器预览不支持');
        return;
      }
      fn({ name: name, password: password })
        .then(function (res) {
          if (res && res.ok) {
            accountState.token = res.session.token;
            accountState.account = res.account;
            accountState.loggedIn = true;
            accountState.memberUntil = Number(res.account.memberUntil) || 0;
            (function () { try { localStorage.setItem(TOKEN_KEY, accountState.token); } catch (_) {} })();
            toast(mode === 'register' ? '注册成功，欢迎 ' + name : '登录成功');
            rebuildPanel();
          } else toast((res && res.error) || '操作失败');
        }).catch(function () { toast('操作失败，请重试'); });
    }

    const loginBtn = el('button', 'mr-btn', '登录');
    loginBtn.onclick = function () { doAuth('login'); };
    const regBtn = el('button', 'mr-btn ghost', '注册');
    regBtn.onclick = function () { doAuth('register'); };
    const actions = el('div');
    actions.appendChild(loginBtn);
    actions.appendChild(regBtn);
    container.appendChild(actions);
    container.appendChild(el('div', 'mr-dim', '提示：会员激活时如果已登录账号，会员有效期会自动绑定到该账号。'));
  }

  // ---------------- 打开面板 ----------------

  function openListenerAccountPanel() {
    panelStyles();
    const overlay = el('div', '', '');
    overlay.id = 'mineradio-listener-overlay';
    overlay.onclick = closePanel;
    document.body.appendChild(overlay);

    const panel = el('div', '', '');
    panel.id = 'mineradio-listener-panel';
    const close = el('button', 'mr-close', '×');
    close.onclick = closePanel;
    panel.appendChild(close);
    panel.appendChild(el('h3', '', '听众账号'));
    panel.appendChild(el('div', 'mr-sub', '个人歌单 · 收藏 · 收听记录 · 会员绑定账号'));

    const body = el('div');
    panel.appendChild(body);
    panelEl = panel;
    document.body.appendChild(panel);

    function render() {
      if (accountState.loggedIn && accountState.account) buildLoggedInView(body);
      else buildLoggedOutView(body);
    }

    function rebuild() { render(); }
    window.rebuildListenerPanel = rebuild;

    refreshListenerAccountStatus().then(function () { render(); });
  }

  // ---------------- 初始化 ----------------

  window.openListenerAccountPanel = openListenerAccountPanel;
  window.refreshListenerAccountStatus = refreshListenerAccountStatus;
  window.notifyListenerPlaybackStart = notifyListenerPlaybackStart;

  // 启动时恢复登录态
  refreshListenerAccountStatus().catch(function () {});
})();
