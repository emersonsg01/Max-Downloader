"""Max Downloader — ponto de entrada."""

from __future__ import annotations

import sys
from pathlib import Path

import webview

from maxdownloader import APP_NAME
from maxdownloader.api import Api


def resource(rel: str) -> str:
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    return str(base / rel)


def _round_corners(window: webview.Window) -> None:
    """No Windows 11, pede ao DWM cantos arredondados para a janela sem moldura."""
    if sys.platform != "win32":
        return
    try:
        import ctypes

        hwnd = window.native.Handle.ToInt64()
        pref = ctypes.c_int(2)  # DWMWCP_ROUND
        ctypes.windll.dwmapi.DwmSetWindowAttribute(
            ctypes.c_void_p(hwnd), 33, ctypes.byref(pref), ctypes.sizeof(pref))
    except Exception:  # noqa: BLE001
        pass


def main() -> None:
    api = Api()
    dark = api._cfg["theme"] == "dark"
    window = webview.create_window(
        APP_NAME,
        url=resource("ui/index.html"),
        js_api=api,
        width=1200,
        height=800,
        min_size=(960, 640),
        frameless=True,
        easy_drag=False,
        background_color="#1c1c1e" if dark else "#f5f5f7",
        text_select=False,
    )
    api._window = window
    window.events.shown += lambda: _round_corners(window)
    webview.start(debug="--debug" in sys.argv, http_server=True, private_mode=False)


if __name__ == "__main__":
    main()
