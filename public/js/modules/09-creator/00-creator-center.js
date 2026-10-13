// 创作者中心（二改新增）：注册/登录、上传作品、我的作品与播放统计
(function () {
  'use strict';
  var API = '/api/creator';
  var TOKEN_KEY = 'mineradio-creator-token';
  var NAME_KEY = 'mineradio-creator-name';

  var panelEl = null;
  var overlayEl = null;
  var creatorAdminPwd = ''; // 免审管理口令（输过一次后本会话不再询问）

  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; } }
  function getCreatorName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (_) { return ''; } }
  function setToken(t, name) { try { localStorage.setItem(TOKEN_KEY, t); localStorage.setItem(NAME_KEY, name); } catch (_) {} }
  function clearToken() { try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(NAME_KEY); } catch (_) {} }

  // 二改：登录过的账号不用再登一遍——已登录听众账号时，自动复用进入创作者中心。
  // 派生口令由听众账号 id 稳定生成（同一账号永远一致），服务器自动注册/登录创作者身份。
  function listenerDerivedPassword(accountId) {
    var base = String(accountId || '').replace(/[^a-z0-9]/gi, '');
    return 'mr-auto-' + (base.slice(0, 20) || 'default');
  }
  function autoEnterWithListener() {
    var ls = window._listenerAccountState;
    if (!ls || !ls.loggedIn || !ls.account || !ls.account.id) return false;
    var name = String(ls.account.name || '');
    var pass = listenerDerivedPassword(ls.account.id);
    var tryLogin = function () {
      return fetch(API + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, password: pass }),
      }).then(function (r) { return r.json(); });
    };
    return fetch(API + '/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, password: pass }),
    }).then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok) { setToken(d.token, d.creator.name); refreshCenter(); return true; }
        return tryLogin().then(function (l) {
          if (l && l.ok) { setToken(l.token, l.creator.name); refreshCenter(); return true; }
          return false;
        });
      })
      .catch(function () { return false; });
  }

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
      '#mr-creator-overlay{position:fixed;inset:0;background:rgba(0,0,0,.28);z-index:99998}',
      '#mr-creator-panel{position:fixed;right:18px;top:50%;transform:translateY(-50%);width:380px;max-height:82vh;overflow-y:auto;background:linear-gradient(112deg,rgba(72,74,76,.72),rgba(24,27,30,.80) 48%,rgba(8,12,14,.84));backdrop-filter:blur(18px) saturate(1.5);-webkit-backdrop-filter:blur(18px) saturate(1.5);border:1px solid rgba(0,245,212,.28);border-radius:18px;padding:20px;z-index:99999;color:#e8ecf3;font-size:13px;box-shadow:0 22px 64px rgba(0,0,0,.60),0 0 34px rgba(0,245,212,.06),inset 0 1px 0 rgba(255,255,255,.14)}',
      '#mr-creator-panel h3{margin:0 0 6px;font-size:16px;color:#fff}',
      '#mr-creator-panel .mr-sub{color:#9aa;margin-bottom:14px}',
      '.mr-btn{display:inline-block;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#dde5f5;border-radius:10px;padding:7px 14px;font-size:13px;cursor:pointer;margin:4px 6px 4px 0;font-family:inherit}',
      '.mr-btn:hover{background:rgba(255,255,255,.16)}',
      '.mr-btn.primary{background:linear-gradient(135deg,#00f5d4,#0a84ff);border-color:transparent;color:#03120f;font-weight:700;box-shadow:0 4px 14px rgba(0,245,212,.22)}',
      '.mr-btn.danger{border-color:rgba(239,68,68,.5);color:#fca5a5}',
      '.mr-input{width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);border:1px solid rgba(0,245,212,.22);border-radius:10px;color:#fff;padding:8px 10px;font-size:13px;margin:4px 0;font-family:inherit}',
      '.mr-dropzone{border:2px dashed rgba(0,245,212,.4);border-radius:12px;padding:20px 12px;text-align:center;color:#9aa3c7;margin:8px 0;cursor:pointer;transition:all .2s;font-size:13px;background:rgba(255,255,255,.03)}',
      '.mr-dropzone.over{border-color:#00f5d4;background:rgba(0,245,212,.10);color:#e8ecff}',
      '.mr-dropzone.done{border-style:solid;border-color:rgba(52,211,153,.55);color:#86efac;background:rgba(52,211,153,.08)}',
      '.mr-dropzone + .mr-dim{font-size:12px;color:#86efac;margin:-2px 0 6px}',
      '.mr-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.mr-card{background:rgba(0,0,0,.16);border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:10px 12px;margin:8px 0}',
      '.mr-badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:8px;margin-left:6px}',
      '.mr-badge.pending{background:rgba(245,158,11,.2);color:#fcd34d}',
      '.mr-badge.approved{background:rgba(34,197,94,.2);color:#86efac}',
      '.mr-badge.rejected{background:rgba(239,68,68,.2);color:#fca5a5}',
      '.mr-badge.vip{background:linear-gradient(135deg,rgba(0,245,212,.28),rgba(10,132,255,.28));color:#7dffe9}',
      '.mr-badge.free{background:rgba(148,163,184,.2);color:#cbd5e1}',
      '.mr-close{position:absolute;right:14px;top:10px;background:none;border:none;color:#aaa;font-size:20px;cursor:pointer}',
      '.mr-sec{font-weight:600;color:#00f5d4;margin:16px 0 6px}',
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
    if (token) { buildLoggedBlock(panelEl); }
    else if (typeof autoEnterWithListener === 'function' && autoEnterWithListener()) { /* 正在用听众账号自动进入 */ }
    else { buildLoginBlock(panelEl); }
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
    // 二改：已登录过我们自己的账号时，无需再单独注册/登录创作者账号
    var ls = window._listenerAccountState;
    if (ls && ls.loggedIn && ls.account && ls.account.name) {
      var autoBtn = el('button', 'mr-btn primary', '用账号「' + ls.account.name + '」直接进入，无需再登');
      autoBtn.style.width = '100%';
      autoBtn.style.marginTop = '6px';
      autoBtn.onclick = function () {
        autoBtn.disabled = true;
        autoBtn.textContent = '正在进入…';
        autoEnterWithListener();
      };
      root.appendChild(autoBtn);
    }
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
    // 音频：拖拽上传 / 点击选择（二改）
    var droppedAudioFile = null;
    var dropZone = el('div', 'mr-dropzone', '把音乐文件拖到这里即可上传，或点击选择文件');
    var dropHint = el('div', 'mr-dim', '');
    var audioInput = el('input', 'mr-input');
    audioInput.type = 'file';
    audioInput.accept = 'audio/*';
    audioInput.style.display = 'none';
    dropZone.onclick = function () { audioInput.click(); };
    audioInput.onchange = function () {
      if (audioInput.files && audioInput.files[0]) {
        droppedAudioFile = audioInput.files[0];
        dropZone.className = 'mr-dropzone done';
        dropHint.textContent = '已选择：' + droppedAudioFile.name;
      }
    };
    dropZone.addEventListener('dragover', function (e) { e.preventDefault(); e.stopPropagation(); dropZone.className = 'mr-dropzone over'; });
    dropZone.addEventListener('dragenter', function (e) { e.preventDefault(); e.stopPropagation(); dropZone.className = 'mr-dropzone over'; });
    dropZone.addEventListener('dragleave', function () { dropZone.className = 'mr-dropzone' + (droppedAudioFile ? ' done' : ''); });
    dropZone.addEventListener('drop', function (e) {
      e.preventDefault(); e.stopPropagation();
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      var audioLike = f && (/^audio\//.test(f.type || '') || /\.(mp3|flac|wav|m4a|ogg|aac|ape|wma)$/i.test(f.name || ''));
      if (f && audioLike) {
        droppedAudioFile = f;
        dropZone.className = 'mr-dropzone done';
        dropHint.textContent = '已选择：' + f.name;
        toast('已载入音频：' + f.name);
      } else { toast('请拖入音频文件（mp3 / flac / wav / m4a / ogg / aac 等）'); }
    });
    root.appendChild(titleInput);
    root.appendChild(artistInput);
    root.appendChild(lyricInput);
    root.appendChild(pricingRow);
    root.appendChild(coverInput);
    root.appendChild(dropZone);
    root.appendChild(dropHint);
    root.appendChild(audioInput);
    var uploadBtn = el('button', 'mr-btn primary', '提交上传（待审核）');
    var autoApproveBox = el('label', 'mr-dim');
    autoApproveBox.innerHTML = '<input type="checkbox" id="mr-autoapprove"> 平台方免审（验证管理口令后直接上架）';
    root.appendChild(autoApproveBox);
    root.appendChild(uploadBtn);
    uploadBtn.onclick = function () {
      var audioFile = droppedAudioFile || (audioInput.files && audioInput.files[0]);
      if (!audioFile) { toast('请拖入或选择音频文件'); return; }
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
        var ctrl = new AbortController();
        var timer = setTimeout(function () { ctrl.abort(); }, 120000);
        fetch(API + '/upload', { method: 'POST', body: fd, signal: ctrl.signal })
          .then(function (r) { clearTimeout(timer); return r.json(); })
          .then(function (d) {
            uploadBtn.disabled = false;
            uploadBtn.textContent = '提交上传（待审核）';
            if (d.ok) { toast(d.song && d.song.status === 'approved' ? '上传成功，已直接上架' : '上传成功，等待平台审核'); refreshCenter(); }
            else toast(d.error || '上传失败');
          })
          .catch(function (e) {
            clearTimeout(timer);
            uploadBtn.disabled = false;
            uploadBtn.textContent = '提交上传（待审核）';
            toast((e && e.name === 'AbortError') ? '上传超时，请重试或换小一点的音频' : '上传失败，请重试');
          });
      }
      if (wantAuto) {
        var pwd = creatorAdminPwd;
        if (!pwd) {
          pwd = window.prompt('请输入管理口令（平台方免审）：');
          if (pwd == null) { uploadBtn.disabled = false; uploadBtn.textContent = '提交上传（待审核）'; return; }
          pwd = String(pwd || '');
        }
        var dw = window.desktopWindow || {};
        var approveReq = (typeof dw.creatorAutoApproveToken === 'function')
          ? dw.creatorAutoApproveToken(pwd)
          : fetch(API + '/autoapprove-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password: pwd }),
            }).then(function (r) { return r.json(); });
        var timeout = new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, 15000); });
        Promise.race([approveReq, timeout])
          .then(function (r) {
            if (r && r.ok) { creatorAdminPwd = pwd; doUpload(r.token); }
            else { toast((r && r.error) || '管理口令不正确'); creatorAdminPwd = ''; uploadBtn.disabled = false; uploadBtn.textContent = '提交上传（待审核）'; }
          })
          .catch(function () { toast('免审验证超时，请重试'); creatorAdminPwd = ''; uploadBtn.disabled = false; uploadBtn.textContent = '提交上传（待审核）'; });
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
          var playBtn = el('button', 'mr-btn primary', '试听');
          head.appendChild(playBtn);
          var editBtn = el('button', 'mr-btn ghost', '编辑');
          head.appendChild(editBtn);
          card.appendChild(head);
          card.appendChild(el('div', 'mr-dim', '播放：免费 ' + s.playsFree + ' / 会员 ' + s.playsMember));
          listBox.appendChild(card);
          // 编辑作品（内联展开）
          var editBox = null;
          var editOpen = false;
          editBtn.onclick = function () {
            editOpen = !editOpen;
            editBtn.textContent = editOpen ? '收起' : '编辑';
            if (editOpen) {
              if (!editBox) {
                editBox = el('div', 'mr-card');
                editBox.style.marginTop = '8px';
                const tInput = el('input', 'mr-input'); tInput.value = s.title; tInput.placeholder = '歌曲名（必填）';
                const aInput = el('input', 'mr-input'); aInput.value = s.artist || ''; aInput.placeholder = '歌手名';
                const lInput = el('textarea', 'mr-input'); lInput.value = s.lyricText || ''; lInput.placeholder = '歌词（可选）'; lInput.style.minHeight = '60px';
                const pRow = el('div', 'mr-row');
                const freeR = el('label', 'mr-dim'); freeR.innerHTML = '<input type="radio" name="mr-edit-pricing-' + s.id + '" value="free"' + (!s.memberOnly ? ' checked' : '') + '> 免费';
                const vipR = el('label', 'mr-dim'); vipR.innerHTML = '<input type="radio" name="mr-edit-pricing-' + s.id + '" value="vip"' + (s.memberOnly ? ' checked' : '') + '> 会员专属';
                pRow.appendChild(freeR); pRow.appendChild(vipR);
                var newAudio = null;
                const aInputF = el('input', 'mr-input'); aInputF.type = 'file'; aInputF.accept = 'audio/*';
                aInputF.onchange = function () { if (aInputF.files && aInputF.files[0]) { newAudio = aInputF.files[0]; aHint.textContent = '将替换音频：' + newAudio.name; } };
                const aHint = el('div', 'mr-dim', '重传音频可选（替换后需重新审核）');
                const cInputF = el('input', 'mr-input'); cInputF.type = 'file'; cInputF.accept = 'image/*';
                const saveBtn = el('button', 'mr-btn primary', '保存修改');
                const cancelBtn = el('button', 'mr-btn ghost', '取消');
                saveBtn.onclick = function () {
                  if (!tInput.value.trim()) { toast('请填写歌曲名'); return; }
                  saveBtn.disabled = true; saveBtn.textContent = '保存中…';
                  const fd = new FormData();
                  fd.append('token', getToken());
                  fd.append('songId', s.id);
                  fd.append('title', tInput.value.trim());
                  fd.append('artist', aInput.value.trim());
                  fd.append('memberOnly', document.querySelector('input[name="mr-edit-pricing-' + s.id + '"]:checked').value === 'vip' ? '1' : '0');
                  fd.append('lyricText', lInput.value || '');
                  if (newAudio) fd.append('audio', newAudio);
                  if (cInputF.files && cInputF.files[0]) fd.append('cover', cInputF.files[0]);
                  const ctrl = new AbortController();
                  const timer = setTimeout(function () { ctrl.abort(); }, 120000);
                  fetch(API + '/update-song', { method: 'POST', body: fd, signal: ctrl.signal })
                    .then(function (r) { clearTimeout(timer); return r.json(); })
                    .then(function (d) {
                      saveBtn.disabled = false; saveBtn.textContent = '保存修改';
                      if (d.ok) { toast(newAudio ? '已保存，音频变更需重新审核' : '已保存'); refreshCenter(); }
                      else toast(d.error || '保存失败');
                    })
                    .catch(function (e) {
                      clearTimeout(timer);
                      saveBtn.disabled = false; saveBtn.textContent = '保存修改';
                      toast((e && e.name === 'AbortError') ? '保存超时，请重试' : '保存失败，请重试');
                    });
                };
                cancelBtn.onclick = function () { editBox.style.display = 'none'; editOpen = false; editBtn.textContent = '编辑'; };
                editBox.appendChild(el('div', 'mr-dim', '编辑标题 / 歌手 / 歌词 / 收费设置'));
                editBox.appendChild(tInput); editBox.appendChild(aInput); editBox.appendChild(lInput);
                editBox.appendChild(pRow); editBox.appendChild(aInputF); editBox.appendChild(aHint); editBox.appendChild(cInputF);
                const btnRow = el('div', 'mr-row'); btnRow.appendChild(saveBtn); btnRow.appendChild(cancelBtn);
                editBox.appendChild(btnRow);
                card.appendChild(editBox);
              }
              editBox.style.display = '';
            } else if (editBox) { editBox.style.display = 'none'; }
          };
          playBtn.onclick = function () {
            try {
              var song = {
                name: s.title,
                artist: s.artist,
                localUrl: '/api/creator/audio/' + s.id + '?token=' + encodeURIComponent(getToken()),
                localKey: 'creator-' + s.id,
                memberOnly: s.memberOnly,
                provider: 'creator',
              };
              if (typeof playQueue !== 'undefined' && Array.isArray(playQueue)) {
                playQueue.push(song);
                if (typeof playQueueAt === 'function') playQueueAt(playQueue.length - 1, { manual: true });
              } else toast('播放核心未就绪');
            } catch (_) { toast('播放失败'); }
          };
        });
      })
      .catch(function () { listBox.appendChild(el('div', 'mr-dim', '加载失败')); });

    root.appendChild(el('div', 'mr-sec', '收益说明'));
    root.appendChild(el('div', 'mr-card mr-dim', '平台按月结算：录入当月会员收入总额后，按本月各作品会员播放占比分配 70%（平台留 30%）。结算单在平台管理面板生成。'));
  }

  window.openCreatorCenter = openCenter;
  window.closeCreatorCenter = closePanel;
})();
