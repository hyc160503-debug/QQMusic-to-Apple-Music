// ==UserScript==
// @name         QQ「我喜欢」→ Apple Music（本地迁移助手）
// @namespace    qqmusic-to-applemusic.opensource
// @version      1.1.0-beta.2
// @description  QQ 音乐「我喜欢」迁移 Apple Music；报告恢复、批量审核与建歌单
// @license      PolyForm-Noncommercial-1.0.0
// @homepageURL  https://github.com/hyc160503-debug/QQMusic-to-Apple-Music
// @supportURL   https://github.com/hyc160503-debug/QQMusic-to-Apple-Music/issues
// @match        https://y.qq.com/*
// @match        https://*.y.qq.com/*
// @match        https://music.apple.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      u.y.qq.com
// @noframes
// ==/UserScript==

// License terms: https://polyformproject.org/licenses/noncommercial/1.0.0
// Required Notice: Copyright 2026 hyc160503-debug (https://github.com/hyc160503-debug)

(() => {
  'use strict';
  const isQQ = /(^|\.)y\.qq\.com$/i.test(location.hostname);
  const isApple = location.hostname === 'music.apple.com';
  if (!isQQ && !isApple) return;

  const KEY = 'qqam';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const str = v => String(v == null ? '' : v).trim();
  const safeName = s => str(s).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 70);

  function download(name, data, type = 'application/json;charset=utf-8') {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function csvCell(v) { return '"' + str(v).replace(/"/g, '""') + '"'; }
  function csv(rows) {
    return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  }
  function log(message, error = false) {
    const out = document.getElementById(KEY + '-log');
    if (!out) return;
    const p = document.createElement('div');
    p.textContent = `${new Date().toLocaleTimeString()} ${message}`;
    if (error) p.style.color = '#e5484d';
    out.appendChild(p);
    out.scrollTop = out.scrollHeight;
  }
  function setStatus(s) {
    const el = document.getElementById(KEY + '-status');
    if (el) el.textContent = s;
  }
  function get(id) { return document.getElementById(KEY + '-' + id); }
  function getCookie(name) {
    // 只用于访问 QQ 音乐官方接口。不会写进备份文件或发送到其他域名。
    const hit = document.cookie.split('; ').find(part => part.startsWith(name + '='));
    if (!hit) return '';
    try { return decodeURIComponent(hit.slice(name.length + 1)); }
    catch { return hit.slice(name.length + 1); }
  }
  function qqPost(body) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: 'https://u.y.qq.com/cgi-bin/musicu.fcg',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'Referer': 'https://y.qq.com/'
        },
        withCredentials: true,
        data: JSON.stringify(body),
        timeout: 24000,
        onload: res => {
          if (res.status < 200 || res.status >= 300) {
            reject(new Error('QQ 音乐 HTTP ' + res.status)); return;
          }
          try { resolve(JSON.parse(res.responseText)); }
          catch { reject(new Error('QQ 音乐接口未返回可解析的 JSON')); }
        },
        ontimeout: () => reject(new Error('QQ 音乐连接超时')),
        onerror: () => reject(new Error('无法连接 QQ 音乐接口'))
      });
    });
  }
  function normalizeQQSong(item) {
    const x = item?.songInfo || item?.songinfo || item?.track || item?.song || item || {};
    const singers = x.singer || x.singers || x.ar || [];
    const artist = Array.isArray(singers)
      ? singers.map(a => typeof a === 'string' ? a : a?.name || a?.title || '').filter(Boolean).join(' / ')
      : typeof singers === 'string' ? singers : str(singers.name);
    const title = str(x.name || x.title || x.songname || x.songName);
    const ms = Number(x.interval || 0) > 0 ? Number(x.interval) * 1000
      : Number(x.duration_ms || x.durationMs || 0) || 0;
    return { title, artist, album: str(x.album?.name || x.albumname || x.albumName || ''),
      durationMs: ms, qqMid: str(x.mid || x.songmid || ''), qqId: str(x.id || x.songid || '') };
  }
  function sameSong(a, b) {
    if (a.qqMid && b.qqMid) return a.qqMid === b.qqMid;
    if (a.qqId && b.qqId) return a.qqId === b.qqId;
    return (a.title + '|' + a.artist + '|' + a.album + '|' + a.durationMs) ===
      (b.title + '|' + b.artist + '|' + b.album + '|' + b.durationMs);
  }

  async function exportLiked() {
    const button = get('export');
    button.disabled = true;
    const KEY_REQ = 'music.srfDissInfo.DissInfo';
    const BATCH = 200;
    const MAX_PAGES = 100;
    const songs = [];
    let reportedTotal = null;
    try {
      setStatus('读取中，请不要关闭此标签页…');
      for (let page = 0; page < MAX_PAGES; page++) {
        const qqUin = getCookie('uin').replace(/^o/, '');
        const wxUin = getCookie('wxuin').replace(/^o/, '');
        const uin = /^\d+$/.test(qqUin) && Number(qqUin) > 0 ? qqUin : wxUin;
        const authst = getCookie('qm_keyst') || getCookie('qqmusic_key') || '';
        const body = {
          comm: { ct: 24, cv: 0, uin: /^\d+$/.test(uin) ? Number(uin) : 0,
            ...(authst ? {authst} : {}), format: 'json', platform: 'yqq.json' },
          [KEY_REQ]: {
            module: KEY_REQ, method: 'CgiGetDiss',
            param: { disstid: 0, dirid: 201, tag: true, song_begin: page * BATCH,
              song_num: BATCH, userinfo: true, orderlist: true }
          }
        };
        const result = await qqPost(body);
        const block = result[KEY_REQ];
        if (result.code !== undefined && result.code !== 0) throw new Error('QQ 接口错误 ' + result.code);
        if (!block || (block.code !== undefined && block.code !== 0)) {
          throw new Error('QQ 未提供「我喜欢」数据（可能是登录过期、接口更新，错误码 ' + (block?.code ?? '?') + '）');
        }
        const data = block.data || {};
        const list = data.songlist || data.songList || [];
        if (!Array.isArray(list)) throw new Error('QQ 返回了非预期歌曲列表格式');
        const n = Number(data.total_song_num ?? data.dirinfo?.songnum ?? NaN);
        if (Number.isFinite(n) && n >= 0) reportedTotal = n;
        if (page === 0 && list.length === 0 && reportedTotal !== 0) {
          throw new Error('没有读取到歌曲，请确认已用自己的 QQ/微信账号登录网页 QQ 音乐');
        }
        let newCount = 0;
        for (const item of list) {
          const song = normalizeQQSong(item);
          if (song.title && !songs.some(s => sameSong(song, s))) {
            songs.push(song); newCount++;
          }
        }
        log(`第 ${page + 1} 页：读取 ${list.length} 首；累计 ${songs.length}${reportedTotal !== null ? ' / ' + reportedTotal : ''} 首`);
        if (reportedTotal !== null && songs.length >= reportedTotal) break;
        if (!list.length || newCount === 0) {
          if (reportedTotal !== null && songs.length < reportedTotal) {
            throw new Error(`读取不完整：只拿到 ${songs.length}/${reportedTotal} 首；未保存不完整备份`);
          }
          break;
        }
        if (list.length < BATCH && reportedTotal === null) break;
        await sleep(250);
      }
      if (!songs.length) throw new Error('QQ「我喜欢」为空，或 QQ 当前未授权读取');
      if (reportedTotal !== null && songs.length < reportedTotal) {
        throw new Error(`分页结束但缺少歌曲：${songs.length}/${reportedTotal}；请勿误认为全量备份`);
      }
      const payload = {
        format: 'qq-liked-to-apple-music', version: 1,
        source: 'QQ Music — 我喜欢', exportedAt: new Date().toISOString(),
        expectedTotal: reportedTotal, tracks: songs
      };
      download('QQ音乐-我喜欢-备份.json', JSON.stringify(payload, null, 2));
      download('QQ音乐-我喜欢-备份.csv', csv([['歌曲', '歌手', '专辑', '时长毫秒', 'QQ MID'], ...songs.map(s => [s.title, s.artist, s.album, s.durationMs, s.qqMid])]), 'text/csv;charset=utf-8');
      setStatus(`导出成功：${songs.length} 首；已保存 JSON 和 CSV`);
      log('下一步：打开 music.apple.com 登录后，导入刚才下载的 JSON 文件。');
    } catch (e) {
      setStatus('导出失败：' + e.message);
      log(e.message, true);
    } finally { button.disabled = false; }
  }

  function normalize(text) {
    return str(text).toLowerCase().normalize('NFKC')
      .replace(/[’‘`´]/g, "'")
      .replace(/\b(feat\.?|ft\.?|featuring)\b/g, ' ')
      .replace(/[\s\p{P}\p{S}]+/gu, '');
  }
  function editSimilarity(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;
    if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length) * 0.95;
    const cols = Array.from({length: b.length + 1}, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = cols[0]; cols[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const old = cols[j];
        cols[j] = Math.min(cols[j] + 1, cols[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = old;
      }
    }
    return 1 - cols[b.length] / Math.max(a.length, b.length);
  }
  const VERSION_TAGS = ['live', 'remix', 'instrumental', 'acoustic', 'karaoke', 'cover', '伴奏', '现场', '翻唱', '纯音乐', '演唱会', '钢琴版', 'dj版'];
  function versionConflict(a, b) {
    const x = str(a).toLowerCase().normalize('NFKC');
    const y = str(b).toLowerCase().normalize('NFKC');
    return VERSION_TAGS.some(tag => x.includes(tag) !== y.includes(tag));
  }
  function scoreTrack(qq, candidate) {
    const attr = candidate?.attributes || {};
    const song = normalize(qq.title);
    const name = normalize(attr.name);
    const titleScore = editSimilarity(song, name);
    const oneSinger = normalize(qq.artist);
    const amSinger = normalize(attr.artistName);
    let artistScore = editSimilarity(oneSinger, amSinger);
    // 歌手多人的合作歌曲允许其中一个主唱匹配，但不能完全忽略歌手。
    const singers = str(qq.artist).split(/\s*[/、,，&；;]\s*/).map(normalize).filter(Boolean);
    if (singers.length) artistScore = Math.max(artistScore, ...singers.map(s => editSimilarity(s, amSinger)));
    const sec = qq.durationMs && attr.durationInMillis
      ? Math.abs(qq.durationMs - attr.durationInMillis) / 1000 : null;
    const durationScore = sec == null ? 0.65 : sec <= 3 ? 1 : sec <= 10 ? 0.6 : 0;
    const mismatch = versionConflict(qq.title, attr.name);
    const confidence = 0.60 * titleScore + 0.32 * artistScore + 0.08 * durationScore - (mismatch ? 0.28 : 0);
    const safe = titleScore >= 0.87 && artistScore >= 0.73 && confidence >= 0.83 && !mismatch && (sec === null || sec <= 15);
    return { confidence, titleScore, artistScore, safe, mismatch, durationDelta: sec };
  }
  function unwrap(response) { return response?.data || response || {}; }
  function getMK() {
    const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const mk = W.MusicKit?.getInstance?.();
    if (!mk || typeof mk.api?.music !== 'function') {
      throw new Error('网页 MusicKit 未就绪。请先登录、播放一次音乐，刷新页面后重试。');
    }
    return mk;
  }
  function fetchMusic(mk, url, params, options) { return mk.api.music(url, params || {}, options); }
  async function maybeRetry(fn, label, tries = 3) {
    for (let i = 0; ; i++) {
      try { return await fn(); }
      catch (e) {
        const msg = str(e?.message || e);
        if (i >= tries - 1 || !/(429|too many requests|rate limit|503|502|timed out|timeout)/i.test(msg)) throw e;
        log(`${label} 请求过于频繁，稍后重试（${i + 1}/${tries}）`);
        await sleep(1000 * Math.pow(2, i));
      }
    }
  }
  function parseDelimited(text) {
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
      else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
      else if ((ch === '\n' || ch === '\r') && !quoted) {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); if (row.some(Boolean)) rows.push(row);
        row = []; cell = '';
      } else cell += ch;
    }
    row.push(cell); if (row.some(Boolean)) rows.push(row);
    return rows;
  }
  function parseTracks(text, filename = '') {
    let tracks;
    if (/\.json$/i.test(filename) || str(text).startsWith('{') || str(text).startsWith('[')) {
      const data = JSON.parse(text);
      tracks = Array.isArray(data) ? data : data.tracks;
      if (!Array.isArray(tracks)) throw new Error('JSON 必须包含 tracks 数组');
    } else if (/\.csv$/i.test(filename)) {
      const rows = parseDelimited(text.replace(/^\ufeff/, ''));
      if (!rows.length) throw new Error('CSV 为空');
      const head = rows[0].map(normalize);
      const titleAt = head.findIndex(h => /^(歌曲|歌名|title|name|track)$/.test(h));
      const artistAt = head.findIndex(h => /^(歌手|艺人|artist|artists)$/.test(h));
      const albumAt = head.findIndex(h => /^(专辑|album)$/.test(h));
      const hasHead = titleAt >= 0;
      tracks = rows.slice(hasHead ? 1 : 0).map(row => ({
        title: row[hasHead ? titleAt : 0] || '',
        artist: row[hasHead ? artistAt : 1] || '',
        album: hasHead && albumAt >= 0 ? row[albumAt] : ''
      }));
    } else {
      tracks = text.split(/\r?\n/).map(line => {
        const parts = line.split(/\s+[-—–－]\s+/);
        return { title: (parts[0] || '').trim(), artist: (parts.slice(1).join(' - ') || '').trim() };
      });
    }
    const valid = tracks.map(s => ({ title: str(s.title || s.name), artist: str(s.artist || s.artistName),
      album: str(s.album), durationMs: Number(s.durationMs || 0), qqMid: str(s.qqMid) })).filter(s => s.title);
    if (!valid.length) throw new Error('没有发现有效的歌曲名称');
    if (valid.length > 20000) throw new Error('歌曲数量异常（超过20000首），请检查文件');
    return valid;
  }
  // 从报告恢复时不会再发起音乐搜索。
  function restoreReport(data) {
  if (!data || !Array.isArray(data.matches) || !data.matches.length || data.matches.length > 20000) {
    throw new Error('匹配报告 JSON 必须包含非空 matches 数组（最多 20000 首）');
  }
  const allowed = new Set(['matched', 'approved', 'review', 'not_found', 'skipped', 'error']);
  return data.matches.map((entry, index) => {
    const qq = entry.qq;
    if (!qq || !str(qq.title)) throw new Error('匹配报告第 ' + (index + 1) + ' 首缺少 QQ 歌曲信息');
    const candidates = (Array.isArray(entry.candidates) ? entry.candidates : [])
      .filter(c => c && str(c.id))
      .map(c => {
        const raw = typeof c.score === 'number' ? c.score : Number(c.score?.confidence);
        const confidence = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
        return {id: str(c.id), title: str(c.title), artist: str(c.artist), album: str(c.album),
          score: {confidence, safe: false}};
      }).sort((a, b) => b.score.confidence - a.score.confidence);
    let chosen = entry.chosen && str(entry.chosen.id) ? {...entry.chosen} : null;
    if (chosen) {
      const confidence = Number(chosen.score?.confidence ?? chosen.score ?? 0);
      chosen.score = typeof chosen.score === 'object' && chosen.score !== null ? chosen.score :
        {confidence: Number.isFinite(confidence) ? confidence : 0, safe: false};
    }
    if (!chosen && candidates.length) chosen = candidates[0];
    let status = allowed.has(entry.status) ? entry.status : 'review';
    if ((status === 'matched' || status === 'approved') && !chosen) status = 'review';
    return {qq: {title:str(qq.title), artist:str(qq.artist), album:str(qq.album),
      durationMs:Number(qq.durationMs || 0),qqMid:str(qq.qqMid)}, status, chosen, candidates};
  });
}

  let appleTracks = [];
  let matches = [];
  let running = false;
  let reviewPage = 0;
  const REVIEW_PAGE_SIZE = 8;
  function updateSummary() {
    const ok = matches.filter(m => m.status === 'matched' || m.status === 'approved').length;
    const pending = matches.filter(m => m.status === 'review').length;
    const fail = matches.filter(m => m.status === 'not_found').length;
    setStatus(`共 ${appleTracks.length} 首 · 已选中可导入 ${ok} · 待核对 ${pending} · 未找到 ${fail}`);
    get('import').disabled = running || !ok;
    get('report').disabled = !matches.length;
    if (get('bulk')) get('bulk').disabled = running || !pending;
    if (get('review')) renderReview();
  }
  async function loadFile() {
  const file = get('file').files?.[0];
  if (!file) return;
  try {
    const contents = await file.text();
    let report = null;
    if (/\.json$/i.test(file.name)) {
      const data = JSON.parse(contents);
      if (data && Array.isArray(data.matches)) report = restoreReport(data);
    }
    reviewPage = 0;
    get('review').textContent = '';
    get('match').disabled = false;
    if (report) {
      matches = report;
      appleTracks = report.map(m => m.qq);
      updateSummary();
      const pending = report.filter(m => m.status === 'review').length;
      log(`已从匹配报告恢复 ${report.length} 首，待核对 ${pending} 首；不需要重新搜索。`);
    } else {
      appleTracks = parseTracks(contents, file.name);
      matches = [];
      get('import').disabled = true;
      get('report').disabled = true;
      if (get('bulk')) get('bulk').disabled = true;
      setStatus(`文件读取成功：${appleTracks.length} 首，尚未匹配`);
      log(`已加载「${file.name}」，共 ${appleTracks.length} 首`);
    }
  } catch (e) { log(e.message, true); setStatus('文件解析失败：' + e.message); }
}
  async function matchAll() {
    if (running || !appleTracks.length) return;
    running = true;
    matches = [];
    get('match').disabled = true;
    get('import').disabled = true;
    get('report').disabled = true;
    try {
      const mk = getMK();
      if (mk.isAuthorized === false) throw new Error('请先在 Apple Music 网页登录并确保已有订阅');
      const region = str(get('region').value).toLowerCase();
      if (!/^[a-z]{2}$/.test(region)) throw new Error('地区代码要填写两个英文字母，例如 cn、sg、us');
      log('正在搜索 Apple Music（地区：' + region + '），只读预览，不会写入资料库。');
      for (let i = 0; i < appleTracks.length; i++) {
        const qq = appleTracks[i];
        let chosen = null;
        let status = 'not_found';
        let candidates = [];
        try {
          const term = `${qq.title} ${qq.artist}`.trim();
          const response = await maybeRetry(() => fetchMusic(mk,
            `/v1/catalog/${region}/search`, {term, types: 'songs', limit: 8}), '搜索');
          const data = unwrap(response);
          let songs = data.results?.songs?.data || [];
          if (!songs.length && qq.artist) {
            const retry = await maybeRetry(() => fetchMusic(mk,
              `/v1/catalog/${region}/search`, {term: qq.title, types: 'songs', limit: 8}), '补充搜索');
            songs = unwrap(retry).results?.songs?.data || [];
          }
          candidates = songs.map(s => ({ id: String(s.id), title: str(s.attributes?.name),
            artist: str(s.attributes?.artistName), album: str(s.attributes?.albumName),
            score: scoreTrack(qq, s) }))
            .sort((a, b) => b.score.confidence - a.score.confidence);
          if (candidates.length) {
            chosen = candidates[0];
            status = chosen.score.safe && (candidates.length < 2 ||
              chosen.score.confidence - candidates[1].score.confidence >= 0.035 ||
              candidates[1].id === chosen.id) ? 'matched' : 'review';
          }
        } catch (e) {
          status = 'error';
          log(`第 ${i + 1} 首搜索出错：${qq.title}；${e.message}`, true);
        }
        matches.push({ qq, status, chosen, candidates: candidates.slice(0, 3) });
        if ((i + 1) % 10 === 0 || i + 1 === appleTracks.length) {
          setStatus(`匹配进度：${i + 1} / ${appleTracks.length}`);
          log(`匹配 ${i + 1}/${appleTracks.length}`);
        }
        await sleep(300);
      }
      updateSummary();
      log('匹配完成。仅「安全匹配」歌曲会自动导入；待核对和未找到的会出现在下载报告中。');
    } catch (e) { setStatus('匹配失败：' + e.message); log(e.message, true); }
    finally { running = false; get('match').disabled = false; updateSummaryIfAvailable(); }
  }
  function updateSummaryIfAvailable() { if (matches.length === appleTracks.length && matches.length) updateSummary(); }
  function renderReview() {
    const root = get('review');
    root.textContent = '';
    const outstanding = matches.map((m, index) => ({...m, index})).filter(m => m.status === 'review');
    if (!outstanding.length) return;
    const totalPages = Math.ceil(outstanding.length / REVIEW_PAGE_SIZE);
    reviewPage = Math.min(reviewPage, totalPages - 1);
    const heading = document.createElement('div');
    heading.style.cssText = 'font-size:13px;font-weight:700;margin-top:10px';
    heading.textContent = `待人工核对 ${outstanding.length} 首（第 ${reviewPage + 1}/${totalPages} 页）`;
    root.appendChild(heading);
    for (const m of outstanding.slice(reviewPage * REVIEW_PAGE_SIZE, (reviewPage + 1) * REVIEW_PAGE_SIZE)) {
      const item = document.createElement('div'); item.className = 'review-item';
      const song = document.createElement('div');
      song.style.fontWeight = 'bold';
      song.textContent = `${m.qq.title} — ${m.qq.artist}`;
      item.appendChild(song);
      const hint = document.createElement('div'); hint.textContent = '以下是 Apple Music 候选版本（点击正确版本批准）：';
      item.appendChild(hint);
      for (const c of m.candidates) {
        const option = document.createElement('div'); option.className = 'review-option';
        option.textContent = `${c.title} — ${c.artist} / ${c.album || '未知专辑'}（相似度 ${Math.round(c.score.confidence * 100)}%）`;
        option.addEventListener('click', () => {
          matches[m.index].chosen = c;
          matches[m.index].status = 'approved';
          updateSummary();
        });
        item.appendChild(option);
      }
      const skip = document.createElement('button');
      skip.style.background = '#777'; skip.textContent = '跳过这首';
      skip.addEventListener('click', () => { matches[m.index].status = 'skipped'; updateSummary(); });
      item.appendChild(skip);
      root.appendChild(item);
    }
    const nav = document.createElement('div'); nav.className = 'qqam-row';
    const prev = document.createElement('button'); prev.textContent = '上一页'; prev.disabled = reviewPage <= 0;
    prev.addEventListener('click', () => {reviewPage--; renderReview();});
    const next = document.createElement('button'); next.textContent = '下一页'; next.disabled = reviewPage >= totalPages - 1;
    next.addEventListener('click', () => {reviewPage++; renderReview();});
    nav.append(prev, next); root.appendChild(nav);
  }
  function bulkApprove() {
  if (running || !matches.length) return;
  const pending = matches.filter(m => m.status === 'review' && m.candidates?.length);
  const threshold = Number(get('minscore').value);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    alert('最低相似度请填写 0～100 的数字（0 表示所有最高分都批准）。'); return;
  }
  const selection = pending.map(m => ({m, best: [...m.candidates].sort((a, b) => b.score.confidence - a.score.confidence)[0]}))
    .filter(x => x.best.score.confidence * 100 + 1e-8 >= threshold);
  if (!selection.length) { alert('当前没有满足最低相似度要求的待核对歌曲。'); return; }
  const veryLow = selection.filter(x => x.best.score.confidence < 0.20).length;
  const zero = selection.filter(x => x.best.score.confidence === 0).length;
  const warning = veryLow ? `\n警告：其中 ${veryLow} 首相似度低于 20%，有 ${zero} 首得分为 0%。很可能会导入错歌！` : '';
  if (!confirm(`将自动批准 ${selection.length} 首待审核歌曲，每首选择候选列表中得分最高的一个。\n最低相似度：${threshold}%。${warning}\n\n此步骤只更新本地选择，不会写入 Apple Music。确定吗？`)) return;
  for (const {m, best} of selection) { m.chosen = best; m.status = 'approved'; }
  reviewPage = 0;
  updateSummary();
  log(`已批量批准 ${selection.length} 首，最低相似度 ${threshold}%。请点击「下载匹配报告」保存决定，再确认导入。`);
}
  function saveReport() {
    if (!matches.length) return;
    const filename = 'QQ到AppleMusic-匹配报告';
    const full = matches.map(m => ({...m, candidates: m.candidates.map(c => ({...c, score: c.score.confidence}))}));
    download(filename + '.json', JSON.stringify({exportedAt: new Date().toISOString(), matches: full}, null, 2));
    download(filename + '.csv', csv([['状态','原歌曲','原歌手','匹配歌曲','匹配歌手','匹配置信度','Apple歌曲ID'],
      ...matches.map(m => [m.status, m.qq.title, m.qq.artist, m.chosen?.title || '',
        m.chosen?.artist || '', m.chosen?.score.confidence.toFixed(3) || '', m.chosen?.id || ''])]), 'text/csv;charset=utf-8');
    log('已下载匹配报告 JSON + CSV');
  }
  async function importSafe() {
    if (running || matches.length !== appleTracks.length) return;
    const selected = matches.filter(m => m.status === 'matched' || m.status === 'approved');
    if (!selected.length) { log('没有安全匹配的歌曲可导入', true); return; }
    const name = str(get('playlist').value) || 'QQ音乐 我喜欢（迁移）';
    const lowCount = selected.filter(m => Number(m.chosen?.score?.confidence || 0) < 0.2).length;
    const confirmed = confirm(`即将在 Apple Music 新建「${name}」，尝试添加 ${selected.length} 首已确认/自动选择的歌曲。\n\n`+
      `未选中的 ${matches.length - selected.length} 首不会添加。` +
      (lowCount ? `\n警告：其中 ${lowCount} 首匹配相似度低于 20%，可能导入错误歌曲。` : '') +
      `\n不会删除 QQ 音乐歌曲，也不会修改已有 Apple Music 歌单。\n\n确定开始吗？`);
    if (!confirmed) return;
    running = true;
    get('import').disabled = true;
    get('match').disabled = true;
    const LIMIT = 25;
    let playlistId = null;
    let added = 0;
    try {
      const mk = getMK();
      const items = selected.map(m => ({id: m.chosen.id, type: 'songs'}));
      const first = items.slice(0, LIMIT);
      const res = await fetchMusic(mk, '/v1/me/library/playlists', {}, {
        method: 'POST', body: { attributes: {name, description: '由QQ「我喜欢」迁移助手导入（自动或人工批准的候选曲目）'},
          relationships: {tracks: {data: first}} }
      });
      const body = unwrap(res);
      playlistId = body.data?.[0]?.id || body.data?.id || body.id;
      if (!playlistId) throw new Error('建歌单请求已提交，但返回结果缺少歌单 ID。请先到 Apple Music 检查是否已创建，不要重复点击。');
      added = first.length;
      setStatus(`已创建歌单：${name}，添加 ${added}/${items.length}`);
      log('新歌单 ID：' + playlistId);
      for (let i = LIMIT; i < items.length; i += LIMIT) {
        const batch = items.slice(i, i + LIMIT);
        await fetchMusic(mk, `/v1/me/library/playlists/${encodeURIComponent(playlistId)}/tracks`, {},
          {method: 'POST', body: {data: batch}});
        added += batch.length;
        setStatus(`正在写入 Apple Music：${added}/${items.length}`);
        log(`添加进度：${added}/${items.length}`);
        await sleep(500);
      }
      setStatus(`操作完成：新歌单「${name}」已提交 ${added} 首，请在 Apple Music 中核查`);
      log('完成。同步资料库可能需要短暂刷新。请核实最终首数，并保留匹配报告。');
      get('import').disabled = true;
    } catch (e) {
      setStatus(`操作中断：${added}/${selected.length} 首已确认；${e.message}`);
      log(`导入中断。${playlistId ? '目标歌单 ID：' + playlistId : '请检查是否出现新歌单。'} ${e.message}`, true);
      log('为避免重复添加，不会盲目重试写入失败的批次。请先查看 Apple Music。');
    } finally { running = false; get('match').disabled = false; }
  }

  const css = `
    #qqam-toggle {position:fixed;bottom:22px;right:22px;z-index:2147483600;background:#f44b65;color:white;border:0;border-radius:30px;padding:12px 18px;font:600 14px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;cursor:pointer;box-shadow:0 4px 18px #0003}
    #qqam-panel {position:fixed;bottom:74px;right:22px;z-index:2147483600;width:min(440px,calc(100vw - 32px));max-height:min(690px,calc(100vh - 110px));overflow:auto;box-sizing:border-box;padding:18px 18px 16px;border:1px solid #ddd;border-radius:15px;background:#fff;color:#222;font:14px/1.55 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;box-shadow:0 15px 50px #0004;display:none}
    #qqam-panel * {box-sizing:border-box}
    #qqam-panel .qqam-header{font-size:17px;font-weight:700;margin-bottom:8px}
    #qqam-panel .qqam-help {color:#666;font-size:12px;margin-bottom:12px}
    #qqam-panel button {border:0;border-radius:8px;padding:10px 12px;background:#e94361;color:#fff;font-weight:600;cursor:pointer}
    #qqam-panel button[disabled] {opacity:.45;cursor:not-allowed}
    #qqam-panel label {display:block;margin-top:10px;font-size:13px;font-weight:600}
    #qqam-panel input[type=file],#qqam-panel input[type=text],#qqam-panel input[type=number] {width:100%;padding:7px;border:1px solid #bbb;border-radius:6px;background:#fff;color:#222;font-size:13px;margin-top:3px}
    #qqam-panel #qqam-status{background:#f3f3f3;color:#222;padding:10px;border-radius:7px;margin:10px 0}
    #qqam-panel #qqam-log {height:125px;overflow:auto;background:#f9f9f9;border:1px solid #ddd;border-radius:6px;padding:8px;font-size:11px;white-space:pre-wrap;word-wrap:break-word}
    #qqam-panel .qqam-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    #qqam-panel .qqam-note{color:#888;font-size:12px;margin-top:12px}
    #qqam-review .review-item{border:1px solid #ddd;border-radius:7px;padding:9px;margin:7px 0;font-size:12px}
    #qqam-review .review-option{border:1px solid #eee;padding:7px;cursor:pointer;margin:5px 0;border-radius:6px;background:#fbfbfb}
    #qqam-review .review-option:hover{background:#f5f5f5}
    #qqam-review button{font-size:12px;padding:7px 9px}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const toggle = document.createElement('button'); toggle.id = KEY + '-toggle'; toggle.textContent = '♫ QQ → Apple';
  const panel = document.createElement('div'); panel.id = KEY + '-panel';
  panel.innerHTML = isQQ ? `
    <div class="qqam-header">① 备份 QQ「我喜欢」</div>
    <div class="qqam-help">请先在本网站登录自己的 QQ 音乐账号。脚本只调用 QQ 音乐的读取接口，不会更改、删除收藏。</div>
    <button id="qqam-export">读取并下载全部「我喜欢」</button>
    <div id="qqam-status">尚未开始</div>
    <div class="qqam-help">导出会同时得到 JSON（下一步使用）和 CSV（人工备份），保存在 Mac 的下载文件夹。</div>
    <div id="qqam-log"></div>
    <div class="qqam-note">如果 QQ 更改了网页接口，此步骤可能失败；不会谎称已完成全部导出。</div>
  ` : `
    <div class="qqam-header">② 匹配并迁移到 Apple Music</div>
    <div class="qqam-help">支持恢复以前的匹配报告 JSON，无需重新搜索；仅确认后写入 Apple Music。</div>
    <label>选择 QQ 备份 JSON 或 Apple Music 匹配报告 JSON<input type="file" id="qqam-file" accept=".json,.csv,.txt"></label>
    <label>Apple Music 账号地区（两字母：新加坡 sg、中国 cn、美国 us）<input type="text" id="qqam-region" maxlength="2" value="sg"></label>
    <label>新建歌单名<input type="text" id="qqam-playlist" value="QQ音乐 我喜欢（迁移）" maxlength="100"></label>
    <div class="qqam-row"><button id="qqam-match" disabled>① 开始匹配（不写入）</button><button id="qqam-report" disabled>下载匹配报告</button></div>
    <div id="qqam-status">请选择 QQ 导出的 JSON 文件</div>
    <label>批量批准最低相似度（0 = 不限制；可能导入错歌）<input type="number" id="qqam-minscore" min="0" max="100" step="1" value="70"></label>
    <div class="qqam-row"><button id="qqam-bulk" disabled>一键批准待审核歌曲中得分最高的版本</button></div>
    <div class="qqam-help">低相似度可能导入错误歌曲，建议核对。</div>
    <div id="qqam-review"></div>
    <div class="qqam-row"><button id="qqam-import" disabled>② 确认并新建歌单</button></div>
    <div id="qqam-log"></div>
    <div class="qqam-note">重要：这会创建普通 Apple Music 歌单，不会自动给每首歌点「喜爱」心形。无法匹配的歌曲不会被臆测替换。</div>
  `;
  document.body.append(toggle, panel);
  toggle.addEventListener('click', () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; });
  if (isQQ) get('export').addEventListener('click', exportLiked);
  if (isApple) {
    get('file').addEventListener('change', loadFile);
    get('match').addEventListener('click', matchAll);
    get('report').addEventListener('click', saveReport);
    get('bulk').addEventListener('click', bulkApprove);
    get('import').addEventListener('click', importSafe);
  }
})();
