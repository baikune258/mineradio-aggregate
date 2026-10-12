'use strict';

// ============================================================
// kuwo-api.js —— 酷我音乐音源模块（Mineradio 二改：六大平台聚合）
// 接口（均为酷我公开 Web 接口）：
//   搜索  : http://search.kuwo.cn/r.s?all=<kw>&ft=music&itemset=web_2013&client=kt&pn=&rn=&rformat=json&encoding=utf8
//   播放  : http://antiserver.kuwo.cn/anti.s?type=convert_url&format=mp3&rid=MUSIC_<id>&response=url&br=320kmp3
//   歌词  : http://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=<id>&httpsStatus=1
//   封面  : 搜索返回 web_albumpic_short（部分歌曲为空，由调用方兜底）
// ============================================================

const http = require('http');
const https = require('https');

const KUWO_SEARCH_URL = 'http://search.kuwo.cn/r.s';
const KUWO_PLAY_URL = 'http://antiserver.kuwo.cn/anti.s';
const KUWO_LYRIC_URL = 'http://m.kuwo.cn/newh5/singles/songinfoandlrc';
const KUWO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};
const KUWO_MOBILE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Referer': 'http://m.kuwo.cn/',
};

function kuwoRequestJson(url, options) {
  options = options || {};
  const timeoutMs = options.timeoutMs || 12000;
  return new Promise((resolve, reject) => {
    const client = url.indexOf('https://') === 0 ? https : http;
    const req = client.get(url, { headers: options.headers || KUWO_HEADERS }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text);
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('KUWO_REQUEST_TIMEOUT')); });
  });
}

