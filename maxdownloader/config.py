"""Configuração persistente do aplicativo (JSON em %APPDATA%\\MaxDownloader)."""

from __future__ import annotations

import json
import os
import threading
from copy import deepcopy
from pathlib import Path

VIDEO_SUBDIR = "Vídeos"
AUDIO_SUBDIR = "Áudios"


def app_data_dir() -> Path:
    base = os.environ.get("APPDATA") or str(Path.home())
    d = Path(base) / "MaxDownloader"
    d.mkdir(parents=True, exist_ok=True)
    return d


def local_data_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA") or str(Path.home())
    d = Path(base) / "MaxDownloader"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _default_download_dir() -> str:
    return str(Path.home() / "Downloads" / "Max Downloader")


DEFAULTS: dict = {
    "download_dir": _default_download_dir(),
    "theme": "auto",            # auto | light | dark
    "accent": "blue",
    "max_concurrent": 2,
    "filename_template": "title",   # title | title_uploader | uploader_title | date_title
    "clipboard_watch": True,
    "sound": True,
    "sub_langs": "pt,en",
    "ffmpeg_path": "",
    # Acesso a conteúdo restrito (idade, membros, privado com permissão, região)
    "cookies_browser": "",      # "" | firefox | chrome | edge | brave | opera | vivaldi | file
    "cookies_file": "",
    "proxy": "",
    "geo_bypass": True,
    # Últimas escolhas — o app lembra o que você usou por último.
    "last_mode": "video",
    "video": {
        "container": "mp4",
        "resolution": "best",
        "fps": "best",
        "hdr": False,
        "codec": "auto",
        "audio_quality": "best",
    },
    "audio": {
        "format": "mp3",
        "quality": "320",
    },
    "extras": {
        "thumbnail": True,
        "metadata": True,
        "subtitles": False,
        "sponsorblock": False,
    },
}


def _merge(base: dict, extra: dict) -> dict:
    out = deepcopy(base)
    for k, v in (extra or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


class Config:
    def __init__(self) -> None:
        self.path = app_data_dir() / "config.json"
        self._lock = threading.Lock()
        self.data = deepcopy(DEFAULTS)
        self.load()

    def load(self) -> None:
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            self.data = _merge(DEFAULTS, raw)
        except (OSError, ValueError):
            self.data = deepcopy(DEFAULTS)

    def save(self) -> None:
        with self._lock:
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8")
            os.replace(tmp, self.path)

    def update(self, patch: dict) -> dict:
        self.data = _merge(self.data, patch)
        self.save()
        return self.data

    def __getitem__(self, key):
        return self.data[key]

    # ---- pastas -------------------------------------------------------
    @property
    def download_dir(self) -> Path:
        return Path(self.data["download_dir"]).expanduser()

    def subdir(self, kind: str) -> Path:
        d = self.download_dir / (AUDIO_SUBDIR if kind == "audio" else VIDEO_SUBDIR)
        d.mkdir(parents=True, exist_ok=True)
        return d

    def ensure_dirs(self) -> None:
        self.subdir("video")
        self.subdir("audio")
