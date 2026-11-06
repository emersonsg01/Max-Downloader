"""Localiza e (opcionalmente) instala o FFmpeg, necessário para mesclar e converter."""

from __future__ import annotations

import shutil
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path
from typing import Callable

from .config import local_data_dir

# Build oficial recomendado pelo projeto yt-dlp (inclui correções específicas).
FFMPEG_URL = (
    "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/"
    "ffmpeg-master-latest-win64-gpl.zip"
)

_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0


def bundled_dir() -> Path:
    return local_data_dir() / "ffmpeg"


def find_ffmpeg(custom: str = "") -> str | None:
    """Retorna a pasta que contém ffmpeg(.exe), ou None."""
    exe = "ffmpeg.exe" if sys.platform == "win32" else "ffmpeg"
    candidates = []
    if custom:
        p = Path(custom)
        candidates.append(p if p.is_dir() else p.parent)
    candidates.append(bundled_dir())
    if getattr(sys, "frozen", False):
        candidates.append(Path(sys.executable).parent / "ffmpeg")
    for c in candidates:
        if (c / exe).exists():
            return str(c)
    found = shutil.which("ffmpeg")
    return str(Path(found).parent) if found else None


def ffmpeg_version(folder: str | None) -> str | None:
    if not folder:
        return None
    exe = str(Path(folder) / ("ffmpeg.exe" if sys.platform == "win32" else "ffmpeg"))
    try:
        out = subprocess.run([exe, "-version"], capture_output=True, text=True,
                             timeout=10, creationflags=_NO_WINDOW).stdout
        first = out.splitlines()[0] if out else ""
        # "ffmpeg version N-xxxx-g... Copyright" -> pega o token da versão
        parts = first.split()
        return parts[2] if len(parts) > 2 else first
    except Exception:
        return None


def install_ffmpeg(progress: Callable[[float, str], None]) -> str:
    """Baixa o FFmpeg para %LOCALAPPDATA%\\MaxDownloader\\ffmpeg e retorna a pasta."""
    dest = bundled_dir()
    dest.mkdir(parents=True, exist_ok=True)
    zpath = local_data_dir() / "ffmpeg-download.zip"

    req = urllib.request.Request(FFMPEG_URL, headers={"User-Agent": "MaxDownloader"})
    with urllib.request.urlopen(req, timeout=60) as r, open(zpath, "wb") as fh:
        total = int(r.headers.get("Content-Length") or 0)
        done = 0
        while True:
            chunk = r.read(1 << 16)
            if not chunk:
                break
            fh.write(chunk)
            done += len(chunk)
            progress((done / total) if total else 0.0, "Baixando FFmpeg")

    progress(1.0, "Extraindo")
    wanted = {"ffmpeg.exe", "ffprobe.exe"}
    with zipfile.ZipFile(zpath) as z:
        for name in z.namelist():
            base = name.rsplit("/", 1)[-1]
            if base in wanted and "/bin/" in name:
                with z.open(name) as src, open(dest / base, "wb") as dst:
                    shutil.copyfileobj(src, dst)
    zpath.unlink(missing_ok=True)
    if not (dest / "ffmpeg.exe").exists():
        raise RuntimeError("O pacote baixado não contém o ffmpeg.exe")
    return str(dest)
