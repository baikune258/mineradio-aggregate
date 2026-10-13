// 创作者中心（二改新增）：注册/登录、上传作品、我的作品与播放统计
(function () {
  'use strict';
  var API = '/api/creator';
  var TOKEN_KEY = 'mineradio-creator-token';
  var NAME_KEY = 'mineradio-creator-name';

  var panelEl = null;
  var overlayEl = null;

  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; } }
  function getCreatorName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (_) { return ''; } }
  function setToken(t, name) { try { localStorage.setItem(TOKEN_KEY, t); localStorage.setItem(NAME_KEY, name); } catch (_) {} }
  function clearToken() { try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(NAME_KEY); } catch (_) {} }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function toast(msg) {
    if (typeof showToast === 'function') showToast(msg);
    else if (typeof window.showToast === 'function') window.showToast(msg);
    else console.log('[Creator]', msg);
  }

  function panelStyles() {
    if (document.getElementById('mr-creator-styles')) return;
    var s = document.createElement('style');
    s.id = 'mr-creator-styles';
    s.textContent = [
      '#mr-creator-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99998}',
      '#mr-creator-panel{position:fixed;right:18px;top:50%;transform:translateY(-50%);width:360px;max-height:82vh;overflow-y:auto;background:#16161d;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:20px;z-index:99999;color:#eee;font-size:13px;box-shadow:0 18px 50px rgba(0,0,0,.5)}',
      '#mr-creator-panel h3{margin:0 0 6px;font-size:16px;color:#fff}',
      '#mr-creator-panel .mr-sub{color:#9aa;margin-bottom:14px}',
      '.mr-btn{display:inline-block;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);color:#fff;border-radius:10px;padding:7px 14px;font-size:13px;cursor:pointer;margin:4px 6px 4px 0;font-family:inherit}',
      '.mr-btn:hover{background:rgba(255,255,255,.14)}',
      '.mr-btn.primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);border-color:transparent}',
      '.mr-btn.danger{border-color:rgba(239,68,68,.5);color:#fca5a5}',
      '.mr-input{width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);border-radius:10px;color:#fff;padding:8px 10px;font-size:13px;margin:4px 0;font-family:inherit}',
      '.mr-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.mr-card{background:rgba(255,255,255,.05);border-radius:12px;padding:10px 12px;margin:8px 0}',
      '.mr-badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:8px;margin-left:6px}',
      '.mr-badge.pending{background:rgba(245,158,11,.2);color:#fcd34d}',
      '.mr-badge.approved{background:rgba(34,197,94,.2);color:#86efac}',
      '.mr-badge.rejected{background:rgba(239,68,68,.2);color:#fca5a5}',
      '.mr-badge.vip{background:rgba(168,85,247,.25);color:#d8b4fe}',
      '.mr-badge.free{background:rgba(148,163,184,.2);color:#cbd5e1}',
      '.mr-close{position:absolute;right:14px;top:10px;background:none;border:none;color:#aaa;font-size:20px;cursor:pointer}',
      '.mr-sec{font-weight:600;color:#c7d2fe;margin:16px 0 6px}',
      '.mr-dim{color:#889}',
      '#mr-creator-panel input[type=file]{font-size:12px;color:#bbb}',
    ].join('\n');
    document.head.appendChild(s);
  }

  function closePanel() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    if (panelEl) { panelEl.remove(); panelEl = null; }
  }

  function openCenter() {
    if (panelEl) { panelEl.style.display = ''; if (overlayEl) overlayEl.style.display = ''; refreshCenter(); return; }
    panelStyles();
    overlayEl = el('div');
    overlayEl.id = 'mr-creator-overlay';
    overlayEl.onclick = closePanel;
    document.body.appendChild(overlayEl);
    panelEl = el('div');
    panelEl.id = 'mr-creator-panel';
    var closeBtn = el('button', 'mr-close', '×');
    closeBtn.onclick = closePanel;
    panelEl.appendChild(closeBtn);
    refreshCenter();
    document.body.appendChild(panelEl);
  }

  function refreshCenter() {
    if (!panelEl) return;
    panelEl.innerHTML = '';
    var title = el('h3', '', '创作者中心');
    panelEl.appendChild(title);
    panelEl.appendChild(el('div', 'mr-sub', '上传你的原创歌曲，免费或会员定价，平台抽成 30%'));
    var token = getToken();
    if (!token) { buildLoginBlock(panelEl); }
    else { buildLoggedBlock(panelEl); }
  }

  function buildLoginBlock(root) {
    root.appendChild(el('div', 'mr-sec', '登录 / 注册'));
    var nameInput = el('input', 'mr-input');
    nameInput.placeholder = '创作者昵称（2-24 字符）';
    var passInput = el('input', 'mr-input');
    passInput.type = 'password';
    passInput.placeholder = '口令（至少 6 位）';
    root.appendChild(nameInput);
    root.appendChild(passInput);
    var row = el('div', 'mr-row');
    var regBtn = el('button', 'mr-btn', '注册');
    var loginBtn = el('button', 'mr-btn primary', '登录');
    row.appendChild(regBtn);
    row.appendChild(loginBtn);
    root.appendChild(row);
    regBtn.onclick = function () {
      fetch(API + '/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.value, password: passInput.value }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d.ok) { setToken(d.token, d.creator.name); toast('注册成功，欢迎入驻'); refreshCenter(); }
        else toast(d.error || '注册失败');
      }).catch(function () { toast('网络异常'); });
    };
    loginBtn.onclick = function () {
      fetch(API + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.value, password: passInput.value }),
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d.ok) { setToken(d.token, d.creator.name); toast('登录成功'); refreshCenter(); }
        else toast(d.error || '登录失败');
      }).catch(function () { toast('网络异常'); });
    };
    root.appendChild(el('div', 'mr-card mr-dim', '提示：创作者账号与作品数据只保存在本机安装目录，上传即视为同意平台审核规则。'));
  }

  function buildLoggedBlock(root) {
    var headRow = el('div', 'mr-row');
    headRow.appendChild(el('span', '', '创作者：' + getCreatorName()));
    var logoutBtn = el('button', 'mr-btn danger', '退出');
    logoutBtn.onclick = function () { clearToken(); toast('已退出'); refreshCenter(); };
    headRow.appendChild(logoutBtn);
    root.appendChild(headRow);

    // 上传表单
    root.appendChild(el('div', 'mr-sec', '上传作品'));
    var titleInput = el('input', 'mr-input');
    titleInput.placeholder = '歌曲名（必填）';
    var artistInput = el('input', 'mr-input');
    artistInput.placeholder = '歌手名（默认佚名）';
    var lyricInput = el('textarea', 'mr-input');
    lyricInput.placeholder = '歌词（可选，逐行时间格式 [mm:ss.xx] 或纯文本）';
    lyricInput.style.minHeight = '70px';
    var pricingRow = el('div', 'mr-row');
    var freeRadio = el('label', 'mr-dim');
    freeRadio.innerHTML = '<input type="radio" name="mr-pricing" value="free" checked> 免费';
    var vipRadio = el('label', 'mr-dim');
    vipRadio.innerHTML = '<input type="radio" name="mr-pricing" value="vip"> 会员专属';
    pricingRow.appendChild(freeRadio);
    pricingRow.appendChild(vipRadio);
    var coverInput = el('input', 'mr-input');
    coverInput.type = 'file';
    coverInput.accept = 'image/*';
    var audioInput = el('input', 'mr-input');
    audioInput.type = 'file';
    audioInput.accept = 'audio/*';
    root.appendChild(titleInput);
    root.appendChild(artistInput);
    root.appendChild(lyricInput);
    root.appendChild(pricingRow);
    root.appendChild(coverInput);
    root.appendChild(audioInput);
    var uploadBtn = el('button', 'mr-btn primary', '提交上传（待审核）');
    var autoApproveBox = el('label', 'mr-dim');
    autoApproveBox.innerHTML = '<input type="checkbox" id="mr-autoapprove"> 平台方免审（验证管理口令后直接上架）';
    root.appendChild(autoApproveBox);
    root.appendChild(uploadBtn);
    uploadBtn.onclick = function () {
      var audioFile = audioInput.files && audioInput.files[0];
      if (!audioFile) { toast('请选择音频文件'); return; }
      if (!titleInput.value.trim()) { toast('请填写歌曲名'); return; }
      uploadBtn.disabled = true;
      uploadBtn.textContent = '上传中…';
      var wantAuto = document.getElementById('mr-autoapprove') && document.getElementById('mr-autoapprove').checked;
      function doUpload(autoToken) {
        var fd = new FormData();
        fd.append('token', getToken());
        fd.append('title', titleInput.value.trim());
        fd.append('artist', artistInput.value.trim());
        fd.append('memberOnly', document.querySelector('input[name="mr-pricing"]:checked').value === 'vip' ? '1' : '0');
        fd.append('lyricText', lyricInput.value || '');
        if (autoToken) fd.append('autoApproveToken', autoToken);
        fd.append('audio', audioFile);
        if (coverInput.files && coverInput.files[0]) fd.append('cover', coverInput.files[0]);
        fetch(API + '/upload', { method: 'POST', body: fd })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            uploadBtn.disabled = false;
            uploadBtn.textContent = '提交上传（待审核）';
            if (d.ok) { toast(d.song && d.song.status === 'approved' ? '上传成功，已直接上架' : '上传成功，等待平台审核'); refreshCenter(); }
            else toast(d.error || '上传失败');
          })
          .catch(function () {
            uploadBtn.disabled = false;
            uploadBtn.textContent = '提交上传（待审核）';
            toast('上传失败，请重试');
          });
      }
      if (wantAuto) {
        var p = window.prompt('请输入管理口令（平台方免审）：');
        if (p == null) { uploadBtn.disabled = false; uploadBtn.textContent = '提交上传（待审核）'; return; }
        var dw = window.desktopWindow || {};
        if (typeof dw.creatorAutoApproveToken !== 'function') { toast('免审功能不可用'); uploadBtn.disabled = false; uploadBtn.textContent = '提交上传（待审核）'; return; }
        dw.creatorAutoApproveToken(String(p || ''))
          .then(function (r) {
            if (r && r.ok) { doUpload(r.token); }
            else { toast((r && r.error) || '管理口令不正确'); uploadBtn.disabled = false; uploadBtn.textContent = '提交上传（待审核）'; }
          })
          .catch(function () { toast('免审验证失败'); uploadBtn.disabled = false; uploadBtn.textContent = '提交上传（待审核）'; });
        return;
      }
      doUpload(null);
    };

    // 我的作品
    root.appendChild(el('div', 'mr-sec', '我的作品与播放'));
    var listBox = el('div');
    root.appendChild(listBox);
    fetch(API + '/me?token=' + encodeURIComponent(getToken()))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { clearToken(); refreshCenter(); return; }
        var mine = d.songs || [];
        if (!mine.length) { listBox.appendChild(el('div', 'mr-dim', '还没有作品，上传第一首吧')); return; }
        var totalFree = mine.reduce(function (a, s) { return a + s.playsFree; }, 0);
        var totalVip = mine.reduce(function (a, s) { return a + s.playsMember; }, 0);
        listBox.appendChild(el('div', 'mr-card mr-dim', '免费播放 ' + totalFree + ' 次 / 会员播放 ' + totalVip + ' 次'));
        mine.forEach(function (s) {
          var card = el('div', 'mr-card');
          var head = el('div', 'mr-row');
          head.appendChild(el('span', '', s.title + ' — ' + s.artist));
          var badge = el('span', 'mr-badge ' + s.status, s.status === 'approved' ? '已上架' : (s.status === 'rejected' ? '已拒绝' : '待审核'));
          head.appendChild(badge);
          var pricing = el('span', 'mr-badge ' + (s.memberOnly ? 'vip' : 'free'), s.memberOnly ? '会员' : '免费');
          head.appendChild(pricing);
          card.appendChild(head);
          card.appendChild(el('div', 'mr-dim', '播放：免费 ' + s.playsFree + ' / 会员 ' + s.playsMember));
          listBox.appendChild(card);
        });
      })
      .catch(function () { listBox.appendChild(el('div', 'mr-dim', '加载失败')); });

    root.appendChild(el('div', 'mr-sec', '收益说明'));
    root.appendChild(el('div', 'mr-card mr-dim', '平台按月结算：录入当月会员收入总额后，按本月各作品会员播放占比分配 70%（平台留 30%）。结算单在平台管理面板生成。'));
  }

  window.openCreatorCenter = openCenter;
  window.closeCreatorCenter = closePanel;
})();
