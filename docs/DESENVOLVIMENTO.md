# Desenvolvimento

## Estrutura

```
main.py                    Ponto de entrada: cria a janela (pywebview, sem moldura)
maxdownloader/
  api.py                   Ponte JS ⇄ Python (window.pywebview.api)
  engine.py                Análise de links, seleção de formatos, fila e downloads (yt-dlp)
  config.py                Configurações em %APPDATA%\MaxDownloader\config.json
  ffmpeg.py                Localiza e instala o FFmpeg
ui/
  index.html · styles.css  Interface
  app.js                   Lógica da interface
  icons.js                 Ícones em traço (estilo SF Symbols)
  mock.js                  API simulada para pré-visualizar a interface no navegador
assets/                    Ícone do app (gerado por tools/make_icon.py)
installer/MaxDownloader.iss  Script do instalador (Inno Setup)
build.py                   Gera o .exe e o instalador
```

## Rodar

```bash
pip install -r requirements.txt
python main.py            # app
python main.py --debug    # com DevTools do WebView2
```

Para só ajustar o visual, sirva a pasta `ui/` (`python -m http.server 8765 --directory ui`) e abra no navegador: sem o pywebview, a interface usa a API simulada de `mock.js`.

## Como funciona

- **Análise:** `Engine.analyze` extrai as informações do link e resume as resoluções, fps, HDR e codecs disponíveis.
- **Formatos:** `Engine._format_spec` monta o seletor do yt-dlp a partir das escolhas, com uma cadeia de alternativas para sempre baixar algo coerente.
- **Modo áudio:** baixa em forma de vídeo (vídeo leve + melhor áudio, mesclados em MKV), extrai o áudio com `FFmpegExtractAudio` e descarta o vídeo. Se falhar, tenta `AUDIO_STRATEGIES` seguintes.
- **Downloads:** cada item roda numa thread; o limite de simultâneos vem dos Ajustes. Cada download usa uma pasta temporária própria em `<destino>/.temp/<id>`.
- **Eventos:** o Python avisa a interface via `window.MaxDL.onEvent(...)` (progresso, conclusão, erros).
- **Erros:** `_classify` traduz as mensagens do yt-dlp e as marca como `auth`, `geo`, `cookies` ou `drm`, para a interface sugerir a solução.

## Gerar executável e instalador

Pré-requisitos: dependências do `requirements.txt`, PyInstaller e Inno Setup 6.

```bash
pip install pyinstaller pillow
winget install JRSoftware.InnoSetup
python build.py
```

Saídas:

- `dist/Max Downloader/Max Downloader.exe` — app portátil
- `dist/installer/MaxDownloader-Setup-<versão>.exe` — instalador

`python build.py --no-installer` gera só o executável. A versão vem de `maxdownloader/__init__.py`.

O instalador não pede administrador (instala para o usuário atual), cria atalho no Menu Iniciar, oferece atalho na área de trabalho e tem desinstalador.

## Publicar uma versão

1. Atualize `__version__` em `maxdownloader/__init__.py`.
2. `python build.py`
3. Crie a release no GitHub e anexe o instalador:

```bash
gh release create v1.0.0 "dist/installer/MaxDownloader-Setup-1.0.0.exe" --title "Max Downloader 1.0.0"
```
