'use strict';

// =============================================================
// Mineradio 会员体系（前端面板）
// 全局 API：
//   window.refreshMineradioMemberStatus()
//   window.isMineradioMemberActive()
//   window.openMineradioMemberPanel()
// =============================================================

(function initMineradioMemberModule() {
  const memberState = { activated: false, expireAt: 0, loaded: false };
  let memberPanelEl = null;
  let adminUnlocked = false;

  function memberApi() {
    return window.desktopWindow || {};
  }

  function pad2(n) { return String(n).length < 2 ? '0' + n : String(n); }

  function expireText(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function refreshMineradioMemberStatus() {
    return Promise.resolve()
      .then(function () {
        if (typeof memberApi().memberStatus !== 'function') return { activated: false, expireAt: 0 };
        return memberApi().memberStatus();
      })
      .then(function (res) {
        res = res || {};
        memberState.activated = !!res.activated;
        memberState.expireAt = Number(res.expireAt) || 0;
        memberState.loaded = true;
        return memberState;
      })
      .catch(function () {
        memberState.activated = false;
        memberState.expireAt = 0;
        memberState.loaded = true;
        return memberState;
      });
  }

  function isMineradioMemberActive() {
    return !!(memberState.activated && memberState.expireAt > Date.now());
  }

  function toast(text) {
    if (typeof window.showToast === 'function') window.showToast(text);
  }

  function panelStyles() {
    const style = document.createElement('style');
    style.textContent = [
      '#mineradio-member-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:420px;max-width:92vw;max-height:84vh;overflow:auto;background:rgba(16,18,26,.98);border:1px solid rgba(120,140,255,.35);border-radius:16px;padding:22px 24px;color:#e8ecff;font-family:inherit;font-size:14px;z-index:99999;box-shadow:0 18px 60px rgba(0,0,0,.65)}',
      '#mineradio-member-panel h3{margin:0 0 4px;font-size:18px;font-weight:700;color:#fff}',
      '#mineradio-member-panel .mr-sub{color:#9aa3c7;font-size:12px;margin-bottom:16px}',
      '#mineradio-member-panel .mr-status{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;background:rgba(120,140,255,.12);margin-bottom:16px}',
      '#mineradio-member-panel .mr-dot{width:8px;height:8px;border-radius:50%;background:#5d6b8f}',
      '#mineradio-member-panel .mr-dot.on{background:#34d399;box-shadow:0 0 8px #34d399}',
      '#mineradio-member-panel .mr-field{margin-bottom:10px}',
      '#mineradio-member-panel .mr-field label{display:block;font-size:12px;color:#9aa3c7;margin-bottom:4px}',
      '#mineradio-member-panel input[type=text],#mineradio-member-panel input[type=password],#mineradio-member-panel input[type=number]{width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:1px solid rgba(120,140,255,.3);border-radius:8px;color:#fff;padding:8px 10px;font-size:14px;outline:none}',
      '#mineradio-member-panel .mr-btn{display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;color:#fff;border-radius:8px;padding:8px 16px;font-size:14px;cursor:pointer;margin:4px 6px 4px 0}',
      '#mineradio-member-panel .mr-btn:hover{filter:brightness(1.1)}',
      '#mineradio-member-panel .mr-btn.ghost{background:rgba(255,255,255,.09);border:1px solid rgba(120,140,255,.25)}',
      '#mineradio-member-panel .mr-close{position:absolute;right:14px;top:12px;background:none;border:none;color:#9aa3c7;font-size:20px;cursor:pointer}',
      '#mineradio-member-panel .mr-codes{background:rgba(255,255,255,.06);border-radius:8px;padding:10px;font-family:monospace;font-size:12px;line-height:1.7;white-space:pre-wrap;max-height:180px;overflow:auto;margin:6px 0}',
      '#mineradio-member-panel .mr-track-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px}',
      '#mineradio-member-panel .mr-track-row .mr-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}',
      '#mineradio-member-panel .mr-switch{border:1px solid rgba(120,140,255,.35);background:rgba(255,255,255,.07);color:#cdd6ff;border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer;flex-shrink:0}',
      '#mineradio-member-panel .mr-switch.on{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-color:transparent}',
      '#mineradio-member-panel .mr-track-list{max-height:200px;overflow:auto;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:4px 8px;margin-top:6px}',
      '#mineradio-member-panel .mr-hr{border:none;border-top:1px solid rgba(255,255,255,.1);margin:16px 0}',
      '#mineradio-member-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99998}',
    ].join('');
    document.head.appendChild(style);
  }

  function closePanel() {
    if (memberPanelEl) {
      memberPanelEl.remove();
      memberPanelEl = null;
    }
    const overlay = document.getElementById('mineradio-member-overlay');
    if (overlay) overlay.remove();
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function buildStatusBlock(container) {
    const statusRow = el('div', 'mr-status');
    const dot = el('span', 'mr-dot' + (isMineradioMemberActive() ? ' on' : ''));
    const text = el('span');
    text.textContent = isMineradioMemberActive()
      ? '会员已激活 · 有效期至 ' + expireText(memberState.expireAt)
      : '当前未激活会员';
    statusRow.appendChild(dot);
    statusRow.appendChild(text);
    container.appendChild(statusRow);
  }

  function buildActivateBlock(container) {
    const field = el('div', 'mr-field');
    const label = el('label', '', '激活码（格式 MR-XXXXX-XXXXX-XXXXX-XXXXX）');
    const input = el('input');
    input.type = 'text';
    input.placeholder = '请输入激活码';
    const btn = el('button', 'mr-btn', '激活');
    btn.onclick = function () {
      const code = input.value.trim();
      if (!code) { toast('请输入激活码'); return; }
      btn.disabled = true;
      btn.textContent = '验证中…';
      memberApi().activateMember(code)
        .then(function (res) {
          res = res || {};
          if (res.ok) {
            toast('会员激活成功');
            memberState.activated = true;
            memberState.expireAt = Number(res.expireAt) || 0;
            rebuildPanel();
          } else {
            toast(res.error || '激活失败');
          }
        })
        .catch(function () { toast('激活失败，请重试'); })
        .finally(function () { btn.disabled = false; btn.textContent = '激活'; });
    };
    field.appendChild(label);
    field.appendChild(input);
    field.appendChild(btn);
    container.appendChild(field);
  }

  function buildAdminBlock(container) {
    const hr = el('hr', 'mr-hr');
    container.appendChild(hr);
    const title = el('h4', '', '管理员工具');
    title.style.margin = '0 0 10px';
    container.appendChild(title);
    const passField = el('div', 'mr-field');
    const passLabel = el('label', '', '管理口令');
    const passInput = el('input');
    passInput.type = 'password';
    const unlockBtn = el('button', 'mr-btn', adminUnlocked ? '已解锁' : '解锁');
    unlockBtn.disabled = adminUnlocked;
    const adminBody = el('div');
    adminBody.style.display = adminUnlocked ? '' : 'none';
    passField.appendChild(passLabel);
    passField.appendChild(passInput);
    passField.appendChild(unlockBtn);
    container.appendChild(passField);
    container.appendChild(adminBody);

    unlockBtn.onclick = function () {
      const password = passInput.value.trim();
      if (!password) { toast('请输入管理口令'); return; }
      // 用 adminCodeRecords 验证口令（顺带拉取记录）
      memberApi().adminCodeRecords(password)
        .then(function (res) {
          res = res || {};
          if (res.ok) {
            adminUnlocked = true;
            toast('管理员已解锁');
            adminBody.style.display = '';
            unlockBtn.disabled = true;
            unlockBtn.textContent = '已解锁';
            renderAdminContent(adminBody, password);
          } else {
            toast(res.error || '口令不正确');
          }
        })
        .catch(function () { toast('验证失败'); });
    };

    function renderAdminContent(body, password) {
      // 生成激活码
      const genField = el('div', 'mr-field');
      const genLabel = el('label', '', '生成激活码');
      const row = el('div');
      const countInput = el('input');
      countInput.type = 'number';
      countInput.value = '5';
      countInput.style.width = '70px';
      countInput.style.display = 'inline-block';
      countInput.style.marginRight = '8px';
      const daysInput = el('input');
      daysInput.type = 'number';
      daysInput.value = '30';
      daysInput.style.width = '70px';
      daysInput.style.display = 'inline-block';
      daysInput.style.marginRight = '8px';
      const genBtn = el('button', 'mr-btn', '生成');
      const codeBox = el('div', 'mr-codes');
      codeBox.style.display = 'none';
      const copyBtn = el('button', 'mr-btn ghost', '复制全部');
      copyBtn.style.display = 'none';
      genField.appendChild(genLabel);
      row.appendChild(el('span', '', '数量 '));
      row.appendChild(countInput);
      row.appendChild(el('span', '', ' 天数 '));
      row.appendChild(daysInput);
      row.appendChild(genBtn);
      genField.appendChild(row);
      genField.appendChild(codeBox);
      genField.appendChild(copyBtn);
      body.appendChild(genField);
      genBtn.onclick = function () {
        const count = Math.max(1, Math.min(100, Number(countInput.value) || 5));
        const days = Math.max(1, Math.min(3650, Number(daysInput.value) || 30));
        genBtn.disabled = true;
        memberApi().adminGenerateCodes({ password: password, count: count, days: days })
          .then(function (res) {
            res = res || {};
            if (res.ok && res.codes && res.codes.length) {
              codeBox.textContent = res.codes.join('\n');
              codeBox.style.display = '';
              copyBtn.style.display = '';
              toast('已生成 ' + res.codes.length + ' 个激活码（' + res.days + ' 天）');
            } else {
              toast(res.error || '生成失败');
            }
          })
          .catch(function () { toast('生成失败'); })
          .finally(function () { genBtn.disabled = false; });
      };
      copyBtn.onclick = function () {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(codeBox.textContent || '').then(function () { toast('已复制'); });
        } else {
          const range = document.createRange();
          range.selectNodeContents(codeBox);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          toast('请手动复制');
        }
      };

      // 曲库会员标记
      const libLabel = el('label', '', '曲库歌曲标记（免费 / 会员专属）');
      const trackList = el('div', 'mr-track-list');
      const loadBtn = el('button', 'mr-btn ghost', '加载本地曲库');
      body.appendChild(libLabel);
      body.appendChild(trackList);
      body.appendChild(loadBtn);
      loadBtn.onclick = function () {
        loadBtn.disabled = true;
        memberApi().listLocalMusicLibrary()
          .then(function (res) {
            res = res || {};
            const tracks = res.tracks || [];
            trackList.innerHTML = '';
            if (!tracks.length) {
              trackList.appendChild(el('div', 'mr-track-row', '暂无本地歌曲，请先导入本地音乐'));
              return;
            }
            tracks.forEach(function (track) {
              const row = el('div', 'mr-track-row');
              const name = el('span', 'mr-name', (track.name || '') + (track.artist ? ' · ' + track.artist : ''));
              const sw = el('button', 'mr-switch' + (track.memberOnly ? ' on' : ''), track.memberOnly ? '会员' : '免费');
              sw.onclick = function () {
                memberApi().setLocalMemberOnly(track.localFileId, !track.memberOnly)
                  .then(function (r) {
                    r = r || {};
                    if (r.ok) {
                      track.memberOnly = !!r.memberOnly;
                      sw.className = 'mr-switch' + (track.memberOnly ? ' on' : '');
                      sw.textContent = track.memberOnly ? '会员' : '免费';
                      toast('已标记为' + (track.memberOnly ? '会员专属' : '免费'));
                    } else { toast(r.error || '标记失败'); }
                  })
                  .catch(function () { toast('标记失败'); });
              };
              row.appendChild(name);
              row.appendChild(sw);
              trackList.appendChild(row);
            });
          })
          .catch(function () { toast('加载曲库失败'); })
          .finally(function () { loadBtn.disabled = false; });
      };
    }
  }

  function rebuildPanel() {
    const opened = !!memberPanelEl;
    if (opened) closePanel();
    openMineradioMemberPanel();
  }

  function openMineradioMemberPanel() {
    if (memberPanelEl) { memberPanelEl.style.display = ''; return; }
    panelStyles();
    const overlay = el('div');
    overlay.id = 'mineradio-member-overlay';
    overlay.onclick = closePanel;
    document.body.appendChild(overlay);
    const panel = el('div');
    panel.id = 'mineradio-member-panel';
    const closeBtn = el('button', 'mr-close', '×');
    closeBtn.onclick = closePanel;
    panel.appendChild(closeBtn);
    panel.appendChild(el('h3', '', 'Mineradio 会员'));
    panel.appendChild(el('div', 'mr-sub', '会员可收听曲库中标记为"会员专属"的歌曲'));
    buildStatusBlock(panel);
    if (!isMineradioMemberActive()) buildActivateBlock(panel);
    buildAdminBlock(panel);
    document.body.appendChild(panel);
    memberPanelEl = panel;
    refreshMineradioMemberStatus();
  }

  window.refreshMineradioMemberStatus = refreshMineradioMemberStatus;
  window.isMineradioMemberActive = isMineradioMemberActive;
  window.openMineradioMemberPanel = openMineradioMemberPanel;
  window.closeMineradioMemberPanel = closePanel;

  function mountEntryButton() {
    if (document.getElementById('mineradio-member-entry')) return;
    const entry = document.createElement('button');
    entry.id = 'mineradio-member-entry';
    entry.textContent = '会员';
    entry.style.cssText = 'position:fixed;right:18px;bottom:104px;z-index:99997;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:20px;padding:6px 14px;font-size:12px;cursor:pointer;opacity:.88;box-shadow:0 4px 14px rgba(99,102,241,.35);font-family:inherit';
    entry.onclick = function () { openMineradioMemberPanel(); };
    document.body.appendChild(entry);
  }

  if (document.body) mountEntryButton();
  else document.addEventListener('DOMContentLoaded', mountEntryButton);

  // 启动时读取一次会员状态
  refreshMineradioMemberStatus();
})();
