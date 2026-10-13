// Creator Platform —— 开放创作者入驻模块（二改新增）
// 所有数据只落在安装目录 data/creators 下（跟随安装目录，不占系统盘）。
// 创作者注册/上传/审核/播放统计/月分成（平台抽 30%）全部本地实现。
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PLATFORM_CUT_RATE = 0.3; // 平台抽成比例 30%，创作者得 70%

function defaultCreatorDataDir() {
  return path.join(__dirname, 'data', 'creators');
}

function hmacPassword(password, salt) {
  return crypto.createHmac('sha256', 'mineradio-creator-v1:' + salt).update(String(password || '')).digest('hex');
}

function makeToken(secret, creatorId) {
  const payload = Buffer.from(creatorId + ':' + Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30)).toString('base64');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16);
  return payload + '.' + sig;
}

function verifyToken(secret, token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expect = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16);
  if (sig !== expect) return null;
  try {
    const raw = Buffer.from(payload, 'base64').toString('utf8');
    const parts = raw.split(':');
    if (parts.length < 2) return null;
    const creatorId = parts.slice(0, -1).join(':');
    const exp = Number(parts[parts.length - 1]);
    if (!creatorId || !exp || Date.now() / 1000 > exp) return null;
    return creatorId;
  } catch (_) {
    return null;
  }
}

class CreatorPlatform {
  constructor(options) {
    options = options || {};
    this.dataDir = options.dataDir || defaultCreatorDataDir();
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.songsFile = path.join(this.dataDir, 'songs.json');
    this.revenueFile = path.join(this.dataDir, 'revenue.json');
    this.filesDir = path.join(this.dataDir, 'files');
    this.coversDir = path.join(this.dataDir, 'covers');
    this._secret = options.secret || 'mineradio-creator-token-secret';
    this._ensure();
  }

  // 平台方免审令牌：主进程验证管理口令后签发，上传接口校验通过则自动上架
  makeAutoApproveToken(ttlSec) {
    const ttl = Number(ttlSec) > 0 ? Number(ttlSec) : 300;
    const payload = Buffer.from('autoapprove:' + Math.floor(Date.now() / 1000 + ttl)).toString('base64');
    const sig = crypto.createHmac('sha256', this._secret + ':autoapprove').update(payload).digest('hex').slice(0, 16);
    return payload + '.' + sig;
  }

  verifyAutoApproveToken(token) {
    if (!token || typeof token !== 'string') return false;
    const dot = token.indexOf('.');
    if (dot <= 0) return false;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expect = crypto.createHmac('sha256', this._secret + ':autoapprove').update(payload).digest('hex').slice(0, 16);
    if (sig !== expect) return false;
    try {
      const raw = Buffer.from(payload, 'base64').toString('utf8');
      if (!raw.startsWith('autoapprove:')) return false;
      const exp = Number(raw.slice('autoapprove:'.length));
      return !!exp && Date.now() / 1000 < exp;
    } catch (_) {
      return false;
    }
  }

  _ensure() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(this.filesDir, { recursive: true });
    fs.mkdirSync(this.coversDir, { recursive: true });
    if (!fs.existsSync(this.usersFile)) fs.writeFileSync(this.usersFile, JSON.stringify({ users: [] }, null, 2), 'utf8');
    if (!fs.existsSync(this.songsFile)) fs.writeFileSync(this.songsFile, JSON.stringify({ songs: [] }, null, 2), 'utf8');
    if (!fs.existsSync(this.revenueFile)) fs.writeFileSync(this.revenueFile, JSON.stringify({ months: [] }, null, 2), 'utf8');
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

  _users() { return this._read(this.usersFile, { users: [] }); }
  _songs() { return this._read(this.songsFile, { songs: [] }); }
  _revenue() { return this._read(this.revenueFile, { months: [] }); }

  _saveUsers(data) { this._write(this.usersFile, data); }
  _saveSongs(data) { this._write(this.songsFile, data); }
  _saveRevenue(data) { this._write(this.revenueFile, data); }

  register(name, password) {
    const uname = String(name || '').trim();
    const upass = String(password || '');
    if (uname.length < 2 || uname.length > 24) return { ok: false, error: '创作者昵称需 2-24 个字符' };
    if (upass.length < 6) return { ok: false, error: '口令至少 6 位' };
    const store = this._users();
    if (store.users.some(u => u.name.toLowerCase() === uname.toLowerCase())) {
      return { ok: false, error: '该昵称已被注册' };
    }
    const salt = crypto.randomBytes(6).toString('hex');
    const creator = {
      id: 'c' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex'),
      name: uname,
      salt,
      passwordHash: hmacPassword(upass, salt),
      createdAt: Date.now(),
    };
    store.users.push(creator);
    this._saveUsers(store);
    return { ok: true, creator: this._publicCreator(creator), token: makeToken(this._secret, creator.id) };
  }