// 酷我搜索接口返回 Python dict 风格（单引号 JSON），用 JS 字面量解析。
// 使用 Function 仅求值纯数据字面量（无函数调用），安全且兼容值内单引号。
function parseKuwoPayload(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  const body = text.slice(start, end + 1);
  try {
    // eslint-disable-next-line no-new-func
    return Function('"use strict";return (' + body + ')')();
  } catch (err) {
    try {
      return JSON.parse(body.replace(/'/g, '"'));
    } catch (err2) {
      return null;
    }
  }
}

function normalizeKuwoRid(id) {
  const s = String(id || '').trim();
  if (!s) return '';
  return s.indexOf('MUSIC_') === 0 ? s : 'MUSIC_' + s.replace(/^MUSIC_/i, '');
}

function normalizeKuwoMid(id) {
  const s = String(id || '').trim();
  if (!s) return '';
  return s.replace(/^MUSIC_/i, '').replace(/\D/g, '');
}

async function kuwoSearchRaw(keywords, rn, pn) {
  const u = new URL(KUWO_SEARCH_URL);
  u.searchParams.set('all', String(keywords || '').trim());
  u.searchParams.set('ft', 'music');
  u.searchParams.set('itemset', 'web_2013');
  u.searchParams.set('client', 'kt');
  u.searchParams.set('pn', String(pn || 0));
  u.searchParams.set('rn', String(rn || 20));
  u.searchParams.set('rformat', 'json');
  u.searchParams.set('encoding', 'utf8');
  const text = await kuwoRequestJson(u.toString(), { headers: KUWO_HEADERS });
  const data = parseKuwoPayload(text);
  if (!data || !Array.isArray(data.abslist)) return [];
  return data.abslist;
}

function mapKuwoSearchItem(item) {
  item = item || {};
  const rid = String(item.MUSICRID || '');
  const mid = normalizeKuwoMid(item.DC_TARGETID || rid);
  const name = String(item.NAME || item.SONGNAME || '').trim();
  const artist = String(item.ARTIST || '').trim();
  const album = String(item.ALBUM || '').trim();
  const cover = String(item.web_albumpic_short || item.PICPATH || '').trim();
  const durationMs = (Number(item.DURATION) || 0) * 1000;
  const pay = Number(item.payInfo && item.payInfo.feeType && item.payInfo.feeType.song) || Number(item.tpay) || 0;
  return {
    provider: 'kuwo',
    source: 'kuwo',
    type: 'kuwo',
    id: mid || rid,
    rid: rid,
    mid,
    name,
    artist,
    artists: artist ? artist.split('&').filter(Boolean).map(a => ({ name: a.trim() })) : [],
    album,
    cover: cover || '',
    duration: durationMs,
    durationMs,
    popularity: Number(item.PLAYCNT || item.playcnt || 0) || 0,
    pay,
    payType: pay > 0 ? 'vip' : 'free',
    fee: pay > 0 ? 1 : 0,
  };
}

async function handleKuwoSearch(keywords, limit, offset) {
  const kw = String(keywords || '').trim();
  const lim = Math.max(1, Math.min(Math.floor(Number(limit) || 12), 20));
  const start = Math.max(0, Math.floor(Number(offset) || 0));
  if (!kw) return [];
  const skip = start % lim;
  const first = await kuwoSearchRaw(kw, lim, Math.floor(start / lim));
  if (!skip || first.length < lim) {
    return first.slice(skip).map(mapKuwoSearchItem).filter(s => s.name && s.id);
  }
  const next = await kuwoSearchRaw(kw, lim, Math.floor(start / lim) + 1);
  return first.concat(next).slice(skip, skip + lim).map(mapKuwoSearchItem).filter(s => s.name && s.id);
}

async function handleKuwoSongUrl(params) {
  params = params || {};
  const rid = normalizeKuwoRid(params.rid || params.id || params.mid || '');
  if (!rid) {
    return { provider: 'kuwo', url: '', playable: false, error: 'MISSING_KUWO_RID', message: '缺少酷我歌曲 rid' };
  }
  const u = new URL(KUWO_PLAY_URL);
  u.searchParams.set('type', 'convert_url');
  u.searchParams.set('format', 'mp3');
  u.searchParams.set('rid', rid);
  u.searchParams.set('response', 'url');
  u.searchParams.set('br', String(params.br || params.quality || '320kmp3'));
  const text = await kuwoRequestJson(u.toString(), { headers: KUWO_HEADERS });
  const url = String(text || '').trim();
  if (!url || url === 'failed' || !/^https?:\/\//.test(url)) {
    return { provider: 'kuwo', url: '', playable: false, error: 'KUWO_URL_UNAVAILABLE', message: '酷我暂未返回可播放地址' };
  }
  return {
    provider: 'kuwo',
    url,
    playable: true,
    quality: String(params.br || '320kmp3'),
    level: 'standard',
    source: 'kuwo',
  };
}

function kuwoLrcFromList(lrclist) {
  if (!Array.isArray(lrclist) || !lrclist.length) return '';
  let lrc = '';
  for (const line of lrclist) {
    const time = parseFloat(line.time);
    const text = String(line.lineLyric || '');
    if (isNaN(time)) continue;
    const mm = Math.floor(time / 60).toString().padStart(2, '0');
    const ss = Math.floor(time % 60).toString().padStart(2, '0');
    const cs = Math.floor((time % 1) * 100).toString().padStart(2, '0');
    lrc += '[' + mm + ':' + ss + '.' + cs + ']' + text + '\n';
  }
  return lrc;
}

async function handleKuwoLyric(params) {
  params = params || {};
  const musicId = normalizeKuwoMid(params.musicId || params.id || params.rid || '');
  if (!musicId) {
    return { provider: 'kuwo', lyric: '', tlyric: '', source: 'kuwo', fallback: true, name: params.name || '', artist: params.artist || '' };
  }
  try {
    const u = new URL(KUWO_LYRIC_URL);
    u.searchParams.set('musicId', musicId);
    u.searchParams.set('httpsStatus', '1');
    const text = await kuwoRequestJson(u.toString(), { headers: KUWO_MOBILE_HEADERS, timeoutMs: 10000 });
    let data = null;
    try { data = JSON.parse(text); } catch (e) { data = null; }
    const lrclist = data && data.data && Array.isArray(data.data.lrclist) ? data.data.lrclist : null;
    if (lrclist && lrclist.length) {
      const lyric = kuwoLrcFromList(lrclist);
      return { provider: 'kuwo', lyric, tlyric: '', source: 'kuwo', fallback: false };
    }
  } catch (err) {
    // fallthrough -> netease fallback
  }
  return { provider: 'kuwo', lyric: '', tlyric: '', source: 'kuwo', fallback: true, name: params.name || '', artist: params.artist || '' };
}

module.exports = {
  handleKuwoSearch,
  handleKuwoSongUrl,
  handleKuwoLyric,
  normalizeKuwoRid,
  normalizeKuwoMid,
};
