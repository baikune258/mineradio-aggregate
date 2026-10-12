'use strict';

// ============================================================
// migu-api.js —— 咪咕音乐音源模块（Mineradio 二改：六大平台聚合）
// 接口（咪咕公开 Web/App 接口）：
//   搜索  : https://c.musicapp.migu.cn/MIGUM3.0/v1.0/content/search_all.do?text=<kw>&pageIndex=&pageSize=&searchSwitch={"song":1}
//   播放  : https://app.c.nf.migu.cn/MIGUM3.0/strategy/pc/listen/v1.0?contentId=&copyrightId=&resourceType=2&toneFlag=PQ
//            （Channel: 014X031；免费曲返回 url，会员曲返回 cannotCode=440013）
//   歌词  : 搜索/播放返回 lyricUrl 直链（LRC 文本）
//   封面  : 搜索返回 imgItems
// ============================================================

const https = require('https');

const MIGU_SEARCH_URL = 'https://c.musicapp.migu.cn/MIGUM3.0/v1.0/content/search_all.do';
const MIGU_PLAY_URL = 'https://app.c.nf.migu.cn/MIGUM3.0/strategy/pc/listen/v1.0';
const MIGU_WEB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://music.migu.cn/',
};
const MIGU_APP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  'Referer': 'https://music.migu.cn/',
};

function miguRequestJson(url, options) {
  options = options || {};
  const timeoutMs = options.timeoutMs || 12000;
  return new Promise((resolve, reject) => {
    const client = url.indexOf('https://') === 0 ? https : require('http');
    const req = client.get(url, { headers: options.headers || MIGU_WEB_HEADERS }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text);
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('MIGU_REQUEST_TIMEOUT')); });
  });
}

function pickMiguCover(imgItems) {
  if (!Array.isArray(imgItems) || !imgItems.length) return '';
  // 取尺寸最大的封面（imgSizeType 越大图越大）
  let best = '';
  let bestSize = -1;
  for (const item of imgItems) {
    const img = item && item.img;
    if (!img) continue;
    const size = Number(item.imgSizeType) || 0;
    if (size > bestSize) { best = img; bestSize = size; }
  }
  return best || (imgItems[0] && imgItems[0].img) || '';
}

function mapMiguSearchItem(item) {
  item = item || {};
  const contentId = String(item.contentId || item.id || '');
  const songId = String(item.songId || '');
  const copyrightId = String(item.copyrightId || '');
  const name = String(item.songName || item.name || '').trim();
  const singers = Array.isArray(item.singers) ? item.singers : [];
  const artists = singers.map(s => ({ name: String(s.name || '').trim() })).filter(a => a.name);
  const album = ((item.albums && item.albums[0] && item.albums[0].name) || '').toString();
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const isVip = tags.indexOf('vip') >= 0 || tags.indexOf('VIP') >= 0;
  let durationMs = 0;
  if (item.duration && /^\d{4}-\d{2}-\d{2}/.test(item.duration)) {
    // 罕见情况：duration 形如时间戳字符串
  } else {
    durationMs = Number(item.duration) || 0;
  }
  return {
    provider: 'migu',
    source: 'migu',
    type: 'migu',
    id: contentId,
    contentId,
    songId,
    copyrightId,
    name,
    artist: artists.map(a => a.name).join(' / '),
    artists,
    album,
    cover: pickMiguCover(item.imgItems),
    lyricUrl: String(item.lyricUrl || ''),
    duration: durationMs,
    durationMs,
    popularity: Number(item.playCount || item.plays || 0) || 0,
    pay: isVip ? 1 : 0,
    payType: isVip ? 'vip' : 'free',
    fee: isVip ? 1 : 0,
  };
}

async function miguSearchRaw(keywords, pageSize, pageIndex) {
  const u = new URL(MIGU_SEARCH_URL);
  u.searchParams.set('text', String(keywords || '').trim());
  u.searchParams.set('pageIndex', String(pageIndex || 1));
  u.searchParams.set('pageSize', String(pageSize || 20));
  u.searchParams.set('searchSwitch', '{"song":1}');
  const text = await miguRequestJson(u.toString(), { headers: MIGU_APP_HEADERS });
  let data = null;
  try { data = JSON.parse(text); } catch (e) { data = null; }
  if (!data || String(data.code) !== '000000') return [];
  const result = data.songResultData && Array.isArray(data.songResultData.result) ? data.songResultData.result : [];
  return result;
}

