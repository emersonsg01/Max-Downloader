# Guia de uso

## 1. Primeiro uso

1. Abra o **Max Downloader**.
2. Vá em **Ajustes › Componentes** e clique em **Instalar** ao lado de FFmpeg. Ele é baixado uma única vez para `%LOCALAPPDATA%\MaxDownloader\ffmpeg`.
   Sem o FFmpeg o app só baixa arquivos que já vêm prontos (sem 4K, HDR, conversão de áudio, capa ou corte).
3. Em **Ajustes › Armazenamento**, escolha a pasta de destino. Dentro dela o app cria `Vídeos/` e `Áudios/`.

## 2. Baixando

1. Copie o link do vídeo, música ou playlist.
2. Cole na caixa da tela **Baixar** — ou aperte **Ctrl+V** em qualquer lugar da janela. Se o app detectar um link copiado, ele mostra a sugestão "Usar".
3. Aguarde a análise (as bordas da janela brilham enquanto isso).
4. Escolha **Vídeo** ou **Somente áudio** e ajuste as opções.
5. Confira o resumo na barra inferior (ex.: `2160p60 HDR10 · VP9 + AAC · MKV · ≈ 1,2 GB`) e clique em **Baixar** (ou **Ctrl+Enter**).

O progresso aparece na "Dynamic Island" no topo e na tela **Downloads**, onde você pode cancelar, tentar de novo, abrir o arquivo ou mostrá-lo na pasta.

### Opções de vídeo

| Opção | O que faz |
|---|---|
| Resolução | Só aparecem as resoluções disponíveis. "Máxima" pega a melhor. |
| Quadros por segundo | 60 fps deixa movimentos mais suaves; "Máximo" pega o maior disponível. |
| HDR | Ativo só quando o vídeo tem versão HDR naquela resolução. Use MKV, MP4 ou WEBM. |
| Formato | **MP4** toca em tudo · **MKV** aceita qualquer codec · **WEBM** formato aberto · **MOV** para edição/Apple (H.264). |
| Codec | **Automático** = melhor qualidade · **H.264** = máxima compatibilidade (até 1080p no YouTube) · **VP9/AV1** = mais eficientes. |
| Áudio do vídeo | Máxima, Equilibrada (até 128 kbps) ou Econômica (até 64 kbps). |

### Opções de áudio

| Formato | Quando usar |
|---|---|
| MP3 | Toca em qualquer aparelho |
| M4A / AAC | Ecossistema Apple, boa qualidade em tamanho menor |
| OPUS / OGG | Mais eficientes |
| FLAC / WAV | Sem perdas (arquivos maiores) |
| Original | Mantém o áudio exatamente como veio da fonte |

No modo áudio o app baixa o conteúdo em forma de vídeo, extrai o áudio, converte para o formato escolhido e apaga o vídeo. Se o site recusar o primeiro método, o app tenta outros automaticamente.

### Extras

- **Incorporar capa** — a miniatura vira a arte do arquivo (não disponível em WAV, AAC e WEBM).
- **Metadados e capítulos** — título, canal, data e marcadores de capítulo.
- **Legendas** — incorporadas ao vídeo; idiomas em **Ajustes › Idiomas das legendas** (ex.: `pt,en`).
- **Pular patrocínios** — remove trechos patrocinados de vídeos do YouTube via SponsorBlock.
- **Cortar trecho** — arraste as alças ou digite início e fim (`m:ss` ou `h:mm:ss`).

## 3. Conteúdo com restrição ou bloqueio

Em **Ajustes › Acesso a conteúdo restrito**:

- **Usar meu login do navegador** — aproveita a sessão que você já tem aberta. Libera vídeos com restrição de idade, exclusivos de membros e privados que sua conta pode ver.
  - **Firefox** é o mais confiável.
  - **Chrome, Edge, Brave, Opera, Vivaldi**: feche o navegador antes de baixar, porque ele bloqueia os cookies enquanto está aberto.
  - **Arquivo cookies.txt**: exporte com uma extensão como "Get cookies.txt LOCALLY" e escolha o arquivo.
- **Contornar bloqueio regional** — simula acesso de outro país quando o site permite.
- **Proxy / VPN** — ex.: `socks5://127.0.0.1:1080` ou `http://usuario:senha@host:porta`.

Quando um link falha por esses motivos, o app mostra um botão que leva direto à configuração certa.

## 4. Atalhos

| Atalho | Ação |
|---|---|
| Ctrl+V | Colar e analisar o link |
| Ctrl+Enter | Baixar |
| Ctrl+, | Abrir Ajustes |
| Esc | Sair do campo de texto |
| Duplo clique na barra superior | Maximizar / restaurar |

## 5. Solução de problemas

| Problema | Solução |
|---|---|
| "FFmpeg não encontrado" | Ajustes › Componentes › Instalar |
| "Exige login" / "restrição de idade" | Ative "Usar meu login do navegador" |
| "Não foi possível ler os cookies" | Feche o navegador ou use Firefox / cookies.txt |
| "Bloqueado na sua região" | Ative o contorno regional ou configure um proxy |
| Poucas resoluções no YouTube | Instale o Node.js ou o Deno |
| "Protegido por DRM" | Não suportado (Netflix, Disney+, Spotify…) |

Configurações: `%APPDATA%\MaxDownloader\config.json` · FFmpeg: `%LOCALAPPDATA%\MaxDownloader\ffmpeg`.
