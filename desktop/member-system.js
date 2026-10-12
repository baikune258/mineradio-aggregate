'use strict';

// =============================================================
// Mineradio 会员体系（离线激活码，预留在线验证升级）
// -------------------------------------------------------------
// 激活码格式：MR-XXXXX-XXXXX-XXXXX-XXXXX
//   payload(10B) = ver(1) + days(2BE) + rand(5) + ts(4BE, 秒)
//   sig(2B)      = HMAC-SHA256(secret, payload) 前 2 字节
//   base32 无 padding 编码，20 字符分 4 组 × 5
// 升级预留：verifyActivationCode 是唯一校验入口，
//   将来切在线验证只需替换该函数实现（请求服务器）。
// =============================================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MEMBER_VERSION = 1;
const ACTIVATION_SECRET = 'mineradio-aggregate-member:v1:9f2c1e7a4d8b';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const CODE_PREFIX = 'MR-';
const DEFAULT_ADMIN_PASSWORD = 'mineradio-admin';
const DAY_MS = 24 * 60 * 60 * 1000;

function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text) {
  const map = {};
  for (let i = 0; i < BASE32_ALPHABET.length; i++) map[BASE32_ALPHABET[i]] = i;
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of String(text || '').toUpperCase()) {
    if (ch === '=') continue;
    const v = map[ch];
    if (v === undefined) return null;
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function normalizeCode(input) {
  let raw = String(input || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.slice(0, 2) === 'MR' && raw.length > 20) raw = raw.slice(2);
  return raw;
}

function formatCode(raw) {
  const body = normalizeCode(raw);
  return CODE_PREFIX + body.slice(0, 5) + '-' + body.slice(5, 10) + '-' + body.slice(10, 15) + '-' + body.slice(15, 20);
}

function createActivationCode(days) {
  const validDays = Math.max(1, Math.min(3650, Math.floor(Number(days) || 30)));
  const payload = Buffer.alloc(10);
  payload[0] = MEMBER_VERSION;
  payload.writeUInt16BE(validDays, 1);
  crypto.randomBytes(5).copy(payload, 3);
  payload.writeUInt32BE(Math.floor(Date.now() / 1000), 6);
  const sig = crypto.createHmac('sha256', ACTIVATION_SECRET).update(payload).digest().slice(0, 2);
  return { code: formatCode(base32Encode(payload) + base32Encode(sig)), days: validDays };
}

function verifyActivationCode(input) {
  const normalized = normalizeCode(input);
  if (!normalized || normalized.length !== 20) {
    return { valid: false, error: '激活码格式不正确' };
  }
  const decoded = base32Decode(normalized);
  if (!decoded || decoded.length !== 12) {
    return { valid: false, error: '激活码无法解析' };
  }
  const payload = decoded.slice(0, 10);
  const sig = decoded.slice(10, 12);
  const expectedSig = crypto.createHmac('sha256', ACTIVATION_SECRET).update(payload).digest().slice(0, 2);
  if (!crypto.timingSafeEqual(sig, expectedSig)) {
    return { valid: false, error: '激活码无效' };
  }
  if (payload[0] !== MEMBER_VERSION) {
    return { valid: false, error: '激活码版本不支持' };
  }
  const days = payload.readUInt16BE(1);
  const issuedAt = payload.readUInt32BE(6) * 1000;
  const expireAt = issuedAt + days * DAY_MS;
  if (expireAt <= Date.now()) {
    return { valid: false, error: '激活码已过期', expireAt };
  }
  return { valid: true, days, issuedAt, expireAt };
}

class MemberSystem {
  constructor(options) {
    options = options || {};
    this.userDataPath = options.userDataPath || '.';
    this.stateFile = path.join(this.userDataPath, 'member-state.json');
    this.adminFile = path.join(this.userDataPath, 'member-admin.json');
    this.codesFile = path.join(this.userDataPath, 'member-codes.json');
    this.state = this._readJson(this.stateFile, { version: 1, activated: false, code: '', activatedAt: 0, expireAt: 0 });
    this.admin = this._readJson(this.adminFile, { password: DEFAULT_ADMIN_PASSWORD });
    this.codes = this._readJson(this.codesFile, { codes: [] });
  }

  _readJson(file, fallback) {
    try {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      console.warn('[MemberSystem] read failed:', file, err.message);
    }
    return fallback;
  }

  _writeJson(file, data) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.warn('[MemberSystem] write failed:', file, err.message);
      return false;
    }
  }

  status() {
    const active = !!this.state.activated && this.state.expireAt > Date.now();
    return {
      activated: active,
      activatedAt: active ? this.state.activatedAt : 0,
      expireAt: active ? this.state.expireAt : 0,
    };
  }

  activate(inputCode) {
    const result = verifyActivationCode(inputCode);
    if (!result.valid) return { ok: false, error: result.error };
    this.state = { version: 1, activated: true, code: formatCode(inputCode), activatedAt: Date.now(), expireAt: result.expireAt };
    this._writeJson(this.stateFile, this.state);
    const record = this.codes.codes.find(item => item.code === formatCode(inputCode));
    if (record && !record.usedAt) {
      record.usedAt = Date.now();
      this._writeJson(this.codesFile, this.codes);
    }
    return { ok: true, expireAt: result.expireAt };
  }

  adminCheck(password) {
    return String(password || '') === String(this.admin.password || DEFAULT_ADMIN_PASSWORD);
  }

  setAdminPassword(oldPassword, newPassword) {
    if (!this.adminCheck(oldPassword)) return { ok: false, error: '管理口令不正确' };
    const next = String(newPassword || '').trim();
    if (next.length < 6) return { ok: false, error: '新口令至少 6 位' };
    this.admin.password = next;
    this._writeJson(this.adminFile, this.admin);
    return { ok: true };
  }

  generateCodes(password, count, days) {
    if (!this.adminCheck(password)) return { ok: false, error: '管理口令不正确' };
    const num = Math.max(1, Math.min(100, Math.floor(Number(count) || 1)));
    const validDays = Math.max(1, Math.min(3650, Math.floor(Number(days) || 30)));
    const generated = [];
    for (let i = 0; i < num; i++) {
      const item = createActivationCode(validDays);
      generated.push(item.code);
      this.codes.codes.push({ code: item.code, days: item.days, createdAt: Date.now(), usedAt: 0 });
    }
    this._writeJson(this.codesFile, this.codes);
    return { ok: true, codes: generated, days: validDays };
  }

  codeRecords() {
    return this.codes.codes.slice().reverse();
  }
}

module.exports = { MemberSystem, verifyActivationCode, createActivationCode };