  login(name, password) {
    const uname = String(name || '').trim();
    const store = this._users();
    const user = store.users.find(u => u.name.toLowerCase() === uname.toLowerCase());
    if (!user) return { ok: false, error: '创作者不存在' };
    if (user.passwordHash !== hmacPassword(String(password || ''), user.salt)) {
      return { ok: false, error: '口令错误' };
    }
    return { ok: true, creator: this._publicCreator(user), token: makeToken(this._secret, user.id) };
  }

  resolveToken(token) {
    const creatorId = verifyToken(this._secret, token);
    if (!creatorId) return null;
    const store = this._users();
    const user = store.users.find(u => u.id === creatorId);
    return user || null;
  }

  _publicCreator(user) {
    const songs = this._songs().songs.filter(s => s.creatorId === user.id);
    const freePlays = songs.reduce((a, s) => a + (s.playsFree || 0), 0);
    const memberPlays = songs.reduce((a, s) => a + (s.playsMember || 0), 0);
    return {
      id: user.id,
      name: user.name,
      createdAt: user.createdAt,
      songCount: songs.length,
      approvedCount: songs.filter(s => s.status === 'approved').length,
      freePlays,
      memberPlays,
    };
  }

  createSong(spec) {
    const song = {
      id: 's' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex'),
      creatorId: spec.creatorId,
      title: String(spec.title || '').trim().slice(0, 80),
      artist: String(spec.artist || '').trim().slice(0, 60) || '佚名',
      memberOnly: !!spec.memberOnly,
      lyricText: String(spec.lyricText || '').slice(0, 20000),
      coverFile: spec.coverFile || '',
      audioFile: spec.audioFile || '',
      audioSize: spec.audioSize || 0,
      audioExt: String(spec.audioExt || '').replace(/[^a-z0-9.]/gi, ''),
      status: spec.status === 'approved' ? 'approved' : 'pending',
      createdAt: Date.now(),
      playsFree: 0,
      playsMember: 0,
    };
    if (!song.title) return { ok: false, error: '歌曲名不能为空' };
    const store = this._songs();
    store.songs.push(song);
    this._saveSongs(store);
    return { ok: true, song: this._publicSong(song) };
  }

  _publicSong(song) {
    return {
      id: song.id,
      creatorId: song.creatorId,
      creatorName: this._creatorName(song.creatorId),
      title: song.title,
      artist: song.artist,
      memberOnly: song.memberOnly,
      coverFile: song.coverFile,
      audioFile: song.audioFile,
      audioExt: song.audioExt,
      status: song.status,
      createdAt: song.createdAt,
      playsFree: song.playsFree || 0,
      playsMember: song.playsMember || 0,
    };
  }

  _creatorName(creatorId) {
    const store = this._users();
    const u = store.users.find(x => x.id === creatorId);
    return u ? u.name : '未知创作者';
  }

  getSong(id) {
    const store = this._songs();
    const song = store.songs.find(s => s.id === id);
    return song || null;
  }

  updateSong(id, creatorId, fields) {
    fields = fields || {};
    const store = this._songs();
    const song = store.songs.find(s => s.id === id && s.creatorId === creatorId);
    if (!song) return { ok: false, error: '作品不存在或无权编辑' };
    if (fields.title !== undefined) {
      const t = String(fields.title || '').trim().slice(0, 80);
      if (!t) return { ok: false, error: '歌曲名不能为空' };
      song.title = t;
    }
    if (fields.artist !== undefined) song.artist = String(fields.artist || '').trim().slice(0, 60) || '佚名';
    if (fields.memberOnly !== undefined) song.memberOnly = !!fields.memberOnly;
    if (fields.lyricText !== undefined) song.lyricText = String(fields.lyricText || '').slice(0, 20000);
    if (fields.audioFile) {
      // 重传了音频：内容有变，回到待审核重新走流程
      song.audioFile = fields.audioFile;
      song.audioSize = Number(fields.audioSize) || song.audioSize || 0;
      song.audioExt = String(fields.audioExt || song.audioExt || '').replace(/[^a-z0-9.]/gi, '');
      song.status = 'pending';
    }
    if (fields.coverFile) song.coverFile = fields.coverFile;
    this._saveSongs(store);
    return { ok: true, song: this._publicSong(song) };
  }

  audioPath(song) {
    if (!song || !song.audioFile) return '';
    const p = path.join(this.filesDir, song.audioFile);
    return fs.existsSync(p) ? p : '';
  }

  coverPath(song) {
    if (!song || !song.coverFile) return '';
    const p = path.join(this.coversDir, song.coverFile);
    return fs.existsSync(p) ? p : '';
  }

