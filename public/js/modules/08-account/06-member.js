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

  function currentListenerToken() {
    var st = typeof window._listenerAccountState === 'object' && window._listenerAccountState || null;
    return st && st.loggedIn && st.token ? st.token : '';
  }

  function listenerMemberActive() {
    var st = typeof window._listenerAccountState === 'object' && window._listenerAccountState || null;
    return !!(st && st.loggedIn && Number(st.memberUntil) > Date.now());
  }

  function isMineradioMemberActive() {
    // 二改：本机会员 或 当前听众账号会员，二者取其一即视为会员
    return !!((memberState.activated && memberState.expireAt > Date.now()) || listenerMemberActive());
  }

  function toast(text) {
    if (typeof window.showToast === 'function') window.showToast(text);
  }

  function panelStyles() {
    const style = document.createElement('style');
    style.textContent = [
      '#mineradio-member-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:440px;max-width:92vw;max-height:84vh;overflow:auto;background:linear-gradient(112deg,rgba(72,74,76,.72),rgba(24,27,30,.80) 48%,rgba(8,12,14,.84));backdrop-filter:blur(18px) saturate(1.5);-webkit-backdrop-filter:blur(18px) saturate(1.5);border:1px solid rgba(0,245,212,.28);border-radius:18px;padding:22px 24px;color:#e8ecf3;font-family:inherit;font-size:14px;z-index:99999;box-shadow:0 22px 64px rgba(0,0,0,.60),0 0 34px rgba(0,245,212,.06),inset 0 1px 0 rgba(255,255,255,.14)}',
      '#mineradio-member-panel h3{margin:0 0 4px;font-size:18px;font-weight:700;color:#fff}',
      '#mineradio-member-panel .mr-sub{color:#9aa3c7;font-size:12px;margin-bottom:16px}',
      '#mineradio-member-panel .mr-status{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;background:rgba(0,245,212,.10);border:1px solid rgba(0,245,212,.18);margin-bottom:16px}',
      '#mineradio-member-panel .mr-dot{width:8px;height:8px;border-radius:50%;background:#5d6b8f}',
      '#mineradio-member-panel .mr-dot.on{background:#00f5d4;box-shadow:0 0 10px #00f5d4}',
      '#mineradio-member-panel .mr-field{margin-bottom:10px}',
      '#mineradio-member-panel .mr-field label{display:block;font-size:12px;color:#9aa3c7;margin-bottom:4px}',
      '#mineradio-member-panel input[type=text],#mineradio-member-panel input[type=password],#mineradio-member-panel input[type=number]{width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:1px solid rgba(0,245,212,.22);border-radius:8px;color:#fff;padding:8px 10px;font-size:14px;outline:none}',
      '#mineradio-member-panel input:focus{border-color:rgba(0,245,212,.55);box-shadow:0 0 0 2px rgba(0,245,212,.12)}',
      '#mineradio-member-panel .mr-btn{display:inline-block;background:linear-gradient(135deg,#00f5d4,#0a84ff);border:none;color:#03120f;border-radius:8px;padding:8px 16px;font-size:14px;font-weight:700;cursor:pointer;margin:4px 6px 4px 0;box-shadow:0 4px 14px rgba(0,245,212,.22)}',
      '#mineradio-member-panel .mr-btn:hover{filter:brightness(1.1)}',
      '#mineradio-member-panel .mr-btn.ghost{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);color:#dde5f5;box-shadow:none;font-weight:500}',
      '#mineradio-member-panel .mr-close{position:absolute;right:14px;top:12px;background:none;border:none;color:#9aa3c7;font-size:20px;cursor:pointer}',
      '#mineradio-member-panel .mr-codes{background:rgba(0,0,0,.18);border:1px solid rgba(0,245,212,.12);border-radius:8px;padding:10px;font-family:monospace;font-size:12px;line-height:1.7;white-space:pre-wrap;max-height:180px;overflow:auto;margin:6px 0}',
      '#mineradio-member-panel .mr-track-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px}',
      '#mineradio-member-panel .mr-track-row .mr-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}',
      '#mineradio-member-panel .mr-switch{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.07);color:#dde5f5;border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer;flex-shrink:0}',
      '#mineradio-member-panel .mr-switch.on{background:linear-gradient(135deg,#00f5d4,#0a84ff);color:#03120f;border-color:transparent;font-weight:700}',
      '#mineradio-member-panel .mr-track-list{max-height:200px;overflow:auto;border:1px solid rgba(0,245,212,.14);border-radius:10px;padding:4px 8px;margin-top:6px;background:rgba(0,0,0,.14)}',
      '#mineradio-member-panel .mr-hr{border:none;border-top:1px solid rgba(255,255,255,.1);margin:16px 0}',
      '#mineradio-member-overlay{position:fixed;inset:0;background:rgba(0,0,0,.28);z-index:99998}',
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
      memberApi().activateMember(code, currentListenerToken())
        .then(function (res) {
          res = res || {};
          if (res.ok) {
            toast('会员激活成功');
            memberState.activated = true;
            memberState.expireAt = Number(res.expireAt) || 0;
            if (res.boundAccount) {
              if (typeof window.refreshListenerAccountStatus === 'function') window.refreshListenerAccountStatus();
              toast('已绑定账号「' + res.boundAccount.name + '」，会员跟随账号');
            }
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

  // 购买会员（付费下单 → 管理员核销开通；兑换码仍可立即激活）
  function buildBuyBlock(container) {
    const hr = el('hr', 'mr-hr');
    container.appendChild(hr);
    const title = el('h4', '', '购买会员');
    title.style.margin = '0 0 8px';
    container.appendChild(title);

    const plans = [
      { key: 'month', label: '1 个月', price: 8 },
      { key: 'quarter', label: '3 个月', price: 22 },
      { key: 'year', label: '12 个月', price: 68 },
    ];
    const row = el('div');
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.flexWrap = 'wrap';
    let selected = 'month';
    plans.forEach(function (p) {
      const btn = el('button', 'mr-btn' + (p.key === selected ? '' : ' ghost'));
      btn.textContent = p.label + ' ¥' + p.price;
      btn.onclick = function () {
        selected = p.key;
        row.querySelectorAll('button').forEach(b => b.className = 'mr-btn ghost');
        btn.className = 'mr-btn';
      };
      row.appendChild(btn);
    });
    container.appendChild(row);

    const info = el('div', 'mr-dim', '选择套餐并生成订单号，付款后把订单号发给管理员核销，会员自动开通；也可以直接用上方激活码立即激活。');
    info.style.margin = '10px 0 6px';
    container.appendChild(info);

    const orderBox = el('div');
    const makeBtn = el('button', 'mr-btn', '生成订单号');
    makeBtn.onclick = function () {
      const token = currentListenerToken();
      if (!token) { toast('请先登录账号'); return; }
      makeBtn.disabled = true;
      makeBtn.textContent = '生成中…';
      memberApi().listenerCreateOrder({ token: token, plan: selected })
        .then(function (res) {
          res = res || {};
          if (res.ok) {
            toast('订单已生成，付款后联系管理员核销');
            renderOrders(orderBox, token);
          } else {
            toast(res.error || '下单失败');
          }
        })
        .catch(function () { toast('下单失败，请重试'); })
        .finally(function () { makeBtn.disabled = false; makeBtn.textContent = '生成订单号'; });
    };
    orderBox.appendChild(makeBtn);
    orderBox.appendChild(el('div', 'mr-dim', '我的订单：'));
    container.appendChild(orderBox);
    const tokenNow = currentListenerToken();
    if (tokenNow) renderOrders(orderBox, tokenNow);
  }

  function renderOrders(box, token) {
    const listEl = el('div');
    box.appendChild(listEl);
    memberApi().listenerMyOrders({ token: token })
      .then(function (res) {
        res = res || {};
        const orders = (res.orders || []).slice(0, 10);
        listEl.innerHTML = '';
        if (!orders.length) { listEl.appendChild(el('div', 'mr-dim', '暂无订单')); return; }
        orders.forEach(function (o) {
          const line = el('div', 'mr-dim');
          const planMap = { month: '1 个月', quarter: '3 个月', year: '12 个月' };
          line.textContent = o.id + '｜' + (planMap[o.plan] || o.plan) + '｜¥' + o.amount + '｜' + (o.status === 'done' ? '已开通' : '待核销');
          line.style.padding = '2px 0';
          listEl.appendChild(line);
        });
      })
      .catch(function () { listEl.appendChild(el('div', 'mr-dim', '订单加载失败')); });
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
      const copyAllBtn = el('button', 'mr-btn ghost', '复制全部');
      copyAllBtn.style.display = 'none';
      genField.appendChild(genLabel);
      row.appendChild(el('span', '', '数量 '));
      row.appendChild(countInput);
      row.appendChild(el('span', '', ' 天数 '));
      row.appendChild(daysInput);
      row.appendChild(genBtn);
      genField.appendChild(row);
      genField.appendChild(codeBox);
      genField.appendChild(copyAllBtn);
      body.appendChild(genField);

      function copyText(text) {
        const dw = window.desktopWindow || {};
        if (typeof dw.copyText === 'function') {
          dw.copyText(text).then(function (r) {
            if (r && r.ok) toast('已复制');
            else toast('复制失败');
          }).catch(function () { toast('复制失败'); });
          return;
        }
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(text).then(function () { toast('已复制'); }).catch(function () { fallbackCopy(text); });
          return;
        }
        fallbackCopy(text);
      }
      function fallbackCopy(text) {
        const ta = el('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); toast('已复制'); } catch (_) { toast('请手动复制'); }
        document.body.removeChild(ta);
      }

      genBtn.onclick = function () {
        const count = Math.max(1, Math.min(100, Number(countInput.value) || 5));
        const days = Math.max(1, Math.min(3650, Number(daysInput.value) || 30));
        genBtn.disabled = true;
        memberApi().adminGenerateCodes({ password: password, count: count, days: days })
          .then(function (res) {
            res = res || {};
            if (res.ok && res.codes && res.codes.length) {
              codeBox.innerHTML = '';
              res.codes.forEach(function (code) {
                const line = el('div');
                line.style.display = 'flex';
                line.style.alignItems = 'center';
                line.style.gap = '8px';
                line.style.padding = '2px 0';
                const codeText = el('span', '', code);
                codeText.style.flex = '1';
                codeText.style.fontFamily = 'monospace';
                codeText.style.fontSize = '12px';
                const oneCopy = el('button', 'mr-btn ghost small', '复制');
                oneCopy.onclick = function () { copyText(code); };
                line.appendChild(codeText);
                line.appendChild(oneCopy);
                codeBox.appendChild(line);
              });
              codeBox.style.display = '';
              copyAllBtn.style.display = '';
              toast('已生成 ' + res.codes.length + ' 个激活码（' + res.days + ' 天）');
            } else {
              toast(res.error || '生成失败');
            }
          })
          .catch(function () { toast('生成失败'); })
          .finally(function () { genBtn.disabled = false; });
      };
      copyAllBtn.onclick = function () {
        const all = Array.prototype.map.call(codeBox.querySelectorAll('span'), function (s) { return s.textContent; }).join('\n');
        copyText(all);
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
    panel.appendChild(el('div', 'mr-sub', '本平台会员可收听"会员专属"歌曲。歌曲上的平台VIP标识为该平台自身权限，与本平台会员无关'));
    buildStatusBlock(panel);
    if (!isMineradioMemberActive()) buildActivateBlock(panel);
    buildBuyBlock(panel);
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
    if (document.getElementById('mineradio-entry-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'mineradio-entry-bar';
    bar.style.cssText = 'display:flex;gap:6px;align-items:center;-webkit-app-region:no-drag;pointer-events:auto;font-family:inherit';
    function mkBtn(id, text, grad, onClick) {
      const b = document.createElement('button');
      b.id = id;
      b.textContent = text;
      b.title = text;
      b.style.cssText = 'background:' + grad + ';color:#fff;border:none;border-radius:999px;padding:0 12px;height:26px;font-size:11px;font-weight:700;cursor:pointer;opacity:.92;box-shadow:0 3px 10px rgba(0,0,0,.3);font-family:inherit;letter-spacing:.05em';
      b.onclick = onClick;
      return b;
    }
    bar.appendChild(mkBtn('mineradio-member-entry', '会员', '#111418', function () { window.openMineradioMemberPanel(); }));
    bar.appendChild(mkBtn('mineradio-creator-entry', '创作者', '#111418', function () { window.openCreatorCenter(); }));
    bar.appendChild(mkBtn('mineradio-creator-browse-entry', '专区', '#111418', function () { window.openCreatorBrowse(); }));
    bar.appendChild(mkBtn('mineradio-admin-entry', '平台管理', '#111418', function () { window.openCreatorAdmin(); }));
    bar.appendChild(mkBtn('mineradio-listener-entry', '账号', '#111418', function () { if (typeof window.openListenerAccountPanel === 'function') window.openListenerAccountPanel(); }));
    bar.appendChild(mkBtn('mineradio-settings-entry', '设置', '#111418', function () { if (typeof window.openSettingsPanel === 'function') window.openSettingsPanel(); }));
    // 固定在顶部标题栏 DIY 按钮旁边
    const diy = document.getElementById('diy-mode-btn');
    const controls = document.querySelector('.desktop-window-controls');
    if (diy && diy.parentNode) diy.parentNode.insertBefore(bar, diy.nextSibling);
    else if (controls) controls.appendChild(bar);
    else document.body.appendChild(bar);
  }

  if (document.body) mountEntryButton();
  else document.addEventListener('DOMContentLoaded', mountEntryButton);

  // 启动时读取一次会员状态
  refreshMineradioMemberStatus();
})();
