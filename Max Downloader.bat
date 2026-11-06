@echo off
cd /d "%~dp0"
python -c "import yt_dlp, webview, mutagen" 2>nul || python -m pip install -r requirements.txt
start "" pythonw main.py