  publicSongs() {
    const store = this._songs();
    return store.songs
      .filter(s => s.status === 'approved')
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(s => this._publicSong(s));
  }

  mySongs(creatorId) {
    const store = this._songs();
    return store.songs
      .filter(s => s.creatorId === creatorId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(s => this._publicSong(s));
  }

  recordPlay(songId, isMember) {
    const store = this._songs();
    const song = store.songs.find(s => s.id === songId);
    if (!song) return false;
    if (isMember) song.playsMember = (song.playsMember || 0) + 1;
    else song.playsFree = (song.playsFree || 0) + 1;
    this._saveSongs(store);
    return true;
  }

  // ---------- 平台管理（审核/分成，口令校验在调用方） ----------

  allSongs() {
    const store = this._songs();
    return store.songs
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(s => this._publicSong(s));
  }

  audit(songId, approve) {
    const store = this._songs();
    const song = store.songs.find(s => s.id === songId);
    if (!song) return { ok: false, error: '作品不存在' };
    song.status = approve ? 'approved' : 'rejected';
    this._saveSongs(store);
    return { ok: true, song: this._publicSong(song) };
  }

  creatorsOverview() {
    const store = this._users();
    return store.users.map(u => this._publicCreator(u)).sort((a, b) => b.createdAt - a.createdAt);
  }

  revenueMonths() {
    const rev = this._revenue();
    return rev.months.slice().sort((a, b) => String(b.month).localeCompare(String(a.month)));
  }

  // 录入某月卖码收入总额，按当月会员播放占比把 70% 分给创作者（平台留 30%）
  recordRevenue(month, totalRevenue) {
    const m = String(month || '').trim();
    const total = Number(totalRevenue);
    if (!/^\d{4}-\d{2}$/.test(m)) return { ok: false, error: '月份格式应为 YYYY-MM' };
    if (!isFinite(total) || total < 0) return { ok: false, error: '收入金额无效' };
    const rev = this._revenue();
    let rec = rev.months.find(x => x.month === m);
    if (!rec) {
      rec = { month: m, totalRevenue: 0, platformCut: 0, creatorShare: 0, creators: [] };
      rev.months.push(rec);
    }
    rec.totalRevenue = total;
    rec.platformCut = Math.round(total * PLATFORM_CUT_RATE * 100) / 100;
    rec.creatorShare = Math.round(total * (1 - PLATFORM_CUT_RATE) * 100) / 100;
    const songs = this._songs().songs.filter(s => s.status === 'approved');
    const monthFrom = Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1);
    const monthTo = Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 1);
    const playsByCreator = {};
    songs.forEach(s => {
      if (s.createdAt < monthFrom || s.createdAt >= monthTo) return;
      if (!s.playsMember) return;
      playsByCreator[s.creatorId] = (playsByCreator[s.creatorId] || 0) + s.playsMember;
    });
    const totalMemberPlays = Object.values(playsByCreator).reduce((a, b) => a + b, 0);
    const creators = this._users().users
      .filter(u => playsByCreator[u.id])
      .map(u => {
        const plays = playsByCreator[u.id];
        const share = totalMemberPlays > 0
          ? Math.round(rec.creatorShare * (plays / totalMemberPlays) * 100) / 100
          : 0;
        return { creatorId: u.id, creatorName: u.name, memberPlays: plays, amount: share };
      })
      .sort((a, b) => b.amount - a.amount);
    rec.creators = creators;
    this._saveRevenue(rev);
    return { ok: true, record: rec };
  }

  // 结算单文本（平台线下打款用）
  revenueExport(month) {
    const rev = this._revenue();
    const rec = rev.months.find(x => x.month === String(month || '').trim());
    if (!rec) return { ok: false, error: '该月暂无结算记录' };
    const lines = [];
    lines.push('Mineradio 创作者分成结算单');
    lines.push('结算月份：' + rec.month);
    lines.push('本月会员收入总额：' + rec.totalRevenue + ' 元');
    lines.push('平台抽成（30%）：' + rec.platformCut + ' 元');
    lines.push('创作者分成（70%）：' + rec.creatorShare + ' 元');
    lines.push('');
    lines.push('创作者明细（按本月会员播放占比分配）：');
    rec.creators.forEach(c => {
      lines.push(c.creatorName + '（' + c.creatorId + '） 会员播放 ' + c.memberPlays + ' 次，应得 ' + c.amount + ' 元');
    });
    if (!rec.creators.length) lines.push('（本月无会员播放）');
    lines.push('');
    lines.push('生成时间：' + new Date().toLocaleString('zh-CN'));
    return { ok: true, text: lines.join('\n') };
  }
}

module.exports = { CreatorPlatform, defaultCreatorDataDir, PLATFORM_CUT_RATE, makeToken, verifyToken };
