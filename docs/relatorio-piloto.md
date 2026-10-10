# Relatório do piloto — Protocolo 001

Data: 10/10/2026 · Episódio `ep001-eierschalensollbruchstellenverursacher` · roteiro **v8**

## 1. Entregas

| # | Entrega | Onde |
|---|---|---|
| 1 | MP4 do piloto (85,5 s, 1080×1920, H.264/AAC, 15,9 MB) | `episodes/ep001-…/build/episode.mp4` — **fora do git** (o repositório é público). sha256 `ce5319aa78cc9b81f6a1f6db00d6d1e0469bda1733f831d6e1fb540d7ef635a8`. Reprodutível com `npm run dnn -- run ep001-eierschalensollbruchstellenverursacher` (renders repetidos deram o mesmo sha256). |
| 2 | Roteiro | `episodes/ep001-…/package/roteiro.md` (legível, com tempos e fato/ficção) · `script.json` (v8) · `script-history/` |
| 3 | Fontes e registro de mídias | `package/fontes-e-midias.md` · `product.json` · `media.json` · `research/` (10 candidatos + saída bruta da pesquisa) |
| 4 | Projeto executável e instruções | `README.md` |
| 5 | Este relatório | `docs/relatorio-piloto.md` |
| 6 | Tempo e custo | seção 6 |
| 7 | Proposta de agenda | `docs/agendamento.md` |

Também prontos: `package/description.txt` (descrição com fontes e créditos), `package/captions.pt-BR.srt`,
`package/metadata.json`, miniatura em `build/thumbnail.png`.

## 2. Produto escolhido e por quê

**Abridor de ovo por impacto** — o *Eierschalensollbruchstellenverursacher* (exemplo comercial: "Clack", Take2-Design).

A pontuação automática pôs o fatiador de banana Hutzler 571 em primeiro (notas máximas do agente, mais fotos).
Escolhi o abridor de ovo por decisão editorial, registrada em `selection.json`:

- a interrupção da realidade funciona **só com som** (colher batendo no ovo), decisivo sem filmagem própria;
- o nome alemão de 38 letras casa com o tom burocrático do Departamento;
- os fatos verificados são, eles mesmos, cômicos: a própria loja do fabricante diz que a tampa sai inclinando o
  aparelho **ou com talheres adicionais**; o design é creditado a três designers; há versão com esfera de pedra
  preciosa e edição de Natal; o dicionário DWDS registra a palavra como de uso "geralmente brincalhão";
- o fatiador de banana é meme de 2012 e sua interrupção (faca cortando banana) seria muda.

Os 10 candidatos (critério automático estrito: só conta foto licenciada do **mesmo** produto):

| Candidato | Pontuação | Elegível | Observação |
|---|---|---|---|
| Fatiador de banana Hutzler 571 | 5,0 | sim | melhor acervo de fotos; meme antigo |
| **Abridor de ovo por impacto** | 4,55 | sim | **escolhido** |
| Estojo para banana (Banana Guard / Plasútil) | 4,35 | sim | duplo sentido arriscado; marca fotografada ≠ marca à venda no Brasil |
| Travesseiro Ostrich Pillow | 4,35 | sim | fotos com pessoas identificáveis (direito de imagem) |
| Furador de ovo (Westmark Eidorn) | 4,3 | sim | pouco impacto visual |
| Óculos para cortar cebola (RSVP) | 4,5 | não | fotos de produto equivalente, não comprovadamente o mesmo |
| Torradeira de cachorro-quente (Nostalgia) | 4,2 | não | fotos de 500 px |
| Chapéu-guarda-chuva | 4,2 | não | uma fonte só; risco de zombar de trabalhador ao ar livre |
| Descascador de morango (OXO) | 3,9 | não | foto de modelo antigo |
| Cortador de ovo | 3,85 | não | ferramenta genuinamente útil |

Fora da lista (pesquisados e descartados): garfo giratório de espaguete, caneca autoagitadora e descascador
Rotato Express (nenhuma mídia licenciada; o Rotato é anunciado para pessoas com pouca força nas mãos — piada
atingiria quem depende dele), o descascador de ervas Talisman (foto só na embalagem) e a guilhotina de bagel Hoan
(tem motivo real de segurança: cortes na mão ao fatiar bagel).

## 3. Visual e mídias

