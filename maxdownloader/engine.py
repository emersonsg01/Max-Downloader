"""Motor de download: análise de links, seleção de formatos e fila de downloads (yt-dlp)."""

from __future__ import annotations

import copy
import shutil
import threading
import time
import uuid
from pathlib import Path
from typing import Callable

import yt_dlp
from yt_dlp.utils import DownloadCancelled, download_range_func

from .config import Config

STANDARD_RES = [144, 240, 360, 480, 720, 1080, 1440, 2160, 4320]
RES_LABEL = {4320: "8K", 2160: "4K", 1440: "2K", 1080: "Full HD", 720: "HD"}

AUDIO_FORMATS = {  # formato da UI -> codec do yt-dlp
    "mp3": "mp3", "m4a": "m4a", "aac": "aac", "opus": "opus",
    "ogg": "vorbis", "flac": "flac", "wav": "wav", "original": "best",
}
LOSSLESS = {"flac", "wav"}
THUMB_OK_AUDIO = {"mp3", "m4a", "opus", "ogg", "flac", "original"}
THUMB_OK_VIDEO = {"mp4", "mkv", "mov"}

FILENAME_TEMPLATES = {
    "title": "%(title).180B",
    "title_uploader": "%(title).150B - %(uploader).40B",
    "uploader_title": "%(uploader).40B - %(title).150B",
    "date_title": "%(upload_date>%Y-%m-%d)s - %(title).170B",
}

SPONSOR_CATEGORIES = ["sponsor", "selfpromo", "interaction", "intro", "outro", "music_offtopic"]

PP_LABELS = {
    "Merger": "Mesclando vídeo e áudio",
    "ExtractAudio": "Convertendo áudio",
    "VideoRemuxer": "Ajustando formato",
    "EmbedThumbnail": "Incorporando capa",
    "Metadata": "Gravando metadados",
    "EmbedSubtitle": "Incorporando legendas",
    "SponsorBlock": "Consultando SponsorBlock",
    "ModifyChapters": "Removendo patrocínios",
    "MoveFiles": "Finalizando",
    "FixupM3u8": "Corrigindo arquivo",
    "FixupM4a": "Corrigindo arquivo",
    "FixupDuration": "Corrigindo arquivo",
    "FixupTimestamp": "Corrigindo arquivo",
}


class _Logger:
    """Silencia o yt-dlp mas guarda o último erro/aviso para mostrar ao usuário."""

    def __init__(self) -> None:
        self.last_error = ""
        self.warnings: list[str] = []

    def debug(self, msg: str) -> None:
        pass

    def info(self, msg: str) -> None:
        pass

    def warning(self, msg: str) -> None:
        self.warnings.append(msg)

    def error(self, msg: str) -> None:
        self.last_error = msg


class FriendlyError(RuntimeError):
    """Erro com mensagem amigável e um tipo que a interface usa para sugerir a solução."""

    def __init__(self, text: str, kind: str = "") -> None:
        super().__init__(text)
        self.kind = kind  # "" | auth | geo | cookies | drm


