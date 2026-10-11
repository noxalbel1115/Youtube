# Relatório do piloto — Protocolo 001

Data: 10–11/10/2026 · Episódio `ep001-eierschalensollbruchstellenverursacher` · roteiro **v10** (voz ElevenLabs)

## 1. Entregas

| # | Entrega | Onde |
|---|---|---|
| 1 | MP4 do piloto (86,1 s, 1080×1920, H.264/AAC, 15,9 MB) | `episodes/ep001-…/build/episode.mp4` — **fora do git** (o repositório é público). sha256 `5bcb6597ea62524385cc408a1c1a530327ede77c759db5944fb7fcafe0f83e9e`. O render é determinístico a partir dos mesmos áudios; a síntese da ElevenLabs **não** é (cada chamada gera outra leitura e consome créditos). Os áudios pagos ficam só em `build/` neste ambiente; o MP4 enviado a você é a cópia que preserva esta leitura. A versão v8 (voz Kokoro) segue reproduzível trocando as vozes em `config/channel.json`. |
| 2 | Roteiro | `episodes/ep001-…/package/roteiro.md` (legível, com tempos e fato/ficção) · `script.json` (v10) · `script-history/` |
| 3 | Fontes e registro de mídias | `package/fontes-e-midias.md` · `product.json` · `media.json` · `research/` (10 candidatos + saída bruta da pesquisa) |
| 4 | Projeto executável e instruções | `README.md` |
| 5 | Este relatório | `docs/relatorio-piloto.md` |
| 6 | Tempo e custo | seção 7 |
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

### Verificação automática (instrumentos) — v10

| Check | Resultado |
|---|---|
| Formato | 1080×1920, 30 fps, H.264 + AAC 48 kHz, 86,1 s (alvo 60–90 s) |
| Quadros pretos | só o corte intencional de 0,7 s (s26) |
| Loudness / pico | −13,8 LUFS integrados (alvo −14) · true peak −1,4 dBTP (dentro da tolerância de 0,5 dB) |
| Silêncios | nenhum silêncio digital inesperado; ambiente de sala ~30 dB abaixo da fala |
| Arquivos | todos os arquivos referenciados presentes |
| Licenças | 2/2 mídias usadas com licença CC BY verificada na origem; nenhuma BY-SA |
| Fatos | 17 falas factuais, todas ligadas a fatos com fonte |
| Pronúncia | transcrição automática (Whisper small) da mixagem final × roteiro: WER 1,4% (v8 com Kokoro: 5,4%); todas as falas com WER ≤ 25% |
| Legendas | 41 blocos, todos com ≥ 0,5 s e ≤ 38 caracteres |
| Licença da voz | confirmada por você em 11/10/2026 (assinatura paga da ElevenLabs): 18/18 checks ok |
| Testes de código | 18 testes unitários (inclui upload idempotente com API falsa, trilha de deixas 3D e trava de licença da voz) e teste de fumaça de ponta a ponta (`npm run smoke`) |
| Retomada | etapas puladas quando entradas não mudam; escolha editorial persistida; cache de voz e transcrição |

### Avaliação audiovisual efetivamente realizada

- **Visual — feita por mim (IA):** folha de contato dos 32 beats e quadros em resolução cheia, em cada versão.
  Defeitos encontrados e corrigidos ao longo de 8 versões: esfera escondida pela faixa institucional, palavra órfã
  nas legendas, legenda branca pesada sobre papel, miniatura com quadro errado, créditos sem acento, esfera erguida
  fora do quadro no 3D, legenda sobre a foto emoldurada.
- **Áudio — NÃO ouvido por mim.** Medido por instrumentos (acima). Na v10, a transcrição automática ouviu
  "Ametista" como "Ame cista"/"Amigista" e "Trago uma" como "Traga uma"; atribuo ao "ti" palatalizado ("tchi") e à
  junção de vogais do português falado, não a erro da voz — mas é inferência, confira ouvindo.
- Aprovação humana: **aprovado** por você no chat em 11/10/2026 ("para esse está bom"), registrada para o sha256 do MP4.

## 5. Voz

Avaliadas nesta sessão:

