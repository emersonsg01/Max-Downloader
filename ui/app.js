/* Max Downloader — lógica da interface */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ------------------------------------------------------------------ dados
  const ACCENTS = {
    blue: '#007aff', purple: '#af52de', pink: '#ff2d55', red: '#ff3b30',
    orange: '#ff9500', yellow: '#ffcc00', green: '#34c759', graphite: '#8e8e93',
  };
  const CONTAINERS = [
    { v: 'mp4', l: 'MP4', s: 'Universal' },
    { v: 'mkv', l: 'MKV', s: 'Sem limites' },
    { v: 'webm', l: 'WEBM', s: 'Web aberto' },
    { v: 'mov', l: 'MOV', s: 'Apple · edição' },
  ];
  const CODECS = [
    { v: 'auto', l: 'Automático', s: 'Melhor qualidade' },
    { v: 'h264', l: 'H.264', s: 'Compatível com tudo' },
    { v: 'vp9', l: 'VP9', s: 'Eficiente' },
    { v: 'av1', l: 'AV1', s: 'Mais moderno' },
  ];
  const VAUDIO = [
    { v: 'best', l: 'Máxima', s: 'Melhor disponível' },
    { v: 'medium', l: 'Equilibrada', s: 'Até 128 kbps' },
    { v: 'low', l: 'Econômica', s: 'Até 64 kbps' },
  ];
  const AFORMATS = [
    { v: 'mp3', l: 'MP3', s: 'Toca em tudo' },
    { v: 'm4a', l: 'M4A', s: 'AAC · Apple' },
    { v: 'opus', l: 'OPUS', s: 'Mais eficiente' },
    { v: 'aac', l: 'AAC', s: 'Fluxo puro' },
    { v: 'ogg', l: 'OGG', s: 'Vorbis' },
    { v: 'flac', l: 'FLAC', s: 'Sem perdas', ll: true },
    { v: 'wav', l: 'WAV', s: 'Sem compressão', ll: true },
    { v: 'original', l: 'Original', s: 'Sem conversão' },
  ];
  const AQ = [
    { v: '96', s: 'Voz' }, { v: '128', s: 'Boa' }, { v: '192', s: 'Ótima' },
    { v: '256', s: 'Excelente' }, { v: '320', s: 'Máxima' },
  ];
  const NO_THUMB_AUDIO = new Set(['wav', 'aac']);
  const SOURCE_NAMES = { Youtube: 'YouTube', YoutubeTab: 'YouTube', Instagram: 'Instagram', TikTok: 'TikTok', Twitter: 'X', Vimeo: 'Vimeo', Soundcloud: 'SoundCloud', Twitch: 'Twitch', Reddit: 'Reddit', Facebook: 'Facebook' };

  // ------------------------------------------------------------------ estado
  const S = {
    cfg: null, folders: null, info: null, mode: 'video',
    video: {}, audio: {}, extras: {},
    trim: { on: false, start: 0, end: 0 },
    jobs: new Map(), filter: 'all', lastClip: '', estToken: 0,
  };
  let api = null;

  // ------------------------------------------------------------------ util
  const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  function fmtBytes(b) {
    if (!b || b <= 0) return '';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (b >= 1000 && i < u.length - 1) { b /= 1000; i++; }
    return `${nf.format(b >= 100 || i === 0 ? Math.round(b) : b)} ${u[i]}`;
  }
  function fmtDur(s) {
    if (s == null || isNaN(s)) return '';
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
  }
  function parseDur(t) {
    const p = String(t).trim().split(':').map(Number);
    if (p.some(isNaN)) return null;
    return p.reduce((a, v) => a * 60 + v, 0);
  }
  function fmtEta(s) {
    if (s == null) return '';
    if (s < 60) return `${Math.max(1, Math.round(s))} s`;
    if (s < 3600) return `${Math.round(s / 60)} min`;
    return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;
  }
  function fmtDate(d) {
    if (!d || d.length !== 8) return '';
    const dt = new Date(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8));
    return dt.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const looksLikeUrl = (t) => /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test((t || '').trim()) && /[./]/.test(t);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  function resName(r) { return r >= 4320 ? '8K' : r >= 2160 ? '4K' : r >= 1440 ? '2K' : null; }
  function resSub(r) { return r >= 1080 && r < 1440 ? 'Full HD' : r >= 720 && r < 1080 ? 'HD' : r < 720 ? 'SD' : `${r}p`; }

  function toast(msg, ico = 'check-circle', bad = false) {
    const el = document.createElement('div');
    el.className = 'toast' + (bad ? ' bad' : '');
    el.innerHTML = icon(ico) + `<span>${esc(msg)}</span>`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3200);
  }

  function chime() {
    if (!S.cfg?.sound) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;
      [[1046.5, 0], [1568, 0.1]].forEach(([f, t]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, now + t);
        g.gain.linearRampToValueAtTime(0.16, now + t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, now + t + 1.1);
        o.connect(g).connect(ctx.destination);
        o.start(now + t); o.stop(now + t + 1.2);
      });
      setTimeout(() => ctx.close(), 1600);
    } catch { /* sem áudio */ }
  }

  // ------------------------------------------------------------------ segmented
  function glide(seg) {
    const on = seg.querySelector('button.on');
    const g = seg.querySelector('.seg-glider');
    if (!on || !g || !on.offsetWidth) return;
    g.style.width = on.offsetWidth + 'px';
    g.style.transform = `translateX(${on.offsetLeft}px)`;
  }
  function setSeg(seg, attr, value) {
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset[attr] === value));
    glide(seg);
  }
  const glideAll = () => $$('.segmented').forEach(glide);

  // ------------------------------------------------------------------ tema
  function applyLook() {
    const root = document.documentElement;
    if (S.cfg.theme === 'auto') root.removeAttribute('data-theme');
    else root.dataset.theme = S.cfg.theme;
    const hex = ACCENTS[S.cfg.accent] || ACCENTS.blue;
    const n = parseInt(hex.slice(1), 16);
    root.style.setProperty('--accent', hex);
    root.style.setProperty('--accent-rgb', `${n >> 16}, ${(n >> 8) & 255}, ${n & 255}`);
    root.style.setProperty('--accent-ink', S.cfg.accent === 'yellow' ? '#1d1d1f' : '#fff');
    setSeg($('#themeSeg'), 'theme', S.cfg.theme);
    $$('.accent-dot').forEach((d) => d.classList.toggle('on', d.dataset.accent === S.cfg.accent));
  }

  async function saveSettings(patch) {
    const r = await api.update_settings(patch);
    S.cfg = r.config; S.folders = r.folders;
    renderSettings();
  }

  // ------------------------------------------------------------------ navegação
  function show(view) {
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
    $$('.nav-item[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    requestAnimationFrame(glideAll);
  }

  function goAccess() {
    show('settings');
    setTimeout(() => {
      const sec = $('#accessSection');
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const grp = sec.nextElementSibling;
      grp.animate([{ boxShadow: '0 0 0 0 rgba(var(--accent-rgb),.0)' }, { boxShadow: '0 0 0 4px rgba(var(--accent-rgb),.45)' }, { boxShadow: '0 0 0 0 rgba(var(--accent-rgb),0)' }], { duration: 1400, delay: 300 });
    }, 120);
  }

  // ------------------------------------------------------------------ análise
  function setBusy(on) {
    $('#omnibox').classList.toggle('busy', on);
    $('#edgeGlow').classList.toggle('on', on);
    $('#analyzeBtn').disabled = on;
    $('#skeleton').hidden = !on;
    if (on) {
      $('#result').hidden = true; $('#errorCard').hidden = true; $('#actionBar').hidden = true;
      $('#clipSuggest').hidden = true;
      $('#homeScroll').classList.add('compact');
    }
  }

  async function analyze(raw) {
    let url = (raw ?? $('#urlInput').value).trim();
    if (!url) { $('#omnibox').animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 300 }); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    $('#urlInput').value = url; $('#clearBtn').hidden = false;
    S.lastClip = url;
    setBusy(true);
    const r = await api.analyze(url);
    setBusy(false);
    if (!r.ok) {
      $('#errorText').textContent = r.error;
      $('#errorCard').hidden = false;
      const fixable = ['auth', 'geo', 'cookies'].includes(r.kind);
      $('#errorActions').hidden = !fixable;
      $('#errorFix').textContent = r.kind === 'geo' ? 'Configurar proxy' : r.kind === 'cookies' ? 'Trocar fonte de login' : 'Conectar minha conta';
      if (!S.info) $('#homeScroll').classList.remove('compact');
      else { $('#result').hidden = false; $('#actionBar').hidden = false; }
      return;
    }
    S.info = r.info;
    showResult();
  }

  function showResult() {
    const i = S.info;
    const amb = $('#ambientImg');
    if (i.thumbnail) {
      amb.onload = () => $('.ambient').classList.add('has-img');
      amb.src = i.thumbnail;
    } else $('.ambient').classList.remove('has-img');

    $('#thumb').src = i.thumbnail || '';
    $('#duration').textContent = i.kind === 'playlist' ? `${i.count} itens` : fmtDur(i.duration);
    $('#duration').hidden = !(i.duration || i.kind === 'playlist');
    $('#liveBadge').hidden = !i.is_live;
    $('#sourceLabel').textContent = (SOURCE_NAMES[i.extractor] || i.extractor || 'Link') + (i.kind === 'playlist' ? ' · Playlist' : '');
    $('#title').textContent = i.title;
    $('#uploader').textContent = i.uploader || '';

    const chips = [];
    if (i.kind === 'video') {
      const top = i.resolutions[0];
      if (top) {
        const maxFps = Math.max(...i.resolutions.flatMap((r) => r.fps));
        chips.push(`<span class="mchip accent">Até ${resName(top.value) || top.value + 'p'}${maxFps > 30 ? ` · ${maxFps} fps` : ''}</span>`);
      }
      if (i.hdr_available) chips.push('<span class="mchip hdr">HDR</span>');
      if (i.view_count) chips.push(`<span class="mchip">${icon('eye')}${compact.format(i.view_count)}</span>`);
      if (i.like_count) chips.push(`<span class="mchip">${icon('heart')}${compact.format(i.like_count)}</span>`);
      if (i.upload_date) chips.push(`<span class="mchip">${icon('calendar')}${fmtDate(i.upload_date)}</span>`);
      if (!i.resolutions.length) chips.push(`<span class="mchip">${icon('music')}Somente áudio</span>`);
    } else {
      chips.push(`<span class="mchip accent">${icon('list')}${i.count} itens</span>`);
    }
    $('#mediaChips').innerHTML = chips.join('');

    const strip = $('#playlistStrip');
    strip.hidden = i.kind !== 'playlist';
    if (i.kind === 'playlist') {
      strip.innerHTML = i.entries.slice(0, 40).map((e, n) => `
        <div class="pl-item"><div class="pl-thumb">${e.thumbnail ? `<img loading="lazy" src="${esc(e.thumbnail)}">` : ''}</div>
        <span>${n + 1}. ${esc(e.title)}</span></div>`).join('');
    }

    // modo padrão: o último usado (ou áudio, se não houver vídeo)
    S.mode = i.kind === 'video' && !i.resolutions.length ? 'audio' : (S.cfg.last_mode || 'video');
    S.trim = { on: false, start: 0, end: i.duration || 0 };
    $('#trimToggle').checked = false; $('#trimBox').hidden = true;

    $('#result').hidden = false;
    $('#actionBar').hidden = false;
    $('#result').style.animation = 'none'; void $('#result').offsetWidth; $('#result').style.animation = '';
    renderOptions();
  }

  // ------------------------------------------------------------------ opções
  function chipHTML(list, cur, cap, disabled = () => false) {
    return list.map((c) => `<button class="chip${c.v === cur ? ' on' : ''}" data-v="${c.v}"${disabled(c.v) ? ' disabled' : ''}>${cap ? `${c.l}<small>${c.s}</small>` : c.l}</button>`).join('');
  }

  function currentRes() {
    const i = S.info;
    if (!i || !i.resolutions.length) return null;
    if (S.video.resolution === 'best') return i.resolutions[0];
    return i.resolutions.find((r) => r.value === +S.video.resolution) || null;
  }

  function normalizeVideo() {
    const i = S.info, v = S.video;
    if (v.resolution !== 'best' && !i.resolutions.some((r) => r.value === +v.resolution)) {
      // escolhe a resolução mais próxima abaixo da preferida
      const lower = i.resolutions.find((r) => r.value <= +v.resolution);
      v.resolution = lower ? lower.value : 'best';
    }
    const r = currentRes();
    const hdrOk = !!(r && r.hdr);
    if (!hdrOk) v.hdr = false;
    const fpsList = r ? (v.hdr ? r.hdr_fps : r.fps) : [];
    if (v.fps !== 'best' && !fpsList.includes(+v.fps)) v.fps = 'best';
    if (v.container === 'webm' && v.codec === 'h264') v.codec = 'auto';
    if (v.container === 'mov' && !['auto', 'h264'].includes(v.codec)) v.codec = 'h264';
    if (v.hdr && v.codec === 'h264') v.codec = 'auto';
    if (v.hdr && v.container === 'mov') v.container = 'mkv';
    return { r, hdrOk, fpsList };
  }

  function renderOptions() {
    const i = S.info;
    setSeg($('#modeSeg'), 'mode', S.mode);
    const noVideo = i.kind === 'video' && !i.resolutions.length;
    $('#modeSeg [data-mode="video"]').disabled = noVideo;
    $('#videoOptions').hidden = S.mode !== 'video';
    $('#audioOptions').hidden = S.mode !== 'audio';

    if (S.mode === 'video') renderVideo(); else renderAudio();

    // extras
    $$('[data-extra]').forEach((el) => { el.checked = !!S.extras[el.dataset.extra]; });
    $('#subsRow').hidden = S.mode !== 'video' || (i.kind === 'video' && !i.has_subtitles);
    $('#subsSub').textContent = i.subtitle_langs?.length ? `Disponíveis: ${i.subtitle_langs.slice(0, 8).join(', ')}${i.subtitle_langs.length > 8 ? '…' : ''}` : 'Incorporadas ao vídeo';
    $('#sponsorRow').hidden = !i.is_youtube;
    $('#trimRow').hidden = i.kind !== 'video' || !i.duration || i.is_live;
    const thumbRow = $('[data-extra="thumbnail"]').closest('.row');
    const thumbBad = S.mode === 'audio' ? NO_THUMB_AUDIO.has(S.audio.format) : S.video.container === 'webm';
    thumbRow.style.opacity = thumbBad ? 0.45 : 1;
    thumbRow.querySelector('.row-sub').textContent = thumbBad ? 'Não suportado neste formato' : 'A miniatura vira a arte do arquivo';

    updateSummary();
  }

  function renderVideo() {
    const i = S.info, v = S.video;
    const { r, hdrOk, fpsList } = normalizeVideo();

    const top = i.resolutions[0];
    const tiles = [`<button class="tile${v.resolution === 'best' ? ' on' : ''}" data-v="best"><b>Máxima</b><small>${top ? (resName(top.value) || top.value + 'p') : 'Auto'}</small></button>`];
    for (const x of i.resolutions) {
      const big = resName(x.value);
      tiles.push(`<button class="tile${+v.resolution === x.value ? ' on' : ''}" data-v="${x.value}">
        ${x.hdr ? '<span class="tag">HDR</span>' : ''}
        <b>${big || x.value + 'p'}</b><small>${big ? x.value + 'p' : resSub(x.value)}${x.size ? ' · ' + fmtBytes(x.size) : ''}</small></button>`);
    }
    $('#resTiles').innerHTML = tiles.join('');
    $('#resHint').textContent = i.kind === 'playlist' ? 'Aplicado a cada item (ou o mais próximo)' : 'Tamanhos aproximados do vídeo';

    const fpsOpts = [{ v: 'best', l: 'Máximo' }, ...fpsList.map((f) => ({ v: String(f), l: `${f} fps` }))];
    $('#fpsChips').innerHTML = chipHTML(fpsOpts, String(v.fps), false);

    $('#hdrToggle').checked = !!v.hdr;
    $('#hdrGroup').classList.toggle('disabled', !hdrOk);
    $('#hdrSub').textContent = hdrOk
      ? (v.hdr ? `HDR em ${r.hdr_fps.join(' / ')} fps — ideal para telas HDR` : 'Cores e brilho mais intensos em telas compatíveis')
      : (i.hdr_available ? 'Indisponível nesta resolução' : 'Este vídeo não tem versão HDR');

    $('#containerChips').innerHTML = chipHTML(CONTAINERS, v.container, true, (c) => v.hdr && c === 'mov');
    $('#codecChips').innerHTML = chipHTML(CODECS, v.codec, true, (c) =>
      (c === 'h264' && (v.hdr || v.container === 'webm')) ||
      (v.container === 'mov' && !['auto', 'h264'].includes(c)) ||
      (r && r.codecs && r.codecs.length && c !== 'auto' && !r.codecs.includes(c)));
    $('#vAudioChips').innerHTML = chipHTML(VAUDIO, v.audio_quality, true);
  }

  function renderAudio() {
    const a = S.audio;
    $('#afmtTiles').innerHTML = AFORMATS.map((f) => `
      <button class="tile${a.format === f.v ? ' on' : ''}" data-v="${f.v}">
        ${f.ll ? '<span class="tag ll">LOSSLESS</span>' : ''}<b>${f.l}</b><small>${f.s}</small></button>`).join('');
    const fixed = a.format === 'flac' || a.format === 'wav' || a.format === 'original';
    $('#aqSteps').innerHTML = AQ.map((q) => `<button class="step${a.quality === q.v ? ' on' : ''}" data-v="${q.v}"><b>${q.v}</b><small>kbps · ${q.s}</small></button>`).join('');
    $('#aqSteps').classList.toggle('disabled', fixed);
    const max = S.info.max_abr;
    $('#aqHint').textContent = fixed
      ? (a.format === 'original' ? 'Mantém o áudio exatamente como está na fonte' : 'Formato sem perdas — qualidade máxima da fonte')
      : (max ? `A fonte tem ~${max} kbps` : '');
  }

  // ------------------------------------------------------------------ resumo / estimativa
  function collect() {
    const i = S.info;
    return {
      url: i.url, title: i.title, thumbnail: i.thumbnail, mode: S.mode,
      is_youtube: i.is_youtube, playlist: i.kind === 'playlist', count: i.count || null,
      video: { ...S.video }, audio: { ...S.audio }, extras: { ...S.extras },
      trim: S.trim.on ? { start: S.trim.start, end: S.trim.end >= (i.duration || 0) ? null : S.trim.end } : null,
      label: $('#summaryMain').dataset.plain || '',
    };
  }

  function baseSummary() {
    if (S.mode === 'audio') {
      const f = AFORMATS.find((x) => x.v === S.audio.format);
      const fixed = ['flac', 'wav', 'original'].includes(S.audio.format);
      return `${f.l}${fixed ? '' : ` · ${S.audio.quality} kbps`}`;
    }
    const v = S.video, r = currentRes();
    const res = v.resolution === 'best' ? (r ? `${r.value}p` : 'Máxima') : `${v.resolution}p`;
    const fps = v.fps === 'best' ? (r ? Math.max(...(v.hdr ? r.hdr_fps : r.fps)) : '') : v.fps;
    return `${res}${fps ? fps : ''}${v.hdr ? ' HDR' : ''} · ${v.container.toUpperCase()}`;
  }

  function updateSummary() {
    const i = S.info;
    const main = $('#summaryMain');
    const plain = baseSummary();
    main.dataset.plain = plain;
    main.innerHTML = esc(plain);
    const folder = S.mode === 'audio' ? 'Áudios' : 'Vídeos';
    let sub = `Salvar em ${folder}`;
    if (S.trim.on) sub += ` · Trecho de ${fmtDur(S.trim.end - S.trim.start)}`;
    $('#summarySub').textContent = sub;
    $('#ctaLabel').textContent = i.kind === 'playlist' ? `Baixar ${i.count} itens` : 'Baixar';
    if (i.kind === 'video') requestEstimate();
  }

  const requestEstimate = debounce(async () => {
    const token = ++S.estToken;
    const est = await api.estimate(collect());
    if (token !== S.estToken || !est || !est.size && !est.video && !est.audio) return;
    const parts = [];
    if (est.video) {
      parts.push(`${est.video.res || ''}p${est.video.fps || ''}${est.video.hdr && est.video.hdr !== 'SDR' ? ' ' + est.video.hdr : ''}`);
      parts.push(est.video.codec + (est.audio ? ' + ' + est.audio.codec : ''));
      parts.push(S.video.container.toUpperCase());
    } else if (est.audio) {
      parts.push(baseSummary());
      parts.push(`fonte ${est.audio.codec}${est.audio.abr ? ' ' + est.audio.abr + ' kbps' : ''}`);
    }
    const main = $('#summaryMain');
    main.dataset.plain = parts.join(' · ');
    main.innerHTML = esc(parts.join(' · ')) + (est.size ? ` <span class="est">· ≈ ${fmtBytes(est.size)}</span>` : '');
  }, 220);

  // ------------------------------------------------------------------ recorte
  function trimRender() {
    const d = S.info?.duration || 1;
    const a = (S.trim.start / d) * 100, b = (S.trim.end / d) * 100;
    $('#trimA').style.left = a + '%';
    $('#trimB').style.left = b + '%';
    $('#trimFill').style.left = a + '%';
    $('#trimFill').style.width = (b - a) + '%';
    if (document.activeElement !== $('#trimStart')) $('#trimStart').value = fmtDur(S.trim.start);
    if (document.activeElement !== $('#trimEnd')) $('#trimEnd').value = fmtDur(S.trim.end);
    $('#trimLen').textContent = `Duração: ${fmtDur(S.trim.end - S.trim.start)}`;
  }
  function trimDrag(handle) {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const track = $('#trimTrack').getBoundingClientRect();
      const d = S.info.duration;
      const move = (ev) => {
        const t = Math.round(Math.min(1, Math.max(0, (ev.clientX - track.left) / track.width)) * d);
        if (handle.id === 'trimA') S.trim.start = Math.min(t, S.trim.end - 1);
        else S.trim.end = Math.max(t, S.trim.start + 1);
        trimRender();
      };
      const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); updateSummary(); };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  }

  // ------------------------------------------------------------------ download
  async function startDownload() {
    if (!S.info) return;
    const opts = collect();
    const btn = $('#downloadBtn');
    btn.disabled = true;
    flyToDownloads();
    await api.download(opts);
    S.cfg.last_mode = S.mode;
    if (S.mode === 'audio') S.cfg.audio = { ...S.audio }; else S.cfg.video = { ...S.video };
    S.cfg.extras = { ...S.extras };
    setTimeout(() => { btn.disabled = false; }, 500);
  }

  // “Efeito gênio”: a capa voa até Downloads
  function flyToDownloads() {
    const src = $('#thumb');
    const target = $('.nav-item[data-view="downloads"]');
    if (!src.src) return;
    const a = src.getBoundingClientRect(), b = target.getBoundingClientRect();
    const ghost = src.cloneNode();
    Object.assign(ghost.style, {
      position: 'fixed', left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px',
      borderRadius: '16px', zIndex: 100, objectFit: 'cover', pointerEvents: 'none', boxShadow: '0 20px 50px rgba(0,0,0,.3)',
    });
    document.body.appendChild(ghost);
    const dx = b.left + 20 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    ghost.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1, borderRadius: '16px' },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.2 - 60}px) scale(.45)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(.06)`, opacity: 0.2, borderRadius: '50%' },
    ], { duration: 850, easing: 'cubic-bezier(.5,0,.2,1)' }).onfinish = () => {
      ghost.remove();
      target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 350, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    };
  }

  // ------------------------------------------------------------------ lista de downloads
  function jobMeta(j) {
    const sep = '<span class="dot"></span>';
    const pl = j.playlist_index && j.playlist_count ? `Item ${j.playlist_index} de ${j.playlist_count}${sep}` : '';
    switch (j.status) {
      case 'queued': return 'Na fila — aguardando vaga';
      case 'downloading': {
        const parts = [`${pl}${esc(j.stage)}`];
        if (j.total) parts.push(`${fmtBytes(j.downloaded)} de ${fmtBytes(j.total)}`);
        if (j.speed) parts.push(`${fmtBytes(j.speed)}/s`);
        if (j.eta != null) parts.push(`${fmtEta(j.eta)} restantes`);
        return parts.join(sep);
      }
      case 'processing': return `${pl}${esc(j.stage)}…`;
      case 'done': return `<span class="ok">${icon('check')}Concluído</span>${j.total ? sep + fmtBytes(j.total) : ''}${j.label ? sep + esc(j.label) : ''}`;
      case 'error': return `<span class="err">${esc(j.error || 'Falhou')}</span>`;
      case 'canceled': return 'Cancelado';
      default: return '';
    }
  }
  function jobActions(j) {
    const b = (act, ico, title, cls = '') => `<button class="icon-btn ${cls}" data-act="${act}" title="${title}">${icon(ico)}</button>`;
    if (['queued', 'downloading', 'processing'].includes(j.status)) return b('cancel', 'xmark', 'Cancelar');
    if (j.status === 'done') return (j.filepath ? b('open', 'play', 'Abrir', 'accent') + b('reveal', 'search', 'Mostrar na pasta') : '') + b('remove', 'trash', 'Remover da lista');
    const fix = ['auth', 'geo', 'cookies'].includes(j.error_kind) ? b('access', 'key', 'Configurar acesso', 'accent') : '';
    return fix + b('retry', 'retry', 'Tentar de novo', fix ? '' : 'accent') + b('remove', 'trash', 'Remover da lista');
  }
  function jobVisible(j) {
    if (S.filter === 'active') return ['queued', 'downloading', 'processing'].includes(j.status);
    if (S.filter === 'done') return j.status === 'done';
    return true;
  }
  function renderJob(j) {
    let el = document.getElementById('job-' + j.id);
    const list = $('#dlList');
    if (!el) {
      el = document.createElement('div');
      el.className = 'dl-item';
      el.id = 'job-' + j.id;
      el.innerHTML = `
        <div class="dl-thumb">${j.thumbnail ? `<img src="${esc(j.thumbnail)}">` : ''}<span class="kind">${icon(j.mode === 'audio' ? 'music' : 'film')}</span></div>
        <div class="dl-body"><div class="dl-title"></div><div class="dl-meta"></div><div class="bar"><i></i></div></div>
        <div class="pct"></div><div class="dl-actions"></div>`;
      list.prepend(el);
    }
    el.querySelector('.dl-title').textContent = j.title;
    el.querySelector('.dl-meta').innerHTML = jobMeta(j);
    const bar = el.querySelector('.bar');
    bar.className = 'bar ' + j.status;
    bar.querySelector('i').style.width = (j.progress * 100).toFixed(1) + '%';
    el.querySelector('.pct').textContent = j.status === 'downloading' ? Math.floor(j.progress * 100) + '%' : '';
    const acts = el.querySelector('.dl-actions');
    const sig = j.status + (j.filepath ? 1 : 0);
    if (acts.dataset.sig !== sig) { acts.innerHTML = jobActions(j); acts.dataset.sig = sig; }
    el.hidden = !jobVisible(j);
  }
  function refreshListMeta() {
    const all = [...S.jobs.values()];
    const active = all.filter((j) => ['queued', 'downloading', 'processing'].includes(j.status));
    const done = all.filter((j) => j.status === 'done');
    const badge = $('#navBadge');
    badge.hidden = !active.length; badge.textContent = active.length;
    $('#dlEmpty').hidden = all.some(jobVisible);
    $('#dlSubtitle').textContent = all.length
      ? [active.length && `${active.length} em andamento`, done.length && `${done.length} concluído${done.length > 1 ? 's' : ''}`].filter(Boolean).join(' · ') || `${all.length} itens`
      : 'Nada por aqui ainda';
    updateIsland(active);
  }

  // ------------------------------------------------------------------ dynamic island
  let islandHold = null;
  function updateIsland(active) {
    const isl = $('#island');
    if (islandHold) return;
    if (!active.length) { isl.classList.remove('show', 'expanded'); return; }
    const j = active.find((x) => x.status !== 'queued') || active[0];
    isl.classList.add('show'); isl.classList.remove('success');
    $('#islandThumb').src = j.thumbnail || ''; $('#islandThumbBig').src = j.thumbnail || '';
    const pct = Math.floor(j.progress * 100);
    $('#islandLabel').textContent = j.status === 'processing' ? '•••' : `${pct}%`;
    $('#islandRing').style.strokeDashoffset = 56.55 * (1 - (j.status === 'processing' ? 1 : j.progress));
    $('#islandTitle').textContent = j.title;
    const more = active.length > 1 ? ` · +${active.length - 1} na fila` : '';
    const speed = j.speed ? ` · ${fmtBytes(j.speed)}/s` : '';
    $('#islandSub').textContent = (j.status === 'processing' ? j.stage + '…' : `${pct}%${speed}${j.eta != null ? ' · ' + fmtEta(j.eta) : ''}`) + more;
    $('#islandBar').style.width = (j.status === 'processing' ? 100 : pct) + '%';
    const btn = $('#islandAction');
    btn.innerHTML = icon('tray'); btn.dataset.act = 'goto'; btn.dataset.id = j.id;
  }
  function islandSuccess(j) {
    const isl = $('#island');
    clearTimeout(islandHold);
    isl.classList.add('show', 'expanded', 'success');
    $('#islandThumb').src = j.thumbnail || ''; $('#islandThumbBig').src = j.thumbnail || '';
    $('#islandTitle').textContent = j.title;
    $('#islandSub').textContent = `Concluído${j.total ? ' · ' + fmtBytes(j.total) : ''} — salvo em ${j.mode === 'audio' ? 'Áudios' : 'Vídeos'}`;
    $('#islandBar').style.width = '100%';
    $('#islandLabel').textContent = '✓';
    $('#islandRing').style.strokeDashoffset = 0;
    const btn = $('#islandAction');
    btn.innerHTML = icon('check'); btn.dataset.act = 'reveal'; btn.dataset.id = j.id;
    islandHold = setTimeout(() => {
      islandHold = null;
      isl.classList.remove('expanded', 'success');
      refreshListMeta();
    }, 4200);
  }

  // ------------------------------------------------------------------ eventos do Python
  function onEvent({ event, data }) {
    if (event === 'job') {
      const prev = S.jobs.get(data.id);
      S.jobs.set(data.id, data);
      renderJob(data);
      if (data.status === 'done' && prev && prev.status !== 'done') { chime(); islandSuccess(data); }
      if (data.status === 'error' && prev && prev.status !== 'error') toast(`Falha: ${data.title}`, 'warn', true);
      refreshListMeta();
    } else if (event === 'job_removed') {
      S.jobs.delete(data.id);
      document.getElementById('job-' + data.id)?.remove();
      refreshListMeta();
    } else if (event === 'ffmpeg_progress') {
      $('#ffProg').hidden = false;
      $('#ffProg i').style.width = (data.progress * 100).toFixed(1) + '%';
      $('#ffSub').textContent = `${data.label}… ${Math.floor(data.progress * 100)}%`;
    } else if (event === 'ffmpeg_done') {
      S.ffmpeg = data; renderFfmpeg(); toast('FFmpeg instalado — todos os recursos liberados');
    } else if (event === 'ffmpeg_error') {
      $('#ffInstall').disabled = false; $('#ffProg').hidden = true;
      $('#ffSub').textContent = 'Falha ao instalar: ' + data.error;
    }
  }
  window.MaxDL = { onEvent };

  // ------------------------------------------------------------------ ajustes
  function renderFfmpeg() {
    const f = S.ffmpeg || {};
    $('#ffDot').className = 'status-dot ' + (f.found ? 'ok' : 'bad');
    $('#ffSub').textContent = f.found ? `Instalado${f.version ? ' · ' + f.version.slice(0, 32) : ''}` : 'Necessário para juntar vídeo + áudio, converter e cortar. Sem ele, só formatos prontos.';
    $('#ffInstall').hidden = !!f.found;
    $('#ffInstall').disabled = false;
    $('#ffProg').hidden = true;
  }
  function renderSettings() {
    const c = S.cfg;
    $('#setPath').textContent = S.folders.base;
    $('#storagePath').textContent = S.folders.base;
    $('#ftRoot').textContent = S.folders.base.split(/[\\/]/).filter(Boolean).pop();
    $('#concVal').textContent = c.max_concurrent;
    $('#nameTpl').value = c.filename_template;
    if (document.activeElement !== $('#subLangs')) $('#subLangs').value = c.sub_langs;
    $('#cookieSrc').value = c.cookies_browser || '';
    $('#cookieFileRow').hidden = c.cookies_browser !== 'file';
    $('#cookieFilePath').textContent = c.cookies_file || 'Nenhum arquivo escolhido';
    $('#geoToggle').checked = !!c.geo_bypass;
    if (document.activeElement !== $('#proxyInput')) $('#proxyInput').value = c.proxy || '';
    const src = c.cookies_browser;
    const authOn = src && (src !== 'file' || c.cookies_file);
    $('#authDot').className = 'status-dot ' + (authOn ? 'ok' : '');
    $('#authSub').textContent = !src
      ? 'Libera vídeos com restrição de idade, de membros e privados que sua conta pode ver'
      : src === 'file'
        ? 'Usando o arquivo cookies.txt exportado do navegador'
        : ['chrome', 'edge', 'brave', 'opera', 'vivaldi'].includes(src)
          ? 'Feche o navegador antes de baixar — ele bloqueia os cookies enquanto está aberto'
          : 'Usando sua sessão do Firefox — faça login no site por lá';
    $('#clipToggle').checked = !!c.clipboard_watch;
    $('#soundToggle').checked = !!c.sound;
    applyLook();
  }

  // ------------------------------------------------------------------ área de transferência
  async function checkClipboard() {
    if (!S.cfg?.clipboard_watch) return;
    const t = await api.clipboard();
    if (!t || !looksLikeUrl(t) || t === S.lastClip || t === $('#urlInput').value.trim()) return;
    S.lastClip = t;
    $('#clipText').textContent = t;
    $('#clipSuggest').hidden = false;
  }

  // ------------------------------------------------------------------ ligações
  function bind() {
    $$('[data-win]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.win;
      if (a === 'close') api.close(); else if (a === 'minimize') api.minimize(); else api.toggle_maximize();
    }));
    $('.titlebar').addEventListener('dblclick', () => api.toggle_maximize());

    $$('.nav-item[data-view]').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
    $$('[data-goto]').forEach((b) => b.addEventListener('click', () => show(b.dataset.goto)));
    $$('[data-open]').forEach((b) => b.addEventListener('click', () => api.open_folder(b.dataset.open)));
    $('#storageCard').addEventListener('click', () => api.open_folder('base'));
    $$('[data-url]').forEach((b) => b.addEventListener('click', () => {
      if (api.open_url) api.open_url(b.dataset.url); else window.open(b.dataset.url, '_blank');
    }));

    // omnibox
    $('#omnibox').addEventListener('submit', (e) => { e.preventDefault(); analyze(); });
    const input = $('#urlInput');
    input.addEventListener('input', () => { $('#clearBtn').hidden = !input.value; });
    input.addEventListener('paste', () => setTimeout(() => { if (looksLikeUrl(input.value)) analyze(); }, 30));
    $('#clearBtn').addEventListener('click', () => { input.value = ''; $('#clearBtn').hidden = true; input.focus(); });
    $('#pasteBtn').addEventListener('click', async () => {
      const t = await api.clipboard();
      if (t) { input.value = t; analyze(t); } else toast('A área de transferência está vazia', 'clipboard');
    });
    $('#clipUse').addEventListener('click', () => { input.value = $('#clipText').textContent; analyze(); });

    // modo
    $$('#modeSeg button').forEach((b) => b.addEventListener('click', () => { S.mode = b.dataset.mode; renderOptions(); }));

    // vídeo
    $('#resTiles').addEventListener('click', (e) => { const t = e.target.closest('.tile'); if (!t) return; S.video.resolution = t.dataset.v === 'best' ? 'best' : +t.dataset.v; renderOptions(); });
    $('#fpsChips').addEventListener('click', (e) => { const t = e.target.closest('.chip'); if (!t) return; S.video.fps = t.dataset.v === 'best' ? 'best' : +t.dataset.v; renderOptions(); });
    $('#hdrToggle').addEventListener('change', (e) => { S.video.hdr = e.target.checked; renderOptions(); });
    $('#containerChips').addEventListener('click', (e) => { const t = e.target.closest('.chip'); if (!t) return; S.video.container = t.dataset.v; renderOptions(); });
    $('#codecChips').addEventListener('click', (e) => { const t = e.target.closest('.chip'); if (!t) return; S.video.codec = t.dataset.v; renderOptions(); });
    $('#vAudioChips').addEventListener('click', (e) => { const t = e.target.closest('.chip'); if (!t) return; S.video.audio_quality = t.dataset.v; renderOptions(); });

    // áudio
    $('#afmtTiles').addEventListener('click', (e) => { const t = e.target.closest('.tile'); if (!t) return; S.audio.format = t.dataset.v; renderOptions(); });
    $('#aqSteps').addEventListener('click', (e) => { const t = e.target.closest('.step'); if (!t) return; S.audio.quality = t.dataset.v; renderOptions(); });

    // extras
    $$('[data-extra]').forEach((el) => el.addEventListener('change', () => { S.extras[el.dataset.extra] = el.checked; renderOptions(); }));
    $('#trimToggle').addEventListener('change', (e) => {
      S.trim.on = e.target.checked;
      $('#trimBox').hidden = !S.trim.on;
      if (S.trim.on) trimRender();
      updateSummary();
    });
    trimDrag($('#trimA')); trimDrag($('#trimB'));
    const trimField = (el, key) => el.addEventListener('change', () => {
      const v = parseDur(el.value), d = S.info.duration;
      if (v != null) {
        if (key === 'start') S.trim.start = Math.max(0, Math.min(v, S.trim.end - 1));
        else S.trim.end = Math.min(d, Math.max(v, S.trim.start + 1));
      }
      el.blur(); trimRender(); updateSummary();
    });
    trimField($('#trimStart'), 'start'); trimField($('#trimEnd'), 'end');

    $('#downloadBtn').addEventListener('click', startDownload);

    // lista
    $('#dlList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const id = b.closest('.dl-item').id.slice(4);
      const j = S.jobs.get(id);
      ({
        cancel: () => api.cancel(id),
        retry: () => api.retry(id),
        remove: () => api.remove(id),
        open: () => api.open_file(j.filepath),
        reveal: () => api.reveal(j.filepath),
        access: () => goAccess(),
      })[b.dataset.act]?.();
    });
    $$('#dlFilter button').forEach((b) => b.addEventListener('click', () => {
      S.filter = b.dataset.filter; setSeg($('#dlFilter'), 'filter', S.filter);
      S.jobs.forEach(renderJob); refreshListMeta();
    }));
    $('#clearDone').addEventListener('click', () => api.clear_finished());

    // island
    const isl = $('#island');
    isl.addEventListener('mouseenter', () => isl.classList.add('expanded'));
    isl.addEventListener('mouseleave', () => { if (!islandHold) isl.classList.remove('expanded'); });
    $('#islandAction').addEventListener('click', (e) => {
      const b = e.currentTarget, j = S.jobs.get(b.dataset.id);
      if (b.dataset.act === 'reveal' && j?.filepath) api.reveal(j.filepath); else show('downloads');
    });

    // ajustes
    $$('#themeSeg button').forEach((b) => b.addEventListener('click', () => saveSettings({ theme: b.dataset.theme })));
    $('#accents').innerHTML = Object.entries(ACCENTS).map(([k, v]) => `<button class="accent-dot" data-accent="${k}" title="${k}" style="background:${v};color:${v}"></button>`).join('');
    $$('.accent-dot').forEach((d) => d.addEventListener('click', () => saveSettings({ accent: d.dataset.accent })));
    $$('.stepper button').forEach((b) => b.addEventListener('click', () => {
      const v = Math.min(5, Math.max(1, S.cfg.max_concurrent + +b.dataset.step));
      saveSettings({ max_concurrent: v });
    }));
    $('#nameTpl').addEventListener('change', (e) => saveSettings({ filename_template: e.target.value }));
    $('#subLangs').addEventListener('change', (e) => saveSettings({ sub_langs: e.target.value.replace(/\s+/g, '') }));
    $('#clipToggle').addEventListener('change', (e) => saveSettings({ clipboard_watch: e.target.checked }));
    $('#soundToggle').addEventListener('change', (e) => { saveSettings({ sound: e.target.checked }); if (e.target.checked) { S.cfg.sound = true; chime(); } });
    $('#changeFolder').addEventListener('click', async () => {
      const r = await api.choose_folder();
      if (r) { S.cfg = r.config; S.folders = r.folders; renderSettings(); toast('Pasta de destino atualizada', 'folder'); }
    });
    $('#cookieSrc').addEventListener('change', async (e) => {
      const v = e.target.value;
      if (v === 'file' && !S.cfg.cookies_file) {
        const r = await api.choose_cookies_file();
        if (r) { S.cfg = r.config; S.folders = r.folders; renderSettings(); }
        else renderSettings();
        return;
      }
      saveSettings({ cookies_browser: v });
      if (v) toast(v === 'file' ? 'Usando cookies.txt' : `Login do ${e.target.selectedOptions[0].text} conectado`, 'key');
    });
    $('#cookieFileBtn').addEventListener('click', async () => {
      const r = await api.choose_cookies_file();
      if (r) { S.cfg = r.config; S.folders = r.folders; renderSettings(); toast('Arquivo de cookies definido', 'key'); }
    });
    $('#geoToggle').addEventListener('change', (e) => saveSettings({ geo_bypass: e.target.checked }));
    $('#proxyInput').addEventListener('change', (e) => saveSettings({ proxy: e.target.value.trim() }));
    $('#errorFix').addEventListener('click', goAccess);
    $('#errorRetry').addEventListener('click', () => analyze());

    $('#ffInstall').addEventListener('click', () => {
      $('#ffInstall').disabled = true; $('#ffProg').hidden = false; $('#ffSub').textContent = 'Conectando…';
      api.install_ffmpeg();
    });

    // teclado
    document.addEventListener('keydown', (e) => {
      const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (e.ctrlKey && e.key === ',') { e.preventDefault(); show('settings'); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'v' && !typing) {
        e.preventDefault(); show('home');
        api.clipboard().then((t) => { if (t) { input.value = t; analyze(t); } });
      } else if (e.ctrlKey && e.key === 'Enter' && S.info) { e.preventDefault(); startDownload(); }
      else if (e.key === 'Escape' && typing) document.activeElement.blur();
    });

    window.addEventListener('focus', checkClipboard);
    window.addEventListener('resize', debounce(glideAll, 60));
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', glideAll);
  }

  // ------------------------------------------------------------------ inicialização
  function waitApi() {
    return new Promise((res) => {
      if (window.pywebview?.api?.get_state) return res(window.pywebview.api);
      window.addEventListener('pywebviewready', () => res(window.pywebview.api), { once: true });
      setTimeout(() => { if (!window.pywebview?.api?.get_state) res(window.MaxDLMock ? window.MaxDLMock() : null); }, 1500);
    });
  }

  async function init() {
    hydrateIcons();
    api = await waitApi();
    if (!api) { document.body.insertAdjacentHTML('beforeend', '<div class="toasts"><div class="toast bad">Abra pelo aplicativo (python main.py).</div></div>'); return; }
    const st = await api.get_state();
    S.cfg = st.config; S.folders = st.folders; S.ffmpeg = st.ffmpeg;
    S.video = { ...st.config.video }; S.audio = { ...st.config.audio }; S.extras = { ...st.config.extras };
    $('#ytdlpVer').textContent = `Versão ${st.ytdlp_version}`;
    $('#aboutVer').textContent = `Versão ${st.version}`;
    bind();
    renderSettings(); renderFfmpeg();
    st.jobs.sort((a, b) => a.created - b.created).forEach((j) => { S.jobs.set(j.id, j); renderJob(j); });
    refreshListMeta();
    glideAll();
    if (!S.ffmpeg.found) setTimeout(() => toast('Dica: instale o FFmpeg em Ajustes para liberar 4K, HDR e conversões', 'bolt'), 1200);
    setTimeout(checkClipboard, 400);
    $('#urlInput').focus();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