def _classify(msg) -> tuple[str, str]:
    msg = str(msg or "").replace("ERROR: ", "").strip()
    if "] " in msg and msg.startswith("["):
        msg = msg.split("] ", 1)[-1]
    low = msg.lower()
    if "drm" in low:
        return "Este conteúdo é protegido por DRM e não pode ser baixado.", "drm"
    if any(k in low for k in ("could not copy", "failed to decrypt", "dpapi", "cookie database",
                              "app-bound", "could not find", "browser cookies")) and "cookie" in low:
        return ("Não foi possível ler os cookies do navegador. Feche o navegador e tente de novo, "
                "ou use Firefox / um arquivo cookies.txt."), "cookies"
    if "unsupported url" in low:
        return "Este link não é suportado.", ""
    if "sign in to confirm your age" in low or "age-restricted" in low or "age restricted" in low \
            or "inappropriate for some users" in low:
        return "Vídeo com restrição de idade — conecte sua conta para baixar.", "auth"
    if "members-only" in low or "join this channel" in low or "members only" in low:
        return "Conteúdo exclusivo para membros — conecte a conta que tem acesso.", "auth"
    if "private video" in low or "is private" in low:
        return "Vídeo privado — só funciona com a conta que tem permissão.", "auth"
    if "sign in to confirm you" in low and "bot" in low:
        return "O site pediu verificação de login — conecte sua conta.", "auth"
    if any(k in low for k in ("login required", "log in", "login to", "sign in", "requires authentication",
                              "cookies", "authentication", "account", "registered users")):
        return "Este conteúdo exige login — conecte sua conta para baixar.", "auth"
    if any(k in low for k in ("not available in your country", "geo restrict", "geo-restrict",
                              "your country", "your location", "region")):
        return "Bloqueado na sua região — ative o contorno regional ou use um proxy.", "geo"
    if "video unavailable" in low:
        return "Vídeo indisponível.", ""
    if "http error 403" in low or "forbidden" in low:
        return "Acesso negado pelo site (403). Tente conectar sua conta ou usar um proxy.", "auth"
    if "unable to download webpage" in low or "getaddrinfo" in low or "proxy" in low:
        return "Sem conexão com o site. Verifique sua internet ou o proxy.", ""
    if "ffmpeg" in low and ("not found" in low or "not installed" in low):
        return "FFmpeg não encontrado. Instale-o em Ajustes › Componentes.", ""
    return (msg[:300] or "Erro desconhecido."), ""


def _clean_error(msg) -> str:
    return _classify(msg)[0]


def _norm_res(f: dict) -> int | None:
    w, h = f.get("width"), f.get("height")
    r = min(w, h) if (w and h) else h
    if not r:
        return None
    for s in STANDARD_RES:
        if abs(r - s) <= s * 0.08:
            return s
    return int(r)


def _size(f: dict) -> int:
    return int(f.get("filesize") or f.get("filesize_approx") or 0)