| Opção | Licença / custo | Situação |
|---|---|---|
| **ElevenLabs `eleven_v4`**, vendedor "Paulo – Expressive and Confident", colega "Scheila – Serious and Direct" (vozes brasileiras da biblioteca) | pago; licença comercial só para áudio gerado em assinatura paga | **em uso desde a v9**, por sua autorização no chat ("faça a substituição da voz no vídeo, use o modelo bom"), gravada em `state.json` |
| Kokoro-82M (local) | Apache-2.0, sem custo | voz da v8; alternativa gratuita |
| Piper pt-BR (local) | vozes derivadas de dataset só-pesquisa | descartado para publicação |
| Qwen3-TTS 1.7B VoiceDesign (local) | Apache-2.0, sem custo; ~5,5 s de CPU por segundo de fala | amostra gerada; não adotado |
| Gemini TTS (Google) | pago, centavos por episódio | **não testado** |

**Como o modelo foi escolhido (amostras A/B, as mesmas 4 falas, transcritas pelo Whisper):**

| Amostra | Erros de transcrição |
|---|---|
| Paulo + `eleven_v4` | só "Trago" → "Traga" (comum às três) |
| Paulo + `eleven_v3` | "a Sueli" → "a sua Eli"; "com o auxílio" → "com auxílio" |
| Marcelo + `eleven_v4` | "talheres" → "talhares" |

O `eleven_v3` passou a ser descrito pela própria ElevenLabs como geração anterior; o `eleven_v4` lê o nome alemão
na grafia original de forma próxima do alemão ("aia-chalen-sol-bruk-stellen…"), então a grafia fonética que eu
tinha criado para o Kokoro ficou restrita a ele (`providerPronunciations`). Para a ElevenLabs, só "talheres" é
grafado "talhéres", porque a transcrição ouviu "talhares" duas vezes.

**Achados técnicos (medidos):**
- O `eleven_v4` **ignora** o parâmetro de velocidade da API: 1,05 e 1,10 deram 63,1 s e 63,3 s de fala. A velocidade
  configurada (vendedor 1,10; colega 1,05) agora é aplicada localmente com `atempo` do FFmpeg, sem mudar o tom.
  Isso trouxe o vídeo de 91,2 s (acima do limite de 90 s) para 86,1 s.
- A chave chega por *network secret*: o `fetch` do Node precisa de `NODE_USE_ENV_PROXY=1` para passar pelo proxy
  (sem isso a API respondeu 401). A chave é restrita: não tem permissão `user_read`, então não consigo consultar
  o plano nem o saldo.
- Créditos: a API informa o consumo no cabeçalho `Character-Cost`. Uma síntese completa do episódio (27 falas,
  ~880 caracteres) veio como **98 créditos**; "Ametista." (9 caracteres), 1 crédito. Isso é menos que 1 crédito por
  caractere, que é o multiplicador que `/v1/models` informa para o `eleven_v4`. Registro o que a API informou; não
  sei explicar a diferença (pode ser preço promocional do modelo novo).

**Licença da voz — você confirmou assinatura paga em 11/10/2026** (`commercialLicenseConfirmed = true`). Pela ElevenLabs (documentação consultada em 10/10/2026):
"The free plan does not include a commercial license", e o que for publicado a partir do plano gratuito precisa
citar "elevenlabs.io" ou "11.ai" no título. Conteúdo gerado durante assinatura paga pode ser usado comercialmente
"indefinitely"; conteúdo gerado fora dela, "before or after", não. Como não consigo ver seu plano, o `verify` avisa e
o upload fica bloqueado até `providers.tts.elevenlabs.commercialLicenseConfirmed = true`. Se as falas foram geradas no
plano gratuito, será preciso assinar e **gerar de novo** (cerca de 100 créditos pela contagem observada; sairá
uma leitura um pouco diferente).

## 6. O que depende de credenciais ou decisão

| Item | Situação |
|---|---|
| Upload ao YouTube (OAuth, sessão resumível, reconciliação, legendas, miniatura) | **implementado e testado só com API falsa.** Precisa de projeto Google Cloud com YouTube Data API v3, cliente OAuth "App para computador" (`YT_CLIENT_ID/SECRET`) e `npm run dnn -- youtube:auth`. Para agenda, app OAuth "Em produção" (em "Teste", o token expira em 7 dias). Desligado por padrão; público e agendamento bloqueados por configuração. |
| Projeto não auditado → vídeo travado em privado | fontes oficiais conflitam; o upload relê a privacidade remota e avisa. |
| Voz ElevenLabs | **validada** com sua chave (network secret): síntese, cobrança informada pela API e reaproveitamento de cache. Plano da conta desconhecido para mim. |
| Texto pela API Anthropic | implementado, **não validado** (sem chave). |
| Agendamento | não ativado (ver `docs/agendamento.md`). |

## 7. Tempo e custo observados

**Tempo de máquina** (medido pelo pipeline neste ambiente de 4 vCPU, sem GPU):

