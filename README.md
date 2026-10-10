# Departamento de Necessidades Desnecessárias

*Você não precisava. Até agora.*

Pipeline de produção de Shorts de comédia (falso documentário corporativo) sobre produtos reais excêntricos.
Um vendedor fictício tenta vender, com absoluta seriedade, um produto real; o humor está na distância entre a
promessa e a utilidade. Fatos sobre o produto vêm de fontes registradas; a ficção é só o vendedor e o escritório.

## Etapas

```
research → select → media → script → voice → timeline → render → verify → package → (upload)
```

| Etapa | O que faz | Saída |
|---|---|---|
| research | valida `research/candidates.json` (escrito pelo agente ou pela API), confere fontes e links | `research/` |
| select | pontua candidatos; elimina quem não tem mídia licenciada, fontes de fabricante/loja ou já foi usado | `selection.json`, `product.json` |
| media | confere a licença **na origem** (Commons/Openverse), baixa, registra hash, condições e atribuição | `media.json` |
| script | valida o roteiro: falas factuais → fatos → fontes; mídia só se liberada; versiona | `script.json`, `script-history/` |
| voice | TTS por personagem (ElevenLabs ou Kokoro local), ajusta andamento, corta silêncio, nivela, transcreve de volta (Whisper) | `build/voice.json` |
| timeline | quadros, pausas, legendas sincronizadas por palavra, efeitos e ambiente de sala | `build/timeline.json` |
| render | Remotion → MP4 1080×1920 H.264/AAC; cenas 3D próprias (three.js, WebGL por software); loudness −14 LUFS em duas passagens | `build/episode.mp4` |
| verify | formato, duração, quadros pretos, silêncios, loudness, licenças, fatos, transcrição, legendas, folha de contato | `verify-report.json` |
| package | título, descrição com fontes e créditos, tags, SRT, miniatura | `package/` |
| upload | YouTube: sessão resumível, reconciliação, privacidade explícita — **desligado por padrão** | estado em `state.json` |

O estado de cada episódio fica em `episodes/<id>/state.json`: etapa atual, tentativas, erros, hash das entradas de cada
etapa (uma etapa só roda de novo se suas entradas mudarem), artefatos com sha256, custos (observados × estimados) e
estado do upload.

## Rodar manualmente

Requisitos: Node ≥ 22, Python ≥ 3.10, FFmpeg. O Chromium é detectado ou baixado pelo Remotion.

```bash
./scripts/setup.sh                       # npm ci, venv Python, modelos de voz (hash verificado)
npm run dnn -- doctor                    # confere dependências e rede
npm run dnn -- new ep002-algum-produto
# o agente (Claude Code) escreve episodes/ep002-.../research/candidates.json  (guia: prompts/pesquisa.md)
npm run dnn -- run ep002-algum-produto   # para em "script" pedindo o roteiro (guia: prompts/roteiro.md)
npm run dnn -- run ep002-algum-produto   # retoma de onde parou e vai até "package"
npm run dnn -- status ep002-algum-produto
npm run studio                           # Remotion Studio para ajustes visuais (inclui a composição Scene3DPreview)
npx tsx scripts/preview-stills.ts Episode /tmp/quadros 100 600 --props episodes/<id>/build/timeline.json --public episodes/<id>/build/public
                                         # quadros isolados para inspeção, sem renderizar tudo
```

Retomar após falha: rode o mesmo `run`; etapas concluídas com as mesmas entradas são puladas.
Forçar uma etapa: `--force voice` (ou `--force all`). Escolher manualmente o produto: `--pick <slug>`.

## Publicação (só com autorização)

1. Revisão humana do MP4: `npm run dnn -- review <id> --approve --note "..."` (vale só para aquele sha256).
   Observações sem aprovar: `--note-only`.
2. `config/channel.json → youtube.uploadEnabled: true` e credenciais no ambiente (`.env.example`).
3. `npm run dnn -- youtube:auth` uma vez, numa máquina com navegador (grava o token fora do repositório).
4. `npm run dnn -- upload <id> --confirm-upload` → envia como **privado**.
   Agendado: `--publish-at 2026-10-20T15:00:00-03:00` (exige `allowScheduledPublish`). Público exige `allowPublic`.

Após timeout, rodar `upload` de novo é seguro: a sessão salva é consultada (se concluiu, adota o vídeo) e, se
expirou, o canal é consultado pelo marcador `ref:` da descrição antes de qualquer novo envio.
`npm run dnn -- reconcile <id>` faz só a consulta.

## Provedores (troca por configuração)

`config/channel.json → providers`:
- **Texto** (`llm.research`, `llm.script`): `agent` (Claude Code escreve os JSON; padrão) ou `anthropic` (API, exige
  `ANTHROPIC_API_KEY` e orçamento).
- **Voz** (`tts.voices.<personagem>`): `elevenlabs` (pago; atual, modelo `eleven_v4`, vozes brasileiras da
  biblioteca), `kokoro` (local, Apache-2.0; alternativa gratuita), `piper` (local; vozes pt-BR derivadas de dataset
  só-pesquisa — não publicar).
- Provedores pagos são recusados enquanto `budget.maxUsdPerEpisode = 0`, salvo autorização explícita do episódio:
  `npm run dnn -- run <id> --authorize-paid-tts "quem autorizou e como"` (fica gravada no `state.json`). Os créditos
  informados pela API ficam em `state.costs`.
- Chave da ElevenLabs: variável `ELEVENLABS_API_KEY` ou, na nuvem, *network secret* para `api.elevenlabs.io`
  (cabeçalho `xi-api-key`, sem prefixo). `npm run dnn` já define `NODE_USE_ENV_PROXY=1` para o `fetch` do Node usar o proxy.
- O `eleven_v4` ignora o parâmetro de velocidade da API (medido); a velocidade configurada é aplicada localmente
  com `atempo` do FFmpeg, sem alterar o tom.
- Amostras A/B fora do pipeline: `npx tsx scripts/voice-ab.ts --voice <id> --label <nome> --model eleven_v4 --confirm-paid`.
- **Licença da voz:** áudio da ElevenLabs só pode ser publicado com fins comerciais se foi gerado durante uma
  assinatura paga. Até `providers.tts.elevenlabs.commercialLicenseConfirmed = true`, o `verify` avisa e o upload
  fica bloqueado.

## Visual: fotos licenciadas + ilustração 3D própria

O Opus 5.5 não gera vídeo fotográfico; ele escreve código que é renderizado quadro a quadro. Por isso o produto é
mostrado como **ilustração 3D própria do tipo de aparelho** (`type: "scene3d"` no roteiro, cenas em
`src/remotion/components/`), com câmera contínua guiada por deixas (`cue`) de cada beat, e as fotos reais entram
como evidência emoldurada. Toda cena 3D leva o rótulo "ilustração" na tela: não é filmagem nem demonstração real.

## Licenças de terceiros

- Mídia: só CC0, domínio público, CC BY e CC BY-SA, verificadas na origem. BY-SA gera aviso (compartilha-igual).
- Remotion: gratuito para pessoa física e empresas com até 3 funcionários (ver licença do Remotion).
- Kokoro-82M: Apache-2.0. faster-whisper/Whisper: MIT. IBM Plex: OFL.
- ElevenLabs: licença comercial só para áudio gerado em assinatura paga; plano gratuito exige "elevenlabs.io" no título e proíbe uso comercial.

Ver também: `docs/relatorio-piloto.md` e `docs/agendamento.md`.
