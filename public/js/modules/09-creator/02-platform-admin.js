// 平台管理面板（二改新增）：作品审核、创作者概览、月结算分成（平台抽 30%）
(function () {
  'use strict';

  var panelEl = null;
  var overlayEl = null;
  var unlocked = false;
  var adminPassword = '';

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
  function api() { return window.desktopWindow || {}; }

  function panelStyles() {
    if (document.getElementById('mr-admin-styles')) return;
    var s = document.createElement('style');
    s.id = 'mr-admin-styles';
    s.textContent = [
      '#mr-admin-overlay{position:fixed;inset:0;background:rgba(0,0,0,.28);z-index:99996}',
      '#mr-admin-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:440px;max-height:84vh;overflow-y:auto;background:#16161d;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:20px;z-index:99997;color:#eee;font-size:13px;box-shadow:0 18px 50px rgba(0,0,0,.5)}',
      '#mr-admin-panel h3{margin:0 0 6px;font-size:16px;color:#fff}',
      '.ma-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.ma-card{background:rgba(255,255,255,.05);border-radius:12px;padding:10px 12px;margin:8px 0}',
      '.ma-badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:8px;margin-left:6px}',
      '.ma-badge.pending{background:rgba(245,158,11,.2);color:#fcd34d}',
      '.ma-badge.approved{background:rgba(34,197,94,.2);color:#86efac}',
      '.ma-badge.rejected{background:rgba(239,68,68,.2);color:#fca5a5}',
      '.ma-badge.vip{background:rgba(168,85,247,.25);color:#d8b4fe}',
      '.ma-badge.free{background:rgba(148,163,184,.2);color:#cbd5e1}',
      '.ma-btn{display:inline-block;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);color:#fff;border-radius:10px;padding:6px 12px;font-size:13px;cursor:pointer;margin:4px 6px 4px 0;font-family:inherit}',
      '.ma-btn:hover{background:rgba(255,255,255,.14)}',
      '.ma-btn.ok{background:rgba(34,197,94,.2);border-color:rgba(34,197,94,.4)}',
      '.ma-btn.no{background:rgba(239,68,68,.2);border-color:rgba(239,68,68,.4)}',
      '.ma-btn.primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);border-color:transparent}',
      '.ma-input{width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);border-radius:10px;color:#fff;padding:8px 10px;font-size:13px;margin:4px 0;font-family:inherit}',
      '.ma-sec{font-weight:600;color:#c7d2fe;margin:16px 0 6px}',
      '.ma-dim{color:#889}',
      '.ma-close{position:absolute;right:14px;top:10px;background:none;border:none;color:#aaa;font-size:20px;cursor:pointer}',
      '.ma-inline{width:45%;display:inline-block;box-sizing:border-box;margin-right:2%}',
    ].join('\n');
    document.head.appendChild(s);
  }

  function closePanel() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    if (panelEl) { panelEl.remove(); panelEl = null; }
    unlocked = false;
    adminPassword = '';
  }

  function openAdmin() {
    if (panelEl) { panelEl.style.display = ''; if (overlayEl) overlayEl.style.display = ''; return; }
    panelStyles();
    overlayEl = el('div');
    overlayEl.id = 'mr-admin-overlay';
    overlayEl.onclick = closePanel;
    document.body.appendChild(overlayEl);
    panelEl = el('div');
    panelEl.id = 'mr-admin-panel';
    var closeBtn = el('button', 'ma-close', '×');
    closeBtn.onclick = closePanel;
    panelEl.appendChild(closeBtn);
    panelEl.appendChild(el('h3', '', '创作者平台管理'));
    panelEl.appendChild(el('div', 'ma-dim', '审核作品、查看创作者、按月结算分成（平台抽 30% / 创作者 70%）'));
    buildLockBlock();
    document.body.appendChild(panelEl);
  }

  function buildLockBlock() {
    panelEl.appendChild(el('div', 'ma-sec', '管理员验证'));
    var passInput = el('input', 'ma-input');
    passInput.type = 'password';
    passInput.placeholder = '管理口令（与会员管理口令一致）';
    panelEl.appendChild(passInput);
    var unlockBtn = el('button', 'ma-btn primary', '解锁');
    panelEl.appendChild(unlockBtn);
    unlockBtn.onclick = function () {
      unlockBtn.disabled = true;
      unlockBtn.textContent = '验证中…';
      api().creatorAdminOverview(passInput.value)
        .then(function (d) {
          unlockBtn.disabled = false;
          unlockBtn.textContent = '解锁';
          if (!d.ok) { toast(d.error || '口令错误'); return; }
          unlocked = true;
          adminPassword = passInput.value.trim();
          renderOverview(d);
        })
        .catch(function () { unlockBtn.disabled = false; unlockBtn.textContent = '解锁'; toast('验证失败'); });
    };
  }

  function renderOverview(data) {
    panelEl.innerHTML = '';
    var closeBtn = el('button', 'ma-close', '×');
    closeBtn.onclick = closePanel;
    panelEl.appendChild(closeBtn);
    panelEl.appendChild(el('h3', '', '创作者平台管理'));
    panelEl.appendChild(el('div', 'ma-dim', '审核作品、查看创作者、按月结算分成（平台抽 30% / 创作者 70%）'));

    // 待审核
    var pending = (data.songs || []).filter(function (s) { return s.status === 'pending'; });
    panelEl.appendChild(el('div', 'ma-sec', '待审核作品（' + pending.length + '）'));
    if (!pending.length) panelEl.appendChild(el('div', 'ma-dim', '暂无待审核作品'));
    pending.forEach(function (s) {
      var card = el('div', 'ma-card');
      var head = el('div', 'ma-row');
      head.appendChild(el('span', '', s.title + ' — ' + s.artist));
      head.appendChild(el('span', 'ma-badge ' + (s.memberOnly ? 'vip' : 'free'), s.memberOnly ? '会员' : '免费'));
      card.appendChild(head);
      card.appendChild(el('div', 'ma-dim', '创作者：' + s.creatorName + ' ｜ 提交于 ' + new Date(s.createdAt).toLocaleString('zh-CN')));
      var row = el('div', 'ma-row');
      var okBtn = el('button', 'ma-btn ok', '通过上架');
      var noBtn = el('button', 'ma-btn no', '拒绝');
      row.appendChild(okBtn);
      row.appendChild(noBtn);
      card.appendChild(row);
      okBtn.onclick = function () { audit(s.id, true); };
      noBtn.onclick = function () { audit(s.id, false); };
      panelEl.appendChild(card);
    });

    // 会员订单核销（付费开通会员）
    panelEl.appendChild(el('div', 'ma-sec', '会员订单（待核销）'));
    var orderBox = el('div');
    orderBox.appendChild(el('div', 'ma-dim', '加载中…'));
    panelEl.appendChild(orderBox);
    function loadOrders() {
      var dw = window.desktopWindow || {};
      var req = (typeof dw.listenerPendingOrders === 'function')
        ? dw.listenerPendingOrders({ password: adminPassword })
        : fetch('/api/listener/pending-orders?password=' + encodeURIComponent(adminPassword)).then(function (r) { return r.json(); });
      req.then(function (res) {
        res = res || {};
        var orders = (res.orders || []).filter(function (o) { return o.status !== 'done'; });
        orderBox.innerHTML = '';
        if (!orders.length) { orderBox.appendChild(el('div', 'ma-dim', '暂无待核销订单')); return; }
        var planMap = { month: '1 个月', quarter: '3 个月', year: '12 个月' };
        orders.forEach(function (o) {
          var card = el('div', 'ma-card');
          card.appendChild(el('div', '', o.id + ' ｜ ' + (planMap[o.plan] || o.plan) + ' ｜ ¥' + o.amount));
          card.appendChild(el('div', 'ma-dim', '账号：' + (o.accountName || '未绑定') + ' ｜ 状态：' + (o.status === 'done' ? '已开通' : '待核销')));
          var okBtn = el('button', 'ma-btn ok', '确认收款并开通');
          card.appendChild(okBtn);
          okBtn.onclick = function () {
            okBtn.disabled = true;
            okBtn.textContent = '开通中…';
            var dw2 = window.desktopWindow || {};
            var appr = (typeof dw2.listenerApproveOrder === 'function')
              ? dw2.listenerApproveOrder({ password: adminPassword, orderId: o.id })
              : fetch('/api/listener/approve-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: adminPassword, orderId: o.id }) }).then(function (r) { return r.json(); });
            appr.then(function (r2) {
              if (r2 && r2.ok) { toast('已开通会员'); loadOrders(); }
              else toast((r2 && r2.error) || '核销失败');
            }).catch(function () { toast('核销失败'); }).finally(function () { okBtn.disabled = false; });
          };
          card.appendChild(okBtn);
          orderBox.appendChild(card);
        });
      }).catch(function () { orderBox.innerHTML = ''; orderBox.appendChild(el('div', 'ma-dim', '订单加载失败')); });
    }
    loadOrders();

    // 创作者
    panelEl.appendChild(el('div', 'ma-sec', '创作者（' + (data.creators || []).length + '）'));
    (data.creators || []).forEach(function (c) {
      var card = el('div', 'ma-card');
      card.appendChild(el('div', '', c.name));
      card.appendChild(el('div', 'ma-dim', '作品 ' + c.songCount + '（上架 ' + c.approvedCount + '）｜免费播放 ' + c.freePlays + ' ｜ 会员播放 ' + c.memberPlays));
      panelEl.appendChild(card);
    });

    // 结算
    panelEl.appendChild(el('div', 'ma-sec', '月结算分成（平台 30% / 创作者 70%）'));
    var monthInput = el('input', 'ma-input ma-inline');
    monthInput.placeholder = '月份 YYYY-MM，如 2026-10';
    var totalInput = el('input', 'ma-input ma-inline');
    totalInput.placeholder = '当月卖码收入（元）';
    totalInput.type = 'number';
    totalInput.min = '0';
    panelEl.appendChild(monthInput);
    panelEl.appendChild(totalInput);
    var recBtn = el('button', 'ma-btn primary', '录入并结算');
    panelEl.appendChild(recBtn);
    recBtn.onclick = function () {
      if (!monthInput.value.trim() || totalInput.value === '') { toast('请填写月份和收入'); return; }
      if (!unlocked || !adminPassword) { toast('请先解锁管理面板'); return; }
      recBtn.disabled = true;
      recBtn.textContent = '结算中…';
      api().creatorAdminRevenue({ password: adminPassword, month: monthInput.value.trim(), total: Number(totalInput.value) })
        .then(function (d) {
          recBtn.disabled = false;
          recBtn.textContent = '录入并结算';
          if (!d.ok) { toast(d.error || '结算失败'); return; }
          toast('结算完成：平台留 ' + d.record.platformCut + ' 元，创作者分 ' + d.record.creatorShare + ' 元');
          api().creatorAdminOverview(adminPassword).then(function (d2) {
            if (d2.ok) renderOverview(d2);
            else toast(d2.error || '验证失败');
          }).catch(function () { toast('加载失败'); });
        })
        .catch(function () { recBtn.disabled = false; recBtn.textContent = '录入并结算'; toast('结算失败'); });
    };
    var months = data.months || [];
    if (months.length) {
      months.forEach(function (m) {
        var card = el('div', 'ma-card');
        card.appendChild(el('div', '', m.month + ' ｜ 收入 ' + m.totalRevenue + ' 元 ｜ 平台留 ' + m.platformCut + ' ｜ 创作者分 ' + m.creatorShare));
        var exportBtn = el('button', 'ma-btn', '导出结算单');
        card.appendChild(exportBtn);
        exportBtn.onclick = function () { exportMonth(m.month); };
        (m.creators || []).slice(0, 5).forEach(function (c) {
          card.appendChild(el('div', 'ma-dim', '  ' + c.creatorName + '：会员播放 ' + c.memberPlays + '，应得 ' + c.amount + ' 元'));
        });
        panelEl.appendChild(card);
      });
    }
    // 重新解锁按钮
    var relock = el('button', 'ma-btn', '重新验证口令');
    relock.onclick = function () { unlocked = false; adminPassword = ''; panelEl.innerHTML = ''; var c = el('button', 'ma-close', '×'); c.onclick = closePanel; panelEl.appendChild(c); panelEl.appendChild(el('h3', '', '创作者平台管理')); buildLockBlock(); };
    panelEl.appendChild(relock);
  }

  function getPassword() {
    // 重新解锁流程使用
    return new Promise(function (resolve) { resolve(''); });
  }

  function audit(songId, approve) {
    if (!unlocked || !adminPassword) { toast('请先解锁管理面板'); return; }
    api().creatorAdminAudit({ password: adminPassword, songId: songId, approve: approve })
      .then(function (d) {
        if (d.ok) { toast(approve ? '已通过上架' : '已拒绝'); reloadOverview(); }
        else toast(d.error || '操作失败');
      })
      .catch(function () { toast('操作失败'); });
  }

  function exportMonth(month) {
    var p = window.prompt('请输入管理口令：');
    if (p == null) return;
    api().creatorAdminExport({ password: String(p || ''), month: month })
      .then(function (d) {
        if (!d.ok) { toast(d.error || '导出失败'); return; }
        if (window.desktopWindow && typeof window.desktopWindow.copyText === 'function') {
          window.desktopWindow.copyText(d.text);
          toast('结算单已复制到剪贴板，可粘贴保存');
        } else {
          window.prompt('结算单内容（已复制逻辑不可用，请手动复制）：', d.text);
        }
      })
      .catch(function () { toast('导出失败'); });
  }

  function reloadOverview() {
    var p = window.prompt('请输入管理口令：');
    if (p == null) return;
    api().creatorAdminOverview(String(p || ''))
      .then(function (d) {
        if (d.ok) { renderOverview(d); }
        else toast(d.error || '验证失败');
      })
      .catch(function () { toast('加载失败'); });
  }

  window.openCreatorAdmin = openAdmin;
  window.closeCreatorAdmin = closePanel;
})();