| Etapa | Tempo |
|---|---|
| Pesquisa (validação + checagem de links) | 9–14 s |
| Mídia (verificação de licença + download) | 1–4 s |
| Voz: síntese de 27 falas + transcrição | 77–83 s do zero (ElevenLabs, ~1 min de API; Kokoro, semelhante); 3–55 s com cache |
| Render com cenas 3D (85–86 s de vídeo) | **904–964 s (~15–16 min)** — o WebGL roda por software |
| Render só com fotos (v6, para comparação) | 119–123 s |
| Verificação | 47–52 s |
| Pacote | 1–6 s |
| **Execução completa do zero (v8)** | **≈ 19 min** |

**Tempo de sessão:** das 20h12 de 10/10 às ~00h20 UTC de 11/10 (~4h), incluindo infraestrutura, pesquisa, 10 versões
do piloto, pesquisa e troca de voz, e documentação.

**Custos — observados:**
- Serviços pagos contratados por mim: **nenhum**. A conta ElevenLabs e a chave são suas. Chamadas à API do YouTube:
  **0**. API Anthropic: **não usada**.
- **ElevenLabs, créditos informados pela API, dentro do pipeline: 203** (`state.json`): 98 na primeira síntese
  completa, 4 numa regravação da fala s24, e 101 na grafia "talhéres" somada à regravação completa a 1,10, que o
  modelo ignorou. Cerca de 100 créditos foram desperdiçados por eu não testar o parâmetro numa fala só antes.
- ElevenLabs fora do pipeline (amostras A/B): 594 caracteres em 5 chamadas sem contagem registrada, mais 1 crédito
  informado ("Ametista."). O script de amostras passou a registrar os créditos.
- Valor em dinheiro: depende do seu plano (gratuito: zero; Starter: assinatura mensal de US$ 6, sem cobrança por
  episódio dentro da cota de 30.000 créditos). Não calculei valor por episódio.
- Transcrição e render: locais, sem cobrança por uso.
- Uso do Claude Code: debitado do seu plano. Tokens dos subagentes, conforme as notificações: pesquisa de
  produtos 361.494; documentação 287.485; Routines 173.989 (total 822.968). **Os tokens da sessão principal não
  são visíveis para mim** — não estimei.
- Firecrawl (conector seu): 3 raspagens feitas por mim, 1 crédito cada, na primeira fase; na troca de voz, 1 busca
  (2 créditos) e 2 raspagens (1 e 5 créditos), todos informados pela ferramenta. O subagente de pesquisa também usou
  Firecrawl, sem contagem registrada.
- Downloads: modelos Kokoro ~312 MB, Whisper small ~464 MB, Chrome headless ~99 MB; para o teste do Qwen3-TTS,
  PyTorch CPU e o modelo de 1,7B (só em diretório temporário).

**Custos — estimados:** para as amostras A/B sem contagem, pela proporção observada (98 créditos / ~880
caracteres), cerca de **65 créditos**. É estimativa, não medida.

## 8. Avaliação imparcial do piloto

**O que funciona.** A estrutura dramática progride: confiança, demonstração, escalada (três designers, ametista,
desdém pela tesoura), interrupção pela colher, silêncio, recuperação frágil ("a colher não tem edição de Natal") e
colapso pela citação do próprio fabricante. As piadas mais fortes vêm de fatos documentados. O vendedor nunca anuncia
a piada. Com o 3D, a demonstração ganhou movimento contínuo em vez de cortes entre fotos.

**O que é fraco.**
1. **A voz** melhorou de patamar (sotaque brasileiro natural, entonação de vendedor), mas eu não a ouvi: os
   instrumentos dizem que a dicção está correta, não que a atuação sustenta o *timing* cômico. As pausas continuam
   vindo do roteiro (entre falas), não de marcações de atuação.
2. **O 3D é limpo, mas genérico:** é um *packshot* simples, sem texturas nem marcas; serve à piada, não impressiona
   como computação gráfica. E custa ~16 min de render por versão nesta máquina.
3. **O hábito retratado é europeu** ("ovo quente no porta-ovo"), menos familiar no Brasil.

**Recomendação.** Ouça a v10 inteira antes de aprovar (`npm run dnn -- review <id> --approve`). Antes de qualquer
publicação, confirme o plano da ElevenLabs: se as falas saíram do plano gratuito, assine e gere de novo. Para a
agenda, defina um teto (`budget.maxUsdPerEpisode`), ou cada episódio vai exigir autorização explícita para a voz paga.