class Engine:
    def __init__(self, config: Config, emit: Callable[[str, dict], None]) -> None:
        self.cfg = config
        self.emit = emit
        self.ffmpeg_dir: str | None = None
        self._cache: dict[str, tuple[float, dict]] = {}
        self.jobs: dict[str, dict] = {}
        self._cancel: set[str] = set()
        self._lock = threading.Lock()
        self._active = 0
        self._queue: list[str] = []

    # ------------------------------------------------------------------ base
    def base_opts(self, logger: _Logger | None = None) -> dict:
        opts: dict = {
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
            "windowsfilenames": True,
            "noplaylist": True,
            "logger": logger or _Logger(),
            "socket_timeout": 30,
        }
        if self.ffmpeg_dir:
            opts["ffmpeg_location"] = self.ffmpeg_dir
        runtimes = {}
        if shutil.which("deno"):
            runtimes["deno"] = {}
        if shutil.which("node"):
            runtimes["node"] = {}
        if runtimes:
            opts["js_runtimes"] = runtimes

        # Acesso a conteúdo restrito: usa o login que VOCÊ já tem no navegador.
        browser = (self.cfg["cookies_browser"] or "").strip().lower()
        if browser == "file":
            cf = self.cfg["cookies_file"]
            if cf and Path(cf).is_file():
                opts["cookiefile"] = cf
        elif browser:
            opts["cookiesfrombrowser"] = (browser, None, None, None)
        proxy = (self.cfg["proxy"] or "").strip()
        if proxy:
            opts["proxy"] = proxy
        opts["geo_bypass"] = bool(self.cfg["geo_bypass"])
        return opts

    # -------------------------------------------------------------- análise
    def analyze(self, url: str) -> dict:
        url = url.strip()
        log = _Logger()
        opts = self.base_opts(log) | {"skip_download": True, "extract_flat": "in_playlist"}
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
                info = ydl.sanitize_info(info)
        except Exception as e:  # noqa: BLE001
            raise FriendlyError(*_classify(log.last_error or e)) from None

        if info.get("_type") == "playlist" or info.get("entries") is not None:
            return self._playlist_summary(url, info)

        self._cache[url] = (time.time(), info)
        return self._video_summary(url, info)

    def _playlist_summary(self, url: str, info: dict) -> dict:
        entries = [e for e in (info.get("entries") or []) if e]
        items = []
        for e in entries[:200]:
            thumbs = e.get("thumbnails") or []
            items.append({
                "title": e.get("title") or "Sem título",
                "duration": e.get("duration"),
                "thumbnail": e.get("thumbnail") or (thumbs[-1]["url"] if thumbs else None),
            })
        thumb = info.get("thumbnail") or next((i["thumbnail"] for i in items if i["thumbnail"]), None)
        return {
            "kind": "playlist",
            "url": url,
            "title": info.get("title") or "Playlist",
            "uploader": info.get("uploader") or info.get("channel") or "",
            "thumbnail": thumb,
            "count": info.get("playlist_count") or len(entries),
            "entries": items,
            "extractor": info.get("extractor_key") or "",
            "is_youtube": "youtube" in (info.get("extractor_key") or "").lower(),
            "resolutions": [
                {"value": r, "label": RES_LABEL.get(r, f"{r}p"), "sub": f"{r}p",
                 "fps": [60, 30], "hdr": True, "hdr_fps": [60, 30], "size": 0}
                for r in [2160, 1440, 1080, 720, 480, 360]
            ],
            "has_subtitles": True,
            "hdr_available": True,
        }

    def _video_summary(self, url: str, info: dict) -> dict:
        formats = info.get("formats") or []
        res_map: dict[int, dict] = {}
        for f in formats:
            if f.get("vcodec") == "none":
                continue
            r = _norm_res(f)
            if not r:
                continue
            entry = res_map.setdefault(r, {"fps": set(), "hdr_fps": set(), "size": 0, "codecs": set()})
            fps = round(f.get("fps") or 30)
            entry["fps"].add(fps)
            if (f.get("dynamic_range") or "SDR") != "SDR":
                entry["hdr_fps"].add(fps)
            entry["size"] = max(entry["size"], _size(f))
            vc = (f.get("vcodec") or "").lower()
            for key, name in (("avc", "h264"), ("vp9", "vp9"), ("vp09", "vp9"), ("av01", "av1")):
                if vc.startswith(key):
                    entry["codecs"].add(name)

        resolutions = []
        for r in sorted(res_map, reverse=True):
            e = res_map[r]
            resolutions.append({
                "value": r,
                "label": RES_LABEL.get(r, f"{r}p"),
                "sub": f"{r}p",
                "fps": sorted(e["fps"], reverse=True),
                "hdr": bool(e["hdr_fps"]),
                "hdr_fps": sorted(e["hdr_fps"], reverse=True),
                "codecs": sorted(e["codecs"]),
                "size": e["size"],
            })

        audio = [f for f in formats if f.get("vcodec") == "none" and f.get("acodec") not in (None, "none")]
        max_abr = max((f.get("abr") or 0 for f in audio), default=0)
        subs = sorted(set((info.get("subtitles") or {}).keys()) - {"live_chat"})

        return {
            "kind": "video",
            "url": url,
            "id": info.get("id"),
            "title": info.get("title") or "Sem título",
            "uploader": info.get("uploader") or info.get("channel") or info.get("creator") or "",
            "thumbnail": info.get("thumbnail"),
            "duration": info.get("duration"),
            "view_count": info.get("view_count"),
            "like_count": info.get("like_count"),
            "upload_date": info.get("upload_date"),
            "extractor": info.get("extractor_key") or "",
            "is_youtube": "youtube" in (info.get("extractor_key") or "").lower(),
            "is_live": bool(info.get("is_live")),
            "resolutions": resolutions,
            "hdr_available": any(r["hdr"] for r in resolutions),
            "max_abr": round(max_abr),
            "has_audio": bool(audio) or any(f.get("acodec") not in (None, "none") for f in formats),
            "has_subtitles": bool(subs),
            "subtitle_langs": subs[:40],
            "has_chapters": bool(info.get("chapters")),
        }

    # ------------------------------------------------------ opções yt-dlp
    # Estratégias do modo áudio, em ordem. O áudio é baixado "em forma de vídeo"
    # (um vídeo leve + a melhor faixa de áudio) e depois extraído pelo FFmpeg —
    # mais confiável do que pedir só a faixa de áudio, que alguns sites recusam.
    AUDIO_STRATEGIES = [
        "bv*[height<=480]+ba/bv*+ba/b",   # vídeo leve + melhor áudio, mesclados
        "b",                               # vídeo completo de arquivo único
        "ba/b",                            # último recurso: só a faixa de áudio
    ]

    def _format_spec(self, o: dict, attempt: int = 0) -> tuple[str, list[str]]:
        if o["mode"] == "audio":
            if not self.ffmpeg_dir:
                return "ba/b", ["abr"]  # sem FFmpeg não há como extrair de um vídeo
            fmt = o["audio"]["format"]
            pref = []
            if fmt in ("m4a", "aac"):
                pref = ["acodec:aac"]
            elif fmt in ("opus", "ogg"):
                pref = ["acodec:opus"]
            spec = self.AUDIO_STRATEGIES[min(attempt, len(self.AUDIO_STRATEGIES) - 1)]
            # áudio primeiro na ordenação; vídeo o menor possível
            return spec, [*pref, "abr", "+res", "+size"]

        v = o["video"]
        container = v["container"]
        res, fps, hdr, codec = v["resolution"], v["fps"], bool(v["hdr"]), v["codec"]

        vf = "[dynamic_range!=SDR]" if hdr else "[dynamic_range=SDR]"
        af = ""
        if container in ("mp4", "mov"):
            af = "[acodec^=mp4a]"
        elif container == "webm":
            af = "[acodec=opus]"
            vf += "[vcodec!^=avc]"
        if container == "mov" or (codec == "h264" and not hdr):
            vf += "[vcodec^=avc]"
        elif codec == "vp9":
            vf += "[vcodec~='^(vp0?9)']"
        elif codec == "av1":
            vf += "[vcodec^=av01]"

        aq = v.get("audio_quality", "best")
        if aq == "medium":
            af += "[abr<=130]"
        elif aq == "low":
            af += "[abr<=70]"

        sort: list[str] = []
        if res != "best":
            sort.append(f"res:{int(res)}")
        if fps != "best":
            sort.append(f"fps:{int(fps)}")
        if codec == "h264" and not hdr:
            sort.append("vcodec:h264")

        # Do mais exato ao mais tolerante — sempre baixa algo coerente.
        chain = [
            f"bv*{vf}+ba{af}",
            f"bv*{vf}+ba",
            f"b{vf}",
            "bv*[dynamic_range!=SDR]+ba" if hdr else "bv*[dynamic_range=SDR]+ba",
            "bv*+ba",
            "b",
        ]
        return "/".join(chain), sort

    def build_opts(self, o: dict, job: dict | None = None, logger: _Logger | None = None,
                   attempt: int = 0) -> dict:
        kind = o["mode"]
        extras = o.get("extras", {})
        opts = self.base_opts(logger)
        fmt, sort = self._format_spec(o, attempt)
        out_dir = self.cfg.subdir("audio" if kind == "audio" else "video")
        tmpl = FILENAME_TEMPLATES.get(self.cfg["filename_template"], FILENAME_TEMPLATES["title"])
        if o.get("playlist"):
            tmpl = "%(playlist_title).80B/%(playlist_index)03d - " + tmpl

        opts.update({
            "format": fmt,
            "format_sort": sort,
            "paths": {"home": str(out_dir)},
            "outtmpl": {"default": tmpl + ".%(ext)s"},
            "noplaylist": not o.get("playlist"),
            "ignoreerrors": "only_download" if o.get("playlist") else False,
            "retries": 10,
            "fragment_retries": 10,
            "concurrent_fragment_downloads": 4,
            "overwrites": False,
            "continuedl": True,
        })
        if job:
            tmp = self.cfg.download_dir / ".temp" / job["id"]
            opts["paths"]["temp"] = str(tmp)

        pps: list[dict] = []
        is_yt = o.get("is_youtube", False)

        if extras.get("sponsorblock") and is_yt:
            pps.append({"key": "SponsorBlock", "categories": SPONSOR_CATEGORIES, "when": "after_filter"})

        if kind == "audio":
            afmt = o["audio"]["format"]
            q = str(o["audio"].get("quality", "320"))
            # o vídeo intermediário é mesclado em MKV (aceita qualquer codec) e apagado após a extração
            opts["merge_output_format"] = "mkv"
            pps.append({
                "key": "FFmpegExtractAudio",
                "preferredcodec": AUDIO_FORMATS.get(afmt, "mp3"),
                "preferredquality": None if (afmt in LOSSLESS or afmt == "original" or q == "best") else q,
                "nopostoverwrites": False,
            })
            thumb_ok = afmt in THUMB_OK_AUDIO
        else:
            container = o["video"]["container"]
            opts["merge_output_format"] = container
            pps.append({"key": "FFmpegVideoRemuxer", "preferedformat": container})
            thumb_ok = container in THUMB_OK_VIDEO
            if extras.get("subtitles"):
                langs = [s.strip() for s in self.cfg["sub_langs"].split(",") if s.strip()] or ["pt", "en"]
                opts.update({"writesubtitles": True, "subtitleslangs": langs})
                pps.append({"key": "FFmpegEmbedSubtitle", "already_have_subtitle": False})

        if extras.get("sponsorblock") and is_yt:
            pps.append({
                "key": "ModifyChapters",
                "remove_sponsor_segments": SPONSOR_CATEGORIES,
                "remove_chapters_patterns": [],
                "remove_ranges": [],
                "sponsorblock_chapter_title": "[SponsorBlock]: %(category_names)l",
                "force_keyframes": False,
            })
        if extras.get("metadata", True):
            pps.append({"key": "FFmpegMetadata", "add_metadata": True, "add_chapters": True})
        if extras.get("thumbnail", True) and thumb_ok:
            opts["writethumbnail"] = True
            pps.append({"key": "EmbedThumbnail", "already_have_thumbnail": False})

        trim = o.get("trim")
        if trim and (trim.get("start") or trim.get("end")):
            start = float(trim.get("start") or 0)
            end = float(trim["end"]) if trim.get("end") else float("inf")
            opts["download_ranges"] = download_range_func(None, [(start, end)])
            opts["force_keyframes_at_cuts"] = True

        if not self.ffmpeg_dir:
            # Sem FFmpeg: só formatos que já vêm completos, sem conversões.
            opts["format"] = "b" if kind == "video" else "ba/b"
            pps = []
            opts.pop("writethumbnail", None)
            opts.pop("merge_output_format", None)
            opts.pop("download_ranges", None)

        opts["postprocessors"] = pps
        return opts

    # ------------------------------------------------------------ estimativa
    def estimate(self, o: dict) -> dict:
        cached = self._cache.get(o.get("url", ""))
        if not cached:
            return {}
        info = copy.deepcopy(cached[1])
        opts = self.build_opts(o)
        opts.update({"simulate": True, "postprocessors": [], "check_formats": False})
        opts.pop("download_ranges", None)
        # A estimativa usa a análise em cache: não precisa reler cookies do navegador.
        opts.pop("cookiesfrombrowser", None)
        opts.pop("cookiefile", None)
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                res = ydl.process_ie_result(info, download=False)
        except Exception:  # noqa: BLE001
            return {}
        fmts = res.get("requested_formats") or [res]
        size = sum(_size(f) for f in fmts)
        trim = o.get("trim") or {}
        dur = res.get("duration") or 0
        if o["mode"] == "audio" and dur:
            # tamanho do arquivo de áudio final (o vídeo intermediário é descartado)
            afmt, q = o["audio"]["format"], str(o["audio"].get("quality", "320"))
            src_abr = next((f.get("abr") for f in fmts if f.get("acodec") not in (None, "none")), None) or 128
            kbps = {"wav": 1411, "flac": 900}.get(afmt) or (src_abr if afmt == "original" or not q.isdigit() else int(q))
            size = int(kbps * 1000 / 8 * dur)
        if dur and (trim.get("start") or trim.get("end")):
            s = float(trim.get("start") or 0)
            e = float(trim.get("end") or dur)
            size = int(size * max(0.0, min(e, dur) - s) / dur)
        vf = next((f for f in fmts if f.get("vcodec") not in (None, "none")), None)
        af = next((f for f in fmts if f.get("acodec") not in (None, "none")), None)

        def codec_name(c: str | None) -> str:
            c = (c or "").lower()
            for k, n in (("avc", "H.264"), ("vp09", "VP9"), ("vp9", "VP9"), ("av01", "AV1"),
                         ("hev", "HEVC"), ("hvc", "HEVC"), ("mp4a", "AAC"), ("opus", "Opus"),
                         ("vorbis", "Vorbis"), ("mp3", "MP3"), ("flac", "FLAC")):
                if c.startswith(k):
                    return n
            return c.split(".")[0].upper() if c else ""

        return {
            "size": size,
            "video": {
                "res": _norm_res(vf), "fps": round(vf.get("fps") or 0) or None,
                "codec": codec_name(vf.get("vcodec")), "hdr": vf.get("dynamic_range"),
            } if vf and o["mode"] == "video" else None,
            "audio": {
                "codec": codec_name(af.get("acodec")), "abr": round(af.get("abr") or 0) or None,
            } if af else None,
        }

    # ------------------------------------------------------------ fila
    def enqueue(self, o: dict) -> dict:
        job = {
            "id": uuid.uuid4().hex[:10],
            "url": o["url"],
            "title": o.get("title") or o["url"],
            "thumbnail": o.get("thumbnail"),
            "mode": o["mode"],
            "label": o.get("label", ""),
            "status": "queued",
            "stage": "Na fila",
            "progress": 0.0,
            "speed": None,
            "eta": None,
            "downloaded": 0,
            "total": 0,
            "filepath": None,
            "error": None,
            "error_kind": None,
            "created": time.time(),
            "playlist_index": None,
            "playlist_count": o.get("count"),
            "_opts": o,
        }
        with self._lock:
            self.jobs[job["id"]] = job
            self._queue.append(job["id"])
        self._emit_job(job)
        self._pump()
        return self.public(job)

    def public(self, job: dict) -> dict:
        return {k: v for k, v in job.items() if not k.startswith("_")}

    def _emit_job(self, job: dict) -> None:
        self.emit("job", self.public(job))

    def _pump(self) -> None:
        with self._lock:
            limit = max(1, int(self.cfg["max_concurrent"]))
            while self._queue and self._active < limit:
                jid = self._queue.pop(0)
                job = self.jobs.get(jid)
                if not job or job["status"] != "queued":
                    continue
                self._active += 1
                threading.Thread(target=self._run, args=(job,), daemon=True).start()

    def cancel(self, jid: str) -> None:
        job = self.jobs.get(jid)
        if not job:
            return
        if job["status"] == "queued":
            job["status"], job["stage"] = "canceled", "Cancelado"
            self._emit_job(job)
        elif job["status"] in ("downloading", "processing"):
            self._cancel.add(jid)
            job["stage"] = "Cancelando…"
            self._emit_job(job)

    def retry(self, jid: str) -> dict | None:
        job = self.jobs.pop(jid, None)
        if not job:
            return None
        self.emit("job_removed", {"id": jid})
        return self.enqueue(job["_opts"])

    def remove(self, jid: str) -> None:
        job = self.jobs.get(jid)
        if job and job["status"] in ("done", "error", "canceled"):
            self.jobs.pop(jid, None)
            self.emit("job_removed", {"id": jid})

    def clear_finished(self) -> None:
        for jid in [j for j, job in self.jobs.items() if job["status"] in ("done", "error", "canceled")]:
            self.remove(jid)

    # ------------------------------------------------------------ execução
    def _run(self, job: dict) -> None:
        o = job["_opts"]
        log = _Logger()
        state = {"done_ids": {}, "last_emit": 0.0}
        job["status"], job["stage"] = "downloading", "Preparando"
        self._emit_job(job)

        def throttle(force: bool = False) -> None:
            now = time.time()
            if force or now - state["last_emit"] > 0.2:
                state["last_emit"] = now
                self._emit_job(job)

        def progress_hook(d: dict) -> None:
            if job["id"] in self._cancel:
                raise DownloadCancelled("cancelado")
            info = d.get("info_dict") or {}
            if info.get("playlist_index"):
                job["playlist_index"] = info.get("playlist_index")
                job["playlist_count"] = info.get("n_entries") or job.get("playlist_count")
            fid = info.get("format_id") or d.get("filename")
            if d["status"] == "downloading":
                job["status"] = "downloading"
                req = info.get("requested_formats")
                cur = d.get("downloaded_bytes") or 0
                cur_total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                if req and len(req) > 1:
                    totals = {f.get("format_id"): _size(f) for f in req}
                    if cur_total:
                        totals[fid] = cur_total
                    done_sum = sum(totals.get(k, v) for k, v in state["done_ids"].items() if k != fid)
                    grand = sum(totals.values()) or 1
                    p = (done_sum + cur) / grand
                    idx = [f.get("format_id") for f in req].index(fid) if fid in totals else 0
                    kind = "vídeo" if (req[idx].get("vcodec") not in (None, "none")) else "áudio"
                    job["stage"] = f"Baixando {kind}"
                    job["total"] = grand
                    job["downloaded"] = done_sum + cur
                else:
                    p = cur / cur_total if cur_total else 0
                    job["stage"] = "Baixando"
                    job["total"] = cur_total
                    job["downloaded"] = cur
                if job.get("playlist_index") and job.get("playlist_count"):
                    n = job["playlist_count"]
                    p = ((job["playlist_index"] - 1) + min(p, 1)) / n
                job["progress"] = max(0.0, min(p, 0.999))
                job["speed"] = d.get("speed")
                job["eta"] = d.get("eta")
                throttle()
            elif d["status"] == "finished":
                state["done_ids"][fid] = d.get("total_bytes") or d.get("downloaded_bytes") or 0
                throttle(True)

        def pp_hook(d: dict) -> None:
            if job["id"] in self._cancel:
                raise DownloadCancelled("cancelado")
            if d["status"] == "started":
                name = d.get("postprocessor") or ""
                label = PP_LABELS.get(name)
                if label:
                    job["status"], job["stage"] = "processing", label
                    job["speed"] = job["eta"] = None
                    throttle(True)

        def post_hook(path: str) -> None:
            job["filepath"] = path

        is_audio = o["mode"] == "audio"
        attempts = len(self.AUDIO_STRATEGIES) if (is_audio and self.ffmpeg_dir) else 2
        tmpdir = self.cfg.download_dir / ".temp" / job["id"]
        try:
            for attempt in range(attempts):
                opts = self.build_opts(o, job, log, attempt)
                opts["progress_hooks"] = [progress_hook]
                opts["postprocessor_hooks"] = [pp_hook]
                opts["post_hooks"] = [post_hook]
                try:
                    # Sempre extrai de novo: links de mídia antigos (da análise) podem dar 403.
                    with yt_dlp.YoutubeDL(opts) as ydl:
                        ydl.download([o["url"]])
                    if job["id"] in self._cancel:
                        raise DownloadCancelled("cancelado")
                    if log.last_error and not job["filepath"]:
                        raise RuntimeError(log.last_error)
                    break
                except DownloadCancelled:
                    raise
                except Exception:  # noqa: BLE001
                    if job["id"] in self._cancel or attempt == attempts - 1 or o.get("playlist"):
                        raise
                    kind = _classify(log.last_error)[1]
                    if kind in ("drm", "cookies"):
                        raise
                    # tenta de novo com outra estratégia, do zero
                    log.last_error = ""
                    state["done_ids"].clear()
                    job.update(status="downloading", stage="Tentando outro método…", progress=0.0,
                               downloaded=0, total=0, speed=None, eta=None, filepath=None)
                    self._emit_job(job)
                    shutil.rmtree(tmpdir, ignore_errors=True)
            job["status"], job["stage"], job["progress"] = "done", "Concluído", 1.0
            if job["filepath"]:
                try:
                    job["total"] = Path(job["filepath"]).stat().st_size
                except OSError:
                    pass
            if o.get("playlist"):
                job["filepath"] = str(self.cfg.subdir("audio" if o["mode"] == "audio" else "video"))
        except DownloadCancelled:
            job["status"], job["stage"] = "canceled", "Cancelado"
        except Exception as e:  # noqa: BLE001
            if job["id"] in self._cancel:
                job["status"], job["stage"] = "canceled", "Cancelado"
            else:
                job["status"], job["stage"] = "error", "Falhou"
                job["error"], job["error_kind"] = _classify(log.last_error or e)
        finally:
            self._cancel.discard(job["id"])
            job["speed"] = job["eta"] = None
            if tmpdir and tmpdir.name == job["id"]:
                shutil.rmtree(tmpdir, ignore_errors=True)
                try:
                    tmpdir.parent.rmdir()  # remove ".temp" se ficou vazia
                except OSError:
                    pass
            with self._lock:
                self._active -= 1
            self._emit_job(job)
            self._pump()