**Desde a v7, o produto aparece como ilustração 3D própria** (three.js renderizado pelo Remotion), em planos de
câmera contínuos: abertura (aparelho ao lado do ovo, aproximação até o topo), demonstração (a cápsula pousa, a
esfera sobe e cai no "clack", a casca se rompe e a tampa se abre mostrando clara e gema), a esfera que vira ametista
na "Gem Edition" e o plano parado da interrupção, com zoom de reação. Cada plano 3D leva o rótulo
"Ilustração 3D do Departamento · tipo de aparelho, não é foto do produto": é desenho explicativo, não demonstração
real. A mecânica desenhada segue a descrição do fabricante e da Wikipédia.

Fotos reais entram só como evidência emoldurada:

| Mídia | Licença (verificada na origem) | Uso | Condição |
|---|---|---|---|
| m1 — Brett Jordan, "Boiled Egg Topper" | CC BY 2.0 (API Openverse; o agente também conferiu a página do Flickr) | "foto real de um aparelho do mesmo tipo" (s27) | atribuição |
| m3 — Allan Henderson, "Boiled egg cutter/topper" | CC BY 2.0 (API Openverse) | "a concorrência": abridor do tipo tesoura (s16–s18) | atribuição |
| m2 — Soljaguar, Commons | CC BY-SA 3.0 | **não usada desde a v7** | — |

Com a saída da m2, **não há mais pendência de compartilha-igual**. Nenhuma foto mostra marca identificável; licença
de direito autoral não autoriza uso de marca: o vídeo não sugere endosso e a descrição diz que não há relação com o
fabricante.

## 4. O que foi testado

### Verificação automática (instrumentos) — v8

| Check | Resultado |
|---|---|
| Formato | 1080×1920, 30 fps, H.264 + AAC 48 kHz, 85,5 s (alvo 60–90 s) |
| Quadros pretos | só o corte intencional de 0,7 s (s26) |
| Loudness / pico | −13,9 LUFS integrados (alvo −14) · true peak −1,5 dBTP |
| Silêncios | nenhum silêncio digital inesperado; ambiente de sala ~30 dB abaixo da fala |
| Arquivos | todos os arquivos referenciados presentes |
| Licenças | 2/2 mídias usadas com licença CC BY verificada na origem; nenhuma BY-SA |
| Fatos | 17 falas factuais, todas ligadas a fatos com fonte |
| Pronúncia | transcrição automática (Whisper small) da mixagem final × roteiro: WER 5,4% |
| Avisos aceitos | "A Sueli usa colher" transcrito "Assoeli…" (junção natural do artigo); fala do preço só difere na formatação numérica do ASR; legenda "Bom dia." com 0,47 s (mínimo de leitura 0,5 s) |
| Testes de código | 17 testes unitários (inclui upload idempotente com API falsa e trilha de deixas 3D) e teste de fumaça de ponta a ponta (`npm run smoke`) |
| Retomada | etapas puladas quando entradas não mudam; escolha editorial persistida; cache de voz e transcrição |

### Avaliação audiovisual efetivamente realizada

- **Visual — feita por mim (IA):** folha de contato dos 32 beats e quadros em resolução cheia, em cada versão.
  Defeitos encontrados e corrigidos ao longo de 8 versões: esfera escondida pela faixa institucional, palavra órfã
  nas legendas, legenda branca pesada sobre papel, miniatura com quadro errado, créditos sem acento, esfera erguida
  fora do quadro no 3D, legenda sobre a foto emoldurada.
- **Áudio — NÃO ouvido por mim.** Medido por instrumentos (acima). Você ouviu a v6 e decidiu manter o Kokoro um pouco
  mais rápido (vendedor 1,04; colega 1,05); "Puxa a esfera" ficou a 0,88 porque a voz engolia a palavra.
- A aprovação humana fica registrada com `npm run dnn -- review <id> --approve`; hoje o status é **pendente**.

## 5. Voz

Avaliadas nesta sessão:

| Opção | Licença / custo | Situação |
|---|---|---|
| **Kokoro-82M** (local) | Apache-2.0, sem custo | **em uso**, por sua decisão |
| Piper pt-BR (local) | vozes derivadas de dataset só-pesquisa | descartado para publicação |
| Qwen3-TTS 1.7B VoiceDesign (local) | Apache-2.0, sem custo; ~5,5 s de CPU por segundo de fala | amostra gerada e enviada; não adotado |
| ElevenLabs Eleven v3 | pago; plano Starter (~US$ 5–6/mês) libera uso comercial | recomendado se quiser atuação (marcações como suspiro, pigarro); **não testado** — exige chave e orçamento |
| Gemini TTS (Google) | pago, centavos por episódio | alternativa barata com instrução de estilo; **não testado** |