async function handleMiguSearch(keywords, limit, offset) {
  const kw = String(keywords || '').trim();
  const lim = Math.max(1, Math.min(Math.floor(Number(limit) || 12), 20));
  const start = Math.max(0, Math.floor(Number(offset) || 0));
  if (!kw) return [];
  const skip = start % lim;
  const first = await miguSearchRaw(kw, lim, Math.floor(start / lim) + 1);
  let items;
  if (!skip || first.length < lim) {
    items = first.slice(skip, skip + lim).map(mapMiguSearchItem).filter(s => s.name && s.id);
  } else {
    const next = await miguSearchRaw(kw, lim, Math.floor(start / lim) + 2);
    items = first.concat(next).slice(skip, skip + lim).map(mapMiguSearchItem).filter(s => s.name && s.id);
  }
  return dedupeMiguSongs(items);
}

function normalizeMiguText(value) {
  return String(value || '').normalize('NFKC').toLowerCase()
    .replace(/[（(【\[].*?[）)】\]]/g, '')
    .replace(/[\s·・\-—_.,，。:：'"“”‘’/\\|!?！？]+/g, '');
}

function dedupeMiguSongs(list) {
  const seen = new Set();
  const out = [];
  for (const s of list) {
    const key = String(s.id || s.contentId || '') || (normalizeMiguText(s.name) + '|' + normalizeMiguText(s.artist));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.sort((a, b) => (Number(b.popularity) || 0) - (Number(a.popularity) || 0));
}

async function handleMiguSongUrl(params) {
  params = params || {};
  const contentId = String(params.contentId || params.id || '');
  const copyrightId = String(params.copyrightId || '');
  if (!contentId) {
    return { provider: 'migu', url: '', playable: false, error: 'MISSING_MIGU_CONTENT_ID', message: '缺少咪咕歌曲 contentId' };
  }
  const u = new URL(MIGU_PLAY_URL);
  u.searchParams.set('contentId', contentId);
  if (copyrightId) u.searchParams.set('copyrightId', copyrightId);
  u.searchParams.set('resourceType', '2');
  u.searchParams.set('toneFlag', String(params.toneFlag || 'PQ'));
  const text = await miguRequestJson(u.toString(), { headers: Object.assign({}, MIGU_WEB_HEADERS, { Channel: '014X031' }) });
  let data = null;
  try { data = JSON.parse(text); } catch (e) { data = null; }
  if (!data || String(data.code) !== '000000') {
    return { provider: 'migu', url: '', playable: false, error: 'MIGU_URL_UNAVAILABLE', message: (data && data.info) || '咪咕播放地址获取失败' };
  }
  const dd = data.data || {};
  const url = String(dd.url || '');
  if (!url) {
    const cannotCode = String(dd.cannotCode || '');
    const trial = Number(dd.auditionsLength) || 0;
    if (cannotCode === '440013' || trial > 0) {
      return {
        provider: 'migu', url: '', playable: false, error: 'MIGU_VIP_REQUIRED',
        message: '咪咕会员歌曲，仅可试听 60 秒，需开通会员播放完整版',
        vipRequired: true, trialSeconds: trial,
      };
    }
    return { provider: 'migu', url: '', playable: false, error: 'MIGU_URL_EMPTY', message: '咪咕未返回可播放地址' };
  }
  return {
    provider: 'migu',
    url,
    playable: true,
    quality: String(params.toneFlag || 'PQ'),
    level: String(params.toneFlag || 'PQ'),
    source: 'migu',
  };
}

async function handleMiguLyric(params) {
  params = params || {};
  const lyricUrl = String(params.lyricUrl || '');
  if (!lyricUrl) {
    return { provider: 'migu', lyric: '', tlyric: '', source: 'migu', fallback: true, name: params.name || '', artist: params.artist || '' };
  }
  try {
    const text = await miguRequestJson(lyricUrl, { headers: MIGU_WEB_HEADERS, timeoutMs: 10000 });
    if (text && text.indexOf('[') >= 0) {
      return { provider: 'migu', lyric: text, tlyric: '', source: 'migu', fallback: false };
    }
  } catch (err) {
    // fallthrough -> netease fallback
  }
  return { provider: 'migu', lyric: '', tlyric: '', source: 'migu', fallback: true, name: params.name || '', artist: params.artist || '' };
}

module.exports = {
  handleMiguSearch,
  handleMiguSongUrl,
  handleMiguLyric,
  pickMiguCover,
};
