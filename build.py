"""Gera o executável (PyInstaller) e o instalador (Inno Setup).

    python build.py            # exe + instalador
    python build.py --no-installer
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

from maxdownloader import __version__

ROOT = Path(__file__).resolve().parent
SEP = ";" if os.name == "nt" else ":"


def run(cmd: list[str]) -> None:
    print(">", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, cwd=ROOT)


def find_iscc() -> str | None:
    candidates = [
        shutil.which("iscc"),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"),
        r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        r"C:\Program Files\Inno Setup 6\ISCC.exe",
    ]
    return next((c for c in candidates if c and Path(c).exists()), None)


def main() -> None:
    if not (ROOT / "assets" / "icon.ico").exists():
        run([sys.executable, "tools/make_icon.py"])

    run([
        sys.executable, "-m", "PyInstaller", "main.py",
        "--name", "Max Downloader",
        "--windowed", "--onedir", "--noconfirm", "--clean",
        "--icon", "assets/icon.ico",
        "--add-data", f"ui{SEP}ui",
        "--add-data", f"assets/icon.png{SEP}assets",
        "--collect-all", "yt_dlp_ejs",
        "--collect-data", "webview",
        "--hidden-import", "mutagen",
        # o pywebview usa o Edge WebView2 no Windows — os outros backends só incham o pacote
        *[arg for mod in ("tkinter", "PyQt5", "PyQt6", "PySide2", "PySide6", "qtpy", "gi",
                          "cefpython3", "matplotlib", "numpy", "IPython")
          for arg in ("--exclude-module", mod)],
    ])
    print(f"\nExecutável: {ROOT / 'dist' / 'Max Downloader' / 'Max Downloader.exe'}")

    if "--no-installer" in sys.argv:
        return
    iscc = find_iscc()
    if not iscc:
        print("\nInno Setup não encontrado — instale com: winget install JRSoftware.InnoSetup")
        sys.exit(1)
    run([iscc, f"/DAppVersion={__version__}", "installer/MaxDownloader.iss"])
    print(f"\nInstalador: {ROOT / 'dist' / 'installer' / f'MaxDownloader-Setup-{__version__}.exe'}")


if __name__ == "__main__":
    main()
