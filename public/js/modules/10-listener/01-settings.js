'use strict';

// =============================================================
// Mineradio 设置面板（二改新增）
// 全局 API：window.openSettingsPanel()
// 内容：播放与界面 / 数据管理 / 缓存与空间 / 账号（入口）
// =============================================================

(function initSettingsPanelModule() {
  let panelEl = null;

  function settingsApi() {
    return window.desktopWindow || {};
  }

  function toast(text) {
    if (typeof window.showToast === 'function') window.showToast(text);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function panelStyles() {
    const style = document.createElement('style');
    style.textContent = [
      '#mineradio-settings-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:460px;max-width:92vw;max-height:84vh;overflow:auto;background:linear-gradient(112deg,rgba(72,74,76,.72),rgba(24,27,30,.80) 48%,rgba(8,12,14,.84));backdrop-filter:blur(18px) saturate(1.5);-webkit-backdrop-filter:blur(18px) saturate(1.5);border:1px solid rgba(0,245,212,.28);border-radius:18px;padding:22px 24px;color:#e8ecf3;font-family:inherit;font-size:14px;z-index:99999;box-shadow:0 22px 64px rgba(0,0,0,.60),0 0 34px rgba(0,245,212,.06),inset 0 1px 0 rgba(255,255,255,.14)}',
      '#mineradio-settings-panel h3{margin:0 0 4px;font-size:18px;font-weight:700;color:#fff}',
      '#mineradio-settings-panel .mr-sub{color:#9aa3c7;font-size:12px;margin-bottom:16px}',
      '#mineradio-settings-panel .mr-sec{font-size:13px;font-weight:700;color:#00f5d4;margin:16px 0 8px;letter-spacing:.4px}',
      '#mineradio-settings-panel .mr-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 4px;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px}',
      '#mineradio-settings-panel .mr-row-inline{display:flex;align-items:center;gap:6px}',
      '#mineradio-settings-panel .mr-seg{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}',
      '#mineradio-settings-panel .mr-seg-btn{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);color:#dde5f5;border-radius:999px;padding:4px 10px;font-size:12px;cursor:pointer;font-family:inherit}',
      '#mineradio-settings-panel .mr-seg-btn.active{background:linear-gradient(135deg,#00f5d4,#0a84ff);border-color:transparent;color:#03120f;font-weight:700}',
      '#mineradio-settings-panel .mr-row .mr-label{flex:1}',
      '#mineradio-settings-panel .mr-btn{display:inline-block;background:linear-gradient(135deg,#00f5d4,#0a84ff);border:none;color:#03120f;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:700;cursor:pointer;margin:4px 6px 4px 0;box-shadow:0 4px 14px rgba(0,245,212,.22)}',
      '#mineradio-settings-panel .mr-btn:hover{filter:brightness(1.1)}',
      '#mineradio-settings-panel .mr-btn.ghost{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);color:#dde5f5;box-shadow:none;font-weight:500}',
      '#mineradio-settings-panel .mr-btn.small{padding:4px 10px;font-size:12px;border-radius:6px}',
      '#mineradio-settings-panel .mr-close{position:absolute;right:14px;top:12px;background:none;border:none;color:#9aa3c7;font-size:20px;cursor:pointer}',
      '#mineradio-settings-panel .mr-dim{color:#9aa3c7;font-size:12px;line-height:1.6}',
      '#mineradio-settings-panel .mr-switch{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.07);color:#dde5f5;border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer;flex-shrink:0}',
      '#mineradio-settings-panel .mr-switch.on{background:linear-gradient(135deg,#00f5d4,#0a84ff);color:#03120f;border-color:transparent;font-weight:700}',
      '#mineradio-settings-panel .fx-slider{display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px}',
      '#mineradio-settings-panel .fx-slider label{flex:1;color:#dde5f5}',
      '#mineradio-settings-panel .fx-slider input[type=range]{flex:1;min-width:120px;accent-color:#00f5d4}',
      '#mineradio-settings-panel .fx-slider output{min-width:46px;text-align:right;color:#00f5d4;font-size:12px;font-weight:700}',
      '#mineradio-settings-overlay{position:fixed;inset:0;background:rgba(0,0,0,.28);z-index:99998}',
    ].join('');
    document.head.appendChild(style);
  }

  function closePanel() {
    if (panelEl) { panelEl.remove(); panelEl = null; }
    const overlay = document.getElementById('mineradio-settings-overlay');
    if (overlay) overlay.remove();
  }

  function row(label, control) {
    const r = el('div', 'mr-row');
    r.appendChild(el('span', 'mr-label', label));
    r.appendChild(control);
    return r;
  }

  function modeSwitch(label, isOn, onClick) {
    const btn = el('button', 'mr-switch' + (isOn ? ' on' : ''), isOn ? '开' : '关');
    btn.onclick = function () {
      onClick(!isOn);
      btn.classList.toggle('on');
      btn.textContent = btn.classList.contains('on') ? '开' : '关';
    };
    return row(label, btn);
  }

  // ---------------- 播放与界面 ----------------

  function buildPlaybackUi(container) {
    container.appendChild(el('div', 'mr-sec', '播放与界面'));

    // 播放模式（loop / shuffle / single）
    function currentPlayMode() {
      return (typeof playMode !== 'undefined' && playMode) || 'loop';
    }
    function playModeLabelCn(mode) {
      return mode === 'shuffle' ? '随机播放' : (mode === 'single' ? '单曲循环' : '列表循环');
    }
    const modeBtn = el('button', 'mr-btn small ghost', playModeLabelCn(currentPlayMode()));
    modeBtn.onclick = function () {
      if (typeof cyclePlayMode === 'function') {
        cyclePlayMode();
        setTimeout(function () { modeBtn.textContent = playModeLabelCn(currentPlayMode()); }, 60);
      } else toast('播放模式控制不可用');
    };
    container.appendChild(row('播放模式（点击切换）', modeBtn));

    // 播放界面样式（经典 / Folia 玻璃）
    container.appendChild(row('播放界面样式', (function () {
      const seg = el('div', 'mr-seg');
      const styles = [['classic', '经典'], ['folia', 'Folia 玻璃']];
      const key = 'mineradio-folia-skin-v1';
      function currentSkin() {
        try { return document.body.classList.contains('folia-skin') ? 'folia' : 'classic'; } catch (_) { return 'classic'; }
      }
      function refreshSkinSeg() {
        Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
          b.classList.toggle('active', b.dataset.skin === currentSkin());
        });
      }
      styles.forEach(function (item) {
        const b = el('button', 'mr-seg-btn' + (item[0] === currentSkin() ? ' active' : ''), item[1]);
        b.dataset.skin = item[0];
        b.onclick = function () {
          const apply = item[0] === 'folia';
          try {
            document.body.classList.toggle('folia-skin', apply);
            localStorage.setItem(key, apply ? '1' : '0');
          } catch (_) {}
          toast('播放界面样式已切换：' + item[1]);
          refreshSkinSeg();
        };
        seg.appendChild(b);
      });
      try {
        if (localStorage.getItem(key) === '1') document.body.classList.add('folia-skin');
      } catch (_) {}
      return seg;
    })()));

    // 歌词显示
    const lyricBtn = el('button', 'mr-btn small ghost', '切换');
    lyricBtn.onclick = function () {
      if (typeof toggleLyricsPanel === 'function') toggleLyricsPanel();
      else toast('歌词控制不可用');
    };
    container.appendChild(row('歌词显示', lyricBtn));

    // 启动恢复播放
    const resumeBtn = el('button', 'mr-btn small ghost', (function () {
      return (typeof startupResumeModePreference !== 'undefined' && startupResumeModePreference === 'restart') ? '重播整首' : '按上次进度';
    })());
    resumeBtn.onclick = function () {
      if (typeof setStartupResumeModePreference === 'function') {
        const next = (typeof startupResumeModePreference !== 'undefined' && startupResumeModePreference === 'restart') ? 'resume' : 'restart';
        setStartupResumeModePreference(next, { toast: true });
        resumeBtn.textContent = next === 'restart' ? '重播整首' : '按上次进度';
      } else toast('启动恢复设置不可用');
    };
    container.appendChild(row('启动后恢复上次播放', resumeBtn));

    // 启动自动播放
    const autoplayOn = (typeof startupAutoplayPreference !== 'undefined' && !!startupAutoplayPreference);
    const autoBtn = el('button', 'mr-switch' + (autoplayOn ? ' on' : ''), autoplayOn ? '开' : '关');
    autoBtn.onclick = function () {
      if (typeof toggleStartupAutoplay === 'function') {
        toggleStartupAutoplay();
        setTimeout(function () {
          const on = (typeof startupAutoplayPreference !== 'undefined' && !!startupAutoplayPreference);
          autoBtn.classList.toggle('on', on);
          autoBtn.textContent = on ? '开' : '关';
        }, 60);
      } else toast('启动自动播放不可用');
    };
    container.appendChild(row('启动时自动播放', autoBtn));
  }

  // ---------------- 歌词效果（动态效果自定义） ----------------

  function buildLyricFxUi(container) {
    container.appendChild(el('div', 'mr-sec', '歌词效果'));
    container.appendChild(el('div', 'mr-dim', '自定义歌词显示与动态效果（与效果面板同步，即时生效并保存）'));
    const fxToggles = [
      ['desktopLyricsHighlight', '跟唱高亮（按播放进度）', function () { return fx.desktopLyricsHighlight === true; }],
      ['lyricGlow', '歌词溢光', function () { return !!fx.lyricGlow; }],
      ['lyricGlowBeat', '溢光随节拍', function () { return !!fx.lyricGlowBeat; }],
      ['lyricGlowParticles', '溢光粒子', function () { return !!fx.lyricGlowParticles; }],
      ['lyricVerticalFloat', '歌词纵向漂浮', function () { return fx.lyricVerticalFloat !== false; }],
      ['lyricPauseHold', '暂停时保持歌词', function () { return fx.lyricPauseHold !== false; }],
    ];
    function saveLyricFx() {
      if (typeof saveLyricLayout === 'function') saveLyricLayout({ syncDisk: true, user: true, reason: 'settingsLyricFx' });
      if (typeof updateLyricColorControls === 'function') updateLyricColorControls();
      if (typeof updateLyricHighlightControls === 'function') updateLyricHighlightControls();
      if (typeof updateLyricGlowControls === 'function') updateLyricGlowControls();
    }
    fxToggles.forEach(function (item) {
      const key = item[0];
      const label = item[1];
      const read = item[2];
      const sw = el('button', 'mr-switch' + (read() ? ' on' : ''), read() ? '开' : '关');
      sw.onclick = function () {
        const next = !read();
        if (key === 'desktopLyricsHighlight') fx.desktopLyricsHighlight = next;
        else if (key === 'lyricVerticalFloat') fx.lyricVerticalFloat = next;
        else if (key === 'lyricPauseHold') fx.lyricPauseHold = next;
        else fx[key] = next;
        sw.classList.toggle('on', next);
        sw.textContent = next ? '开' : '关';
        saveLyricFx();
        toast(label + (next ? '已开启' : '已关闭'));
      };
      container.appendChild(row(label, sw));
    });
    // 动画样式（可切换）
    container.appendChild(row('歌词动画样式', (function () {
      const seg = el('div', 'mr-seg');
      const styles = [['float', '漂浮'], ['smooth', '柔滑'], ['glass', '玻璃'], ['shine', '线光'], ['glitch', '故障'], ['3d', '3D视角'], ['orbit', '环绕'], ['bounce', '弹跳']];
      const current = (typeof normalizeLyricMotionStyle === 'function') ? normalizeLyricMotionStyle(fx.lyricMotionStyle) : (fx.lyricMotionStyle || 'float');
      function refreshSeg() {
        Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
          b.classList.toggle('active', b.dataset.motion === current);
        });
      }
      styles.forEach(function (item) {
        const b = el('button', 'mr-seg-btn' + (item[0] === current ? ' active' : ''), item[1]);
        b.dataset.motion = item[0];
        b.onclick = function () {
          if (typeof setLyricMotionStyle === 'function') setLyricMotionStyle(item[0]);
          else fx.lyricMotionStyle = item[0];
          if (typeof saveLyricLayout === 'function') saveLyricLayout({ syncDisk: true, user: true, reason: 'settingsLyricMotion' });
          toast('歌词动画已切换：' + item[1]);
          refreshSeg();
        };
        seg.appendChild(b);
      });
      return seg;
    })()));
    // 字号 / 行距（可自定义）
    (function () {
      function addScaleSlider(key, label, min, max) {
        const wrap = el('div', 'fx-slider');
        const lab = el('label', '', label);
        const input = el('input');
        input.type = 'range'; input.min = String(min); input.max = String(max); input.step = '0.05';
        input.value = String(clampRange(Number(fx[key]) || 1, min, max));
        const out = el('output', '', Math.round((Number(fx[key]) || 1) * 100) + '%');
        input.oninput = function () {
          fx[key] = clampRange(Number(input.value) || 1, min, max);
          out.textContent = Math.round(fx[key] * 100) + '%';
          if (typeof saveLyricLayout === 'function') saveLyricLayout({ syncDisk: true, user: true, reason: 'settingsLyricSize' });
          if (typeof refreshCurrentLyricStyle === 'function') refreshCurrentLyricStyle();
        };
        wrap.appendChild(lab); wrap.appendChild(input); wrap.appendChild(out);
        container.appendChild(wrap);
      }
      addScaleSlider('lyricFontScale', '歌词字号', 0.7, 1.5);
      addScaleSlider('lyricSpacingScale', '歌词行距', 0.7, 1.5);
    })();
    // 颜色
    const colorRow = row('歌词颜色', (function () {
      const box = el('div', 'mr-row-inline');
      const input = el('input'); input.type = 'color'; input.value = (fx.lyricColorMode === 'custom' && fx.lyricColor) || '#a9b8c8';
      input.style.width = '34px'; input.style.height = '24px'; input.style.border = 'none'; input.style.background = 'none'; input.style.padding = '0'; input.style.cursor = 'pointer';
      input.onchange = function () { if (typeof setLyricColorCustom === 'function') setLyricColorCustom(input.value); };
      const autoBtn = el('button', 'mr-btn small ghost', '封面取色');
      autoBtn.onclick = function () { if (typeof setLyricColorAuto === 'function') setLyricColorAuto(); };
      box.appendChild(input); box.appendChild(autoBtn);
      return box;
    })());
    container.appendChild(colorRow);
    const hlRow = row('跟唱高亮色', (function () {
      const box = el('div', 'mr-row-inline');
      const input = el('input'); input.type = 'color'; input.value = fx.lyricHighlightColor || '#fff0b8';
      input.style.width = '34px'; input.style.height = '24px'; input.style.border = 'none'; input.style.background = 'none'; input.style.padding = '0'; input.style.cursor = 'pointer';
      input.onchange = function () { if (typeof setLyricHighlightCustom === 'function') setLyricHighlightCustom(input.value); };
      const autoBtn = el('button', 'mr-btn small ghost', '跟随歌词');
      autoBtn.onclick = function () { if (typeof setLyricHighlightAuto === 'function') setLyricHighlightAuto(); };
      box.appendChild(input); box.appendChild(autoBtn);
      return box;
    })());
    container.appendChild(hlRow);
  }

  // ---------------- 数据管理 / 缓存 ----------------

  function buildDataCacheUi(container) {
    container.appendChild(el('div', 'mr-sec', '数据管理'));
    const info = el('div', 'mr-dim', '加载中…');
    container.appendChild(info);
    if (typeof settingsApi().appInfo === 'function') {
      settingsApi().appInfo().then(function (res) {
        if (res && res.ok) {
          info.textContent = '数据目录（全部数据跟随安装目录，不占系统盘）：\n' + res.installDataDir + '\n缓存目录：\n' + res.cacheRoot;
          info.style.whiteSpace = 'pre-wrap';
        } else info.textContent = '数据目录读取失败';
      }).catch(function () { info.textContent = '数据目录读取失败'; });
    } else info.textContent = '数据目录读取失败';

    const openBtn = el('button', 'mr-btn small ghost', '打开数据文件夹');
    openBtn.onclick = function () {
      if (typeof settingsApi().openDataDir === 'function') settingsApi().openDataDir('data');
    };
    container.appendChild(openBtn);

    container.appendChild(el('div', 'mr-sec', '缓存与空间'));
    container.appendChild(el('div', 'mr-dim', '缓存（歌词/界面/临时文件）可随时清空，不影响曲库、账号、会员和创作者数据。'));
    const clearBtn = el('button', 'mr-btn small ghost', '清空缓存');
    clearBtn.onclick = function () {
      if (typeof settingsApi().clearCache !== 'function') { toast('清缓存不可用'); return; }
      clearBtn.disabled = true;
      settingsApi().clearCache()
        .then(function (res) {
          toast((res && res.ok) ? '缓存已清空' : ((res && res.error) || '清缓存失败'));
        })
        .catch(function () { toast('清缓存失败'); })
        .finally(function () { clearBtn.disabled = false; });
    };
    container.appendChild(clearBtn);

    const openCacheBtn = el('button', 'mr-btn small ghost', '打开缓存文件夹');
    openCacheBtn.onclick = function () {
      if (typeof settingsApi().openDataDir === 'function') settingsApi().openDataDir('cache');
    };
    container.appendChild(openCacheBtn);

    container.appendChild(el('div', 'mr-sec', '备份与恢复'));
    container.appendChild(el('div', 'mr-dim', '全部数据（曲库 / 会员 / 创作者 / 听众账号）都在上面「数据目录」里。备份 = 复制该文件夹；恢复 = 装好后把文件夹放回原处（新设备安装目录）。'));
  }

  // ---------------- 账号入口 ----------------

  function buildAccountEntry(container) {
    container.appendChild(el('div', 'mr-sec', '账号'));
    const openAccount = el('button', 'mr-btn small ghost', '打开听众账号面板');
    openAccount.onclick = function () {
      closePanel();
      if (typeof window.openListenerAccountPanel === 'function') window.openListenerAccountPanel();
      else toast('账号面板不可用');
    };
    container.appendChild(openAccount);
    container.appendChild(el('div', 'mr-dim', '注册登录后可管理个人歌单、收藏、收听记录；会员激活时绑定账号，换设备不丢。'));
  }

  // ---------------- 检查更新 ----------------

  function buildUpdateEntry(container) {
    container.appendChild(el('div', 'mr-sec', '检查更新'));
    const statusLine = el('div', 'mr-dim', '点击检查是否有新版本可下载安装');
    const btn = el('button', 'mr-btn small ghost', '检查更新');
    btn.onclick = function () {
      const dw = window.desktopWindow || {};
      if (typeof dw.checkUpdate !== 'function') { toast('检查更新仅桌面版可用'); return; }
      statusLine.textContent = '正在检查…';
      dw.checkUpdate().then(function (res) {
        if (res && res.ok) return;
        statusLine.textContent = (res && res.error) || '检查失败';
      });
      if (typeof dw.onUpdateStatus === 'function') {
        dw.onUpdateStatus(function (s) {
          if (!s) return;
          if (s.state === 'checking') statusLine.textContent = '正在检查…';
          else if (s.state === 'available') {
            statusLine.textContent = '发现新版本 v' + s.version + '，正在后台下载…';
            const dl = el('button', 'mr-btn small ghost', '下载并安装');
            dl.onclick = function () { dw.downloadUpdate(); };
            statusLine.appendChild(dl);
          }
          else if (s.state === 'downloading') statusLine.textContent = '下载中 ' + (s.percent || 0).toFixed(0) + '%';
          else if (s.state === 'downloaded') {
            statusLine.textContent = '新版本 v' + s.version + ' 已下载，正在自动重启生效…';
            const inst = el('button', 'mr-btn small ghost', '立即重启');
            inst.onclick = function () { dw.installUpdate(); };
            statusLine.appendChild(inst);
          }
          else if (s.state === 'none') statusLine.textContent = '已是最新版本';
          else if (s.state === 'error') statusLine.textContent = '检查更新失败：' + (s.message || '网络异常');
        });
      }
    };
    container.appendChild(btn);
    container.appendChild(statusLine);
  }

  // ---------------- 打开面板 ----------------

  function openSettingsPanel() {
    panelStyles();
    const overlay = el('div', '', '');
    overlay.id = 'mineradio-settings-overlay';
    overlay.onclick = closePanel;
    document.body.appendChild(overlay);

    const panel = el('div', '', '');
    panel.id = 'mineradio-settings-panel';
    const close = el('button', 'mr-close', '×');
    close.onclick = closePanel;
    panel.appendChild(close);
    panel.appendChild(el('h3', '', '设置'));
    panel.appendChild(el('div', 'mr-sub', '播放与界面 · 数据管理 · 缓存与空间 · 账号'));

    const body = el('div');
    panel.appendChild(body);
    panelEl = panel;
    document.body.appendChild(panel);

    buildPlaybackUi(body);
    buildLyricFxUi(body);
    buildDataCacheUi(body);
    buildAccountEntry(body);
    buildUpdateEntry(body);
  }

  window.openSettingsPanel = openSettingsPanel;
})();
