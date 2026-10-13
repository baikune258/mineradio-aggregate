// 听众账号系统（二改新增）——普通听众注册登录：
// 个人歌单 / 收藏 / 收听记录 / 会员绑定，数据跟随安装目录（data/listeners），不占系统盘。
// 离线实现：账号数据在安装目录，重装同目录不丢；换设备可导出/导入账号备份。
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function defaultListenerDataDir() {
  return path.join(__dirname, 'data', 'listeners');
}

function hashPassword(password, salt) {
  return crypto.createHmac('sha256', 'mineradio-listener-v1:' + salt).update(String(password || '')).digest('hex');
}

class ListenerSystem {
  constructor(options) {
    options = options || {};
    this.dataDir = options.dataDir || defaultListenerDataDir();
    this.accountsFile = path.join(this.dataDir, 'accounts.json');
    this.sessionsFile = path.join(this.dataDir, 'sessions.json');
    this.ordersFile = path.join(this.dataDir, 'orders.json');
    this.adminPassword = options.adminPassword || 'mineradio-admin';
    this._ensure();
  }

  _ensure() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    if (!fs.existsSync(this.accountsFile)) fs.writeFileSync(this.accountsFile, JSON.stringify({ accounts: [] }, null, 2), 'utf8');
    if (!fs.existsSync(this.sessionsFile)) fs.writeFileSync(this.sessionsFile, JSON.stringify({ sessions: {} }, null, 2), 'utf8');
    if (!fs.existsSync(this.ordersFile)) fs.writeFileSync(this.ordersFile, JSON.stringify({ orders: [] }, null, 2), 'utf8');
  }

  _read(file, fallback) {
    try {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (_) {}
    return fallback;
  }

  _write(file, data) {
    const temp = file + '.tmp-' + process.pid;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(temp, file);
  }

  _accounts() { return this._read(this.accountsFile, { accounts: [] }); }
  _saveAccounts(data) { this._write(this.accountsFile, data); }
  _sessions() { return this._read(this.sessionsFile, { sessions: {} }); }
  _saveSessions(data) { this._write(this.sessionsFile, data); }
  _orders() { return this._read(this.ordersFile, { orders: [] }); }
  _saveOrders(data) { this._write(this.ordersFile, data); }

  // ---------- 账号 ----------

  register(name, password) {
    const uname = String(name || '').trim();
    const upass = String(password || '');
    if (uname.length < 2 || uname.length > 24) return { ok: false, error: '昵称需 2-24 个字符' };
    if (upass.length < 6) return { ok: false, error: '口令至少 6 位' };
    const store = this._accounts();
    if (store.accounts.some(a => a.name.toLowerCase() === uname.toLowerCase())) {
      return { ok: false, error: '该昵称已被注册' };
    }
    const salt = crypto.randomBytes(6).toString('hex');
    const account = {
      id: 'u' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex'),
      name: uname,
      salt,
      passwordHash: hashPassword(upass, salt),
      createdAt: Date.now(),
      memberUntil: 0,
      playlists: [],
      favorites: [],
      recentPlays: [],
    };
    store.accounts.push(account);
    this._saveAccounts(store);
    const session = this._createSession(account.id);
    return { ok: true, session, account: this._publicAccount(account) };
  }

  login(name, password) {
    const uname = String(name || '').trim();
    const store = this._accounts();
    const account = store.accounts.find(a => a.name.toLowerCase() === uname.toLowerCase());
    if (!account) return { ok: false, error: '账号不存在' };
    if (account.passwordHash !== hashPassword(String(password || ''), account.salt)) {
      return { ok: false, error: '口令错误' };
    }
    const session = this._createSession(account.id);
    return { ok: true, session, account: this._publicAccount(account) };
  }

  _createSession(accountId) {
    const sessions = this._sessions();
    const token = crypto.randomBytes(24).toString('hex');
    sessions.sessions[token] = { accountId, createdAt: Date.now() };
    // 清理过期会话（7 天）
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    Object.keys(sessions.sessions).forEach(k => {
      if (sessions.sessions[k].createdAt < cutoff) delete sessions.sessions[k];
    });
    this._saveSessions(sessions);
    return { token, accountId };
  }

  resolveSession(token) {
    const sessions = this._sessions();
    const s = sessions.sessions[String(token || '')];
    if (!s) return null;
    const store = this._accounts();
    return store.accounts.find(a => a.id === s.accountId) || null;
  }

  logout(token) {
    const sessions = this._sessions();
    delete sessions.sessions[String(token || '')];
    this._saveSessions(sessions);
    return { ok: true };
  }

  _publicAccount(account) {
    return {
      id: account.id,
      name: account.name,
      createdAt: account.createdAt,
      memberUntil: account.memberUntil || 0,
      playlists: account.playlists || [],
      favorites: account.favorites || [],
      recentPlays: (account.recentPlays || []).slice(0, 50),
    };
  }

  status(token) {
    const account = this.resolveSession(token);
    if (!account) return { ok: false, loggedIn: false };
    return { ok: true, loggedIn: true, account: this._publicAccount(account) };
  }

  // ---------- 会员绑定 ----------

  // 激活码激活后把会员有效期写入账号（取更长）
  bindMember(token, expireAt) {
    const account = this.resolveSession(token);
    if (!account) return { ok: false, error: '请先登录' };
    const store = this._accounts();
    const rec = store.accounts.find(a => a.id === account.id);
    if (!rec) return { ok: false, error: '账号不存在' };
    const t = Number(expireAt) || 0;
    rec.memberUntil = Math.max(rec.memberUntil || 0, t);
    this._saveAccounts(store);
    return { ok: true, account: this._publicAccount(rec) };
  }

  // ---------- 会员订单（付费购买，管理员核销开通） ----------

  static ORDER_PLANS() {
    return {
      month: { label: '1 个月', days: 30, amount: 8 },
      quarter: { label: '3 个月', days: 90, amount: 22 },
      year: { label: '12 个月', days: 365, amount: 68 },
    };
  }

  createOrder(token, planKey) {
    const account = this.resolveSession(token);
    if (!account) return { ok: false, error: '请先登录' };
    const plan = ListenerSystem.ORDER_PLANS()[String(planKey || '')];
    if (!plan) return { ok: false, error: '套餐不存在' };
    const store = this._orders();
    const id = 'MR-O' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();
    const order = {
      id, accountId: account.id, accountName: account.name,
      plan: String(planKey), days: plan.days, amount: plan.amount,
      status: 'pending', createdAt: Date.now(),
    };
    store.orders.push(order);
    this._saveOrders(store);
    return { ok: true, order };
  }

  listMyOrders(token) {
    const account = this.resolveSession(token);
    if (!account) return { ok: false, error: '请先登录' };
    const mine = this._orders().orders
      .filter(o => o.accountId === account.id)
      .sort((a, b) => b.createdAt - a.createdAt);
    return { ok: true, orders: mine };
  }

  approveOrder(password, orderId) {
    if (String(password || '') !== String(this.adminPassword || 'mineradio-admin')) {
      return { ok: false, error: '管理口令不正确' };
    }
    const store = this._orders();
    const order = store.orders.find(o => o.id === orderId && o.status === 'pending');
    if (!order) return { ok: false, error: '订单不存在或已处理' };
    const accStore = this._accounts();
    const rec = accStore.accounts.find(a => a.id === order.accountId);
    if (!rec) return { ok: false, error: '账号不存在' };
    rec.memberUntil = Math.max(rec.memberUntil || 0, Date.now()) + (order.days || 30) * 86400000;
    this._saveAccounts(accStore);
    order.status = 'done';
    order.approvedAt = Date.now();
    this._saveOrders(store);
    return { ok: true, account: this._publicAccount(rec), order };
  }

  listPendingOrders(password) {
    if (String(password || '') !== String(this.adminPassword || 'mineradio-admin')) {
      return { ok: false, error: '管理口令不正确' };
    }
    const pending = this._orders().orders
      .filter(o => o.status === 'pending')
      .sort((a, b) => b.createdAt - a.createdAt);
    return { ok: true, orders: pending };
  }

  // ---------- 歌单 ----------

  addPlaylist(token, name) {
    const account = this.resolveSession(token);
    if (!account) return { ok: false, error: '请先登录' };
    const n = String(name || '').trim();
    if (!n || n.length > 40) return { ok: false, error: '歌单名需 1-40 字符' };
    const store = this._accounts();
    const rec = store.accounts.find(a => a.id === account.id);
    if (!rec) return { ok: false, error: '账号不存在' };
    if ((rec.playlists || []).some(p => p.name === n)) return { ok: false, error: '已有同名歌单' };
    const pl = { id: 'pl' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'), name: n, tracks: [], createdAt: Date.now() };
    rec.playlists = rec.playlists || [];
    rec.playlists.push(pl);
    this._saveAccounts(store);
    return { ok: true, account: this._publicAccount(rec) };
  }

  renamePlaylist(token, playlistId, name) {
    const account = this.resolveSession(token);
    if (!account) return { ok: false, error: '请先登录' };
    const n = String(name || '').trim();
    if (!n || n.length > 40) return { ok: false, error: '歌单名需 1-40 字符' };
    const store = this._accounts();
    const rec = store.accounts.find(a => a.id === account.id);
    const pl = (rec.playlists || []).find(p => p.id === playlistId);
    if (!pl) return { ok: false, error: '歌单不存在' };
    pl.name = n;
    this._saveAccounts(store);
    return { ok: true, account: this._publicAccount(rec) };
  }

  deletePlaylist(token, playlistId) {
    const account = this.resolveSession(token);
    if (!account) return { ok: false, error: '请先登录' };
    const store = this._accounts();
    const rec = store.accounts.find(a => a.id === account.id);
    rec.playlists = (rec.playlists || []).filter(p => p.id !== playlistId);
    this._saveAccounts(store);
    return { ok: true, account: this._publicAccount(rec) };
  }

  addTrackToPlaylist(token, playlistId, track) {
    const account = this.resolveSession(token);
    if (!account) return { ok: false, error: '请先登录' };
    const store = this._accounts();
    const rec = store.accounts.find(a => a.id === account.id);
    const pl = (rec.playlists || []).find(p => p.id === playlistId);
    if (!pl) return { ok: false, error: '歌单不存在' };
    const t = this._normalizeTrack(track);
    const dup = (pl.tracks || []).find(x => x.key === t.key);
    if (dup) return { ok: false, error: '这首歌已在歌单中' };
    pl.tracks = pl.tracks || [];
    pl.tracks.push(t);
    this._saveAccounts(store);
    return { ok: true, account: this._publicAccount(rec) };
  }

  removeTrackFromPlaylist(token, playlistId, trackKey) {
    const account = this.resolveSession(token);
    if (!account) return { ok: false, error: '请先登录' };
    const store = this._accounts();
    const rec = store.accounts.find(a => a.id === account.id);
    const pl = (rec.playlists || []).find(p => p.id === playlistId);
    if (!pl) return { ok: false, error: '歌单不存在' };
    pl.tracks = (pl.tracks || []).filter(x => x.key !== trackKey);
    this._saveAccounts(store);
    return { ok: true, account: this._publicAccount(rec) };
  }

  // ---------- 收藏 ----------

  toggleFavorite(token, track) {
    const account = this.resolveSession(token);
    if (!account) return { ok: false, error: '请先登录' };
    const store = this._accounts();
    const rec = store.accounts.find(a => a.id === account.id);
    const t = this._normalizeTrack(track);
    rec.favorites = rec.favorites || [];
    const idx = rec.favorites.findIndex(x => x.key === t.key);
    let added = false;
    if (idx >= 0) { rec.favorites.splice(idx, 1); }
    else { rec.favorites.unshift(t); added = true; }
    this._saveAccounts(store);
    return { ok: true, added, account: this._publicAccount(rec) };
  }

  isFavorite(token, trackKey) {
    const account = this.resolveSession(token);
    if (!account) return false;
    return (account.favorites || []).some(x => x.key === trackKey);
  }

  // ---------- 收听记录 ----------

  recordPlay(token, track) {
    const account = this.resolveSession(token);
    if (!account) return { ok: false };
    const store = this._accounts();
    const rec = store.accounts.find(a => a.id === account.id);
    const t = this._normalizeTrack(track);
    t.playedAt = Date.now();
    rec.recentPlays = rec.recentPlays || [];
    const idx = rec.recentPlays.findIndex(x => x.key === t.key);
    if (idx >= 0) rec.recentPlays.splice(idx, 1);
    rec.recentPlays.unshift(t);
    rec.recentPlays = rec.recentPlays.slice(0, 50);
    this._saveAccounts(store);
    return { ok: true };
  }

  _normalizeTrack(track) {
    track = track || {};
    const name = String(track.name || track.title || '').slice(0, 100);
    const artist = String(track.artist || '').slice(0, 60);
    const source = String(track.source || track.provider || '').slice(0, 20);
    const id = String(track.id || track.songid || track.mid || track.localKey || track.hash || '').slice(0, 80);
    const key = (source ? source + ':' : '') + (id || name);
    const url = String(track.localUrl || track.url || '').slice(0, 400);
    const cover = String(track.cover || track.coverUrl || '').slice(0, 400);
    const memberOnly = !!track.memberOnly;
    return { key, name, artist, source, id, url, cover, memberOnly };
  }

  // ---------- 备份导出 / 导入（换设备、重装恢复） ----------

  exportAccount(token) {
    const account = this.resolveSession(token);
    if (!account) return { ok: false, error: '请先登录' };
    const store = this._accounts();
    const rec = store.accounts.find(a => a.id === account.id);
    const payload = JSON.stringify({
      v: 1,
      kind: 'mineradio-listener-account',
      name: rec.name,
      salt: rec.salt,
      passwordHash: rec.passwordHash,
      createdAt: rec.createdAt,
      memberUntil: rec.memberUntil || 0,
      playlists: rec.playlists || [],
      favorites: rec.favorites || [],
      recentPlays: (rec.recentPlays || []).slice(0, 50),
    });
    const encoded = Buffer.from(payload, 'utf8').toString('base64');
    return { ok: true, backup: encoded };
  }

  importAccount(backup) {
    try {
      const raw = Buffer.from(String(backup || '').trim(), 'base64').toString('utf8');
      const data = JSON.parse(raw);
      if (!data || data.kind !== 'mineradio-listener-account' || !data.name || !data.salt || !data.passwordHash) {
        return { ok: false, error: '备份数据无效' };
      }
      const store = this._accounts();
      if (store.accounts.some(a => a.name.toLowerCase() === data.name.toLowerCase())) {
        return { ok: false, error: '已存在同名账号，请先删除或换昵称' };
      }
      const account = {
        id: 'u' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex'),
        name: data.name,
        salt: data.salt,
        passwordHash: data.passwordHash,
        createdAt: data.createdAt || Date.now(),
        memberUntil: data.memberUntil || 0,
        playlists: data.playlists || [],
        favorites: data.favorites || [],
        recentPlays: (data.recentPlays || []).slice(0, 50),
      };
      store.accounts.push(account);
      this._saveAccounts(store);
      const session = this._createSession(account.id);
      return { ok: true, session, account: this._publicAccount(account) };
    } catch (_) {
      return { ok: false, error: '备份数据解析失败' };
    }
  }
}

module.exports = { ListenerSystem, defaultListenerDataDir };
