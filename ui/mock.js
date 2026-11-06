/* API simulada — usada só ao abrir a interface num navegador comum (pré-visualização de design). */
window.MaxDLMock = function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const cfg = {
    download_dir: 'C:\\Users\\voce\\Downloads\\Max Downloader', theme: 'auto', accent: 'blue', max_concurrent: 2,
    filename_template: 'title', clipboard_watch: false, cookies_browser: '', cookies_file: '', proxy: '', geo_bypass: true, sound: true, sub_langs: 'pt,en', last_mode: 'video',
    video: { container: 'mp4', resolution: 'best', fps: 'best', hdr: false, codec: 'auto', audio_quality: 'best' },
    audio: { format: 'mp3', quality: '320' }, extras: { thumbnail: true, metadata: true, subtitles: false, sponsorblock: false },
  };
  const folders = () => ({ base: cfg.download_dir, video: cfg.download_dir + '\\Vídeos', audio: cfg.download_dir + '\\Áudios' });
  const emit = (event, data) => window.MaxDL.onEvent({ event, data });
  return {
    get_state: async () => ({ config: cfg, version: '1.0.0', ytdlp_version: 'demo', ffmpeg: { found: true, version: 'demo' }, folders: folders(), jobs: [] }),
    update_settings: async (p) => { Object.assign(cfg, p); return { config: cfg, folders: folders() }; },
    analyze: async (url) => {
      await wait(1800);
      if (url.includes('restrito')) return { ok: false, error: 'Vídeo com restrição de idade — conecte sua conta para baixar.', kind: 'auth' };
      return { ok: true, info: {
        kind: 'video', url, title: 'Paisagens da Islândia em 4K HDR — auroras, geleiras e vulcões', uploader: 'Nature Films',
        thumbnail: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg', duration: 754, view_count: 12840000, like_count: 341000,
        upload_date: '20240512', extractor: 'Youtube', is_youtube: true, hdr_available: true, max_abr: 160, has_subtitles: true,
        subtitle_langs: ['pt', 'en', 'es'],
        resolutions: [
          { value: 2160, fps: [60, 30], hdr: true, hdr_fps: [60], codecs: ['vp9', 'av1'], size: 1480000000 },
          { value: 1440, fps: [60, 30], hdr: true, hdr_fps: [60], codecs: ['vp9', 'av1'], size: 690000000 },
          { value: 1080, fps: [60, 30], hdr: true, hdr_fps: [60], codecs: ['h264', 'vp9', 'av1'], size: 310000000 },
          { value: 720, fps: [60, 30], hdr: false, hdr_fps: [], codecs: ['h264', 'vp9', 'av1'], size: 140000000 },
          { value: 480, fps: [30], hdr: false, hdr_fps: [], codecs: ['h264', 'vp9'], size: 62000000 },
          { value: 360, fps: [30], hdr: false, hdr_fps: [], codecs: ['h264', 'vp9'], size: 38000000 },
        ],
      } };
    },
    estimate: async (o) => (o.mode === 'audio'
      ? { size: 18000000, audio: { codec: 'Opus', abr: 160 } }
      : { size: 1240000000, video: { res: 2160, fps: 60, codec: 'VP9', hdr: o.video.hdr ? 'HDR10' : 'SDR' }, audio: { codec: 'AAC', abr: 129 } }),
    download: async (o) => {
      const id = Math.random().toString(16).slice(2, 10);
      const job = { id, title: o.title, thumbnail: o.thumbnail, mode: o.mode, label: o.label, status: 'downloading', stage: 'Baixando vídeo', progress: 0, total: 1240000000, downloaded: 0, speed: 24000000, eta: 50, created: Date.now() / 1000 };
      emit('job', { ...job });
      const t = setInterval(() => {
        job.progress = Math.min(1, job.progress + 0.04); job.downloaded = job.total * job.progress; job.eta = Math.round((1 - job.progress) * 50);
        if (job.progress >= 1) { clearInterval(t); job.status = 'processing'; job.stage = 'Mesclando vídeo e áudio'; emit('job', { ...job });
          setTimeout(() => { job.status = 'done'; job.stage = 'Concluído'; job.filepath = 'C:\\demo.mp4'; emit('job', { ...job }); }, 1800); return; }
        emit('job', { ...job });
      }, 250);
      return job;
    },
    cancel: async () => {}, retry: async () => {}, remove: async (id) => emit('job_removed', { id }), clear_finished: async () => {},
    clipboard: async () => '', open_folder: async () => {}, reveal: async () => {}, open_file: async () => {},
    choose_folder: async () => null,
    choose_cookies_file: async () => { Object.assign(cfg, { cookies_browser: 'file', cookies_file: 'C:\\Users\\voce\\cookies.txt' }); return { config: cfg, folders: folders() }; }, install_ffmpeg: async () => {}, minimize: () => {}, toggle_maximize: () => {}, close: () => {},
  };
};