## 6. O que depende de credenciais ou decisão

| Item | Situação |
|---|---|
| Upload ao YouTube (OAuth, sessão resumível, reconciliação, legendas, miniatura) | **implementado e testado só com API falsa.** Precisa de projeto Google Cloud com YouTube Data API v3, cliente OAuth "App para computador" (`YT_CLIENT_ID/SECRET`) e `npm run dnn -- youtube:auth`. Para agenda, app OAuth "Em produção" (em "Teste", o token expira em 7 dias). Desligado por padrão; público e agendamento bloqueados por configuração. |
| Projeto não auditado → vídeo travado em privado | fontes oficiais conflitam; o upload relê a privacidade remota e avisa. |
| Voz paga, texto pela API Anthropic | implementados ou previstos, **não validados** (sem chave, orçamento zero). |
| Agendamento | não ativado (ver `docs/agendamento.md`). |

## 7. Tempo e custo observados

**Tempo de máquina** (medido pelo pipeline neste ambiente de 4 vCPU, sem GPU):

| Etapa | Tempo |
|---|---|
| Pesquisa (validação + checagem de links) | 9–14 s |
| Mídia (verificação de licença + download) | 1–4 s |
| Voz: síntese de 27 falas + transcrição | 77–83 s (do zero); 2–8 s com cache |
| Render com cenas 3D (85 s de vídeo) | **929–964 s (~16 min)** — o WebGL roda por software |
| Render só com fotos (v6, para comparação) | 119–123 s |
| Verificação | 47–52 s |
| Pacote | 1–6 s |
| **Execução completa do zero (v8)** | **≈ 19 min** |

**Tempo de sessão:** das 20h12 às ~23h00 UTC (~2h50), incluindo infraestrutura, pesquisa, 8 versões do piloto,
pesquisa de vozes e documentação.

**Custos — observados:**
- Serviços pagos contratados: **nenhum**. Chamadas à API do YouTube: **0**. API Anthropic: **não usada**.
- Voz, transcrição e render: locais, sem cobrança por uso.
- Uso do Claude Code: debitado do seu plano. Tokens dos subagentes, conforme as notificações: pesquisa de
  produtos 361.494; documentação 287.485; Routines 173.989 (total 822.968). **Os tokens da sessão principal não
  são visíveis para mim** — não estimei.
- Firecrawl (conector seu): 3 raspagens feitas por mim, 1 crédito cada (informado pela ferramenta); o subagente de
  pesquisa também usou Firecrawl, sem contagem registrada.
- Downloads: modelos Kokoro ~312 MB, Whisper small ~464 MB, Chrome headless ~99 MB; para o teste do Qwen3-TTS,
  PyTorch CPU e o modelo de 1,7B (só em diretório temporário).

**Custos — estimados:** nenhum valor monetário, porque nenhum provedor pago foi acionado.

## 8. Avaliação imparcial do piloto

**O que funciona.** A estrutura dramática progride: confiança, demonstração, escalada (três designers, ametista,
desdém pela tesoura), interrupção pela colher, silêncio, recuperação frágil ("a colher não tem edição de Natal") e
colapso pela citação do próprio fabricante. As piadas mais fortes vêm de fatos documentados. O vendedor nunca anuncia
a piada. Com o 3D, a demonstração ganhou movimento contínuo em vez de cortes entre fotos.

**O que é fraco.**
1. **A voz** continua sintética: sem micro-hesitações sob comando; as pausas existem entre falas, não dentro delas.
2. **O 3D é limpo, mas genérico:** é um *packshot* simples, sem texturas nem marcas; serve à piada, não impressiona
   como computação gráfica. E custa ~16 min de render por versão nesta máquina.
3. **O hábito retratado é europeu** ("ovo quente no porta-ovo"), menos familiar no Brasil.

**Recomendação.** Antes de publicar, ouça a v8 inteira. Se a voz não sustentar o timing, a melhoria de maior efeito
é uma voz com controle de atuação (ElevenLabs v3), com sua autorização e um teto por episódio.
