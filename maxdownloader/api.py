"""Ponte entre a interface (JavaScript) e o Python, exposta via pywebview."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

import webview
import yt_dlp

from . import __version__
from .config import AUDIO_SUBDIR, VIDEO_SUBDIR, Config
from .engine import Engine
from .ffmpeg import find_ffmpeg, ffmpeg_version, install_ffmpeg


def _read_clipboard() -> str:
    if sys.platform != "win32":
        return ""
    import ctypes
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    user32.GetClipboardData.restype = wintypes.HANDLE
    user32.GetClipboardData.argtypes = [wintypes.UINT]
    user32.OpenClipboard.argtypes = [wintypes.HWND]
    kernel32.GlobalLock.argtypes = [wintypes.HGLOBAL]
    kernel32.GlobalLock.restype = wintypes.LPVOID
    kernel32.GlobalUnlock.argtypes = [wintypes.HGLOBAL]
    if not user32.OpenClipboard(None):
        return ""
    try:
        handle = user32.GetClipboardData(13)  # CF_UNICODETEXT
        if not handle:
            return ""
        ptr = kernel32.GlobalLock(handle)
        if not ptr:
            return ""
        try:
            return ctypes.wstring_at(ptr)[:4000]
        finally:
            kernel32.GlobalUnlock(handle)
    finally:
        user32.CloseClipboard()


class Api:
    """Todos os métodos públicos ficam disponíveis em window.pywebview.api no JS."""

    def __init__(self) -> None:
        self._window: webview.Window | None = None
        self._maximized = False
        self._cfg = Config()
        self._engine = Engine(self._cfg, self._emit)
        self._engine.ffmpeg_dir = find_ffmpeg(self._cfg["ffmpeg_path"])
        try:
            self._cfg.ensure_dirs()
        except OSError:
            pass

    # ------------------------------------------------------------ eventos
    def _emit(self, event: str, payload: dict) -> None:
        if not self._window:
            return
        data = json.dumps({"event": event, "data": payload}, ensure_ascii=False, default=str)
        try:
            self._window.evaluate_js(f"window.MaxDL && window.MaxDL.onEvent({data})")
        except Exception:  # noqa: BLE001
            pass

    # ------------------------------------------------------------ estado
    def get_state(self) -> dict:
        return {
            "config": self._cfg.data,
            "version": __version__,
            "ytdlp_version": yt_dlp.version.__version__,
            "ffmpeg": self.ffmpeg_status(),
            "folders": self._folders(),
            "jobs": [self._engine.public(j) for j in self._engine.jobs.values()],
            "platform": sys.platform,
        }

    def _folders(self) -> dict:
        base = self._cfg.download_dir
        return {
            "base": str(base),
            "video": str(base / VIDEO_SUBDIR),
            "audio": str(base / AUDIO_SUBDIR),
        }

    def update_settings(self, patch: dict) -> dict:
        self._cfg.update(patch or {})
        if "download_dir" in (patch or {}):
            try:
                self._cfg.ensure_dirs()
            except OSError:
                pass
        if "max_concurrent" in (patch or {}):
            self._engine._pump()
        return {"config": self._cfg.data, "folders": self._folders()}

    def choose_folder(self) -> dict | None:
        if not self._window:
            return None
        dialog = getattr(getattr(webview, "FileDialog", None), "FOLDER", None)
        if dialog is None:
            dialog = webview.FOLDER_DIALOG
        result = self._window.create_file_dialog(dialog, directory=str(self._cfg.download_dir))
        if not result:
            return None
        path = result[0] if isinstance(result, (list, tuple)) else result
        return self.update_settings({"download_dir": path})

    # ------------------------------------------------------------ mídia
    def analyze(self, url: str) -> dict:
        try:
            return {"ok": True, "info": self._engine.analyze(url)}
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "error": str(e), "kind": getattr(e, "kind", "")}

    def choose_cookies_file(self) -> dict | None:
        if not self._window:
            return None
        dialog = getattr(getattr(webview, "FileDialog", None), "OPEN", None)
        if dialog is None:
            dialog = webview.OPEN_DIALOG
        result = self._window.create_file_dialog(
            dialog, file_types=("Cookies (*.txt)", "Todos os arquivos (*.*)"))
        if not result:
            return None
        path = result[0] if isinstance(result, (list, tuple)) else result
        return self.update_settings({"cookies_browser": "file", "cookies_file": path})

    def estimate(self, opts: dict) -> dict:
        try:
            return self._engine.estimate(opts)
        except Exception:  # noqa: BLE001
            return {}

    def download(self, opts: dict) -> dict:
        # Guarda as escolhas como padrão para a próxima vez.
        patch = {"last_mode": opts.get("mode", "video"), "extras": opts.get("extras", {})}
        if opts.get("mode") == "audio":
            patch["audio"] = opts.get("audio", {})
        else:
            patch["video"] = opts.get("video", {})
        self._cfg.update(patch)
        self._cfg.ensure_dirs()
        return self._engine.enqueue(opts)

    def cancel(self, job_id: str) -> None:
        self._engine.cancel(job_id)

    def retry(self, job_id: str) -> dict | None:
        return self._engine.retry(job_id)

    def remove(self, job_id: str) -> None:
        self._engine.remove(job_id)

    def clear_finished(self) -> None:
        self._engine.clear_finished()

    def clipboard(self) -> str:
        try:
            return _read_clipboard().strip()
        except Exception:  # noqa: BLE001
            return ""

    # ------------------------------------------------------------ arquivos
    def open_folder(self, kind: str = "base") -> None:
        folders = self._folders()
        path = Path(folders.get(kind, folders["base"]))
        path.mkdir(parents=True, exist_ok=True)
        os.startfile(str(path))  # type: ignore[attr-defined]

    def reveal(self, path: str) -> None:
        p = Path(path or "")
        if p.is_file():
            subprocess.Popen(["explorer", "/select,", str(p)])
        elif p.is_dir():
            os.startfile(str(p))  # type: ignore[attr-defined]

    def open_url(self, url: str) -> None:
        """Abre um link no navegador padrão (só https)."""
        if isinstance(url, str) and url.startswith("https://"):
            webbrowser.open(url)

    def open_file(self, path: str) -> None:
        if path and Path(path).exists():
            os.startfile(path)  # type: ignore[attr-defined]

    # ------------------------------------------------------------ ffmpeg
    def ffmpeg_status(self) -> dict:
        d = self._engine.ffmpeg_dir
        return {"found": bool(d), "path": d, "version": ffmpeg_version(d)}

    def install_ffmpeg(self) -> None:
        def work() -> None:
            try:
                def cb(p: float, label: str) -> None:
                    self._emit("ffmpeg_progress", {"progress": p, "label": label})
                folder = install_ffmpeg(cb)
                self._engine.ffmpeg_dir = folder
                self._emit("ffmpeg_done", self.ffmpeg_status())
            except Exception as e:  # noqa: BLE001
                self._emit("ffmpeg_error", {"error": str(e)})
        threading.Thread(target=work, daemon=True).start()

    # ------------------------------------------------------------ janela
    def minimize(self) -> None:
        if self._window:
            self._window.minimize()

    def toggle_maximize(self) -> None:
        if not self._window:
            return
        if self._maximized:
            self._window.restore()
        else:
            self._window.maximize()
        self._maximized = not self._maximized

    def close(self) -> None:
        if self._window:
            self._window.destroy()
