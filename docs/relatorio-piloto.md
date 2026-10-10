# Relatório do piloto — Protocolo 001

Data: 10/10/2026 · Episódio `ep001-eierschalensollbruchstellenverursacher` · roteiro v6

## 1. Entregas

| # | Entrega | Onde |
|---|---|---|
| 1 | MP4 do piloto (88,5 s, 1080×1920, H.264/AAC, 19,5 MB) | `episodes/ep001-…/build/episode.mp4` — **fora do git** (o repositório é público). sha256 `c78f70c3de90ab4ef5cd995cbc70f7a55c66051745424f2ed44c90b13ff871b2`. Reprodutível com `npm run dnn -- run ep001-eierschalensollbruchstellenverursacher` (o render é determinístico: duas execuções deram o mesmo sha256). |
| 2 | Roteiro | `episodes/ep001-…/package/roteiro.md` (legível, com tempos e fato/ficção) · `script.json` (v6) · `script-history/` |
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

- a interrupção da realidade funciona **só com som** (colher batendo no ovo), o que é decisivo sem filmagem própria;
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

## 3. Mídias e condições de uso

| Mídia | Licença (verificada na origem) | No vídeo | Condição |
|---|---|---|---|
| m1 — Brett Jordan, "Boiled Egg Topper" | CC BY 2.0 (API Openverse; agente também conferiu a página do Flickr) | sim | atribuição |
| m2 — Soljaguar, Commons | CC BY-SA 3.0 (GFDL com migração; wikitext do Commons) | sim | atribuição + **compartilha-igual** |
| m3 — Allan Henderson, "Boiled egg cutter/topper" | CC BY 2.0 (API Openverse) | sim | atribuição; outro tipo de aparelho (usado como "a concorrência") |

Nenhuma foto mostra marca identificável: todas são legendadas como "aparelho do mesmo tipo". Licença de direito
autoral não autoriza uso de marca: o vídeo não sugere endosso e a descrição diz que não há relação com o fabricante.

**Decisão pendente (sua):** a m2 é CC BY-SA. Se o vídeo for considerado obra adaptada, a licença exige oferecer as
contribuições adaptadas sob BY-SA (o YouTube só oferece "Licença padrão" ou CC BY no seletor, mas a licença pode
ser declarada na descrição). Para publicar sem essa condição, troque `m2` por `m1` nos beats s02, s03, s07, s08,
s19–s21 e s27 e rode o pipeline de novo (~3 min). O verify acusa isso como aviso.

## 4. O que foi testado

### Verificação automática (instrumentos)

| Check | Resultado |
|---|---|
| Formato | 1080×1920, 30 fps, H.264 + AAC 48 kHz, 88,5 s (alvo 60–90 s) |
| Quadros pretos | só o corte intencional de 0,7 s (s26) |
| Loudness / pico | −13,9 LUFS integrados (alvo −14) · true peak −1,5 dBTP |
| Silêncios | nenhum silêncio digital inesperado; ambiente de sala ~30 dB abaixo da fala |
| Arquivos | todos os 36 arquivos referenciados presentes |
| Licenças | 3/3 mídias com licença permitida verificada na origem; aviso BY-SA |
| Fatos | 17 falas factuais, todas ligadas a fatos com fonte |
| Pronúncia | transcrição automática (Whisper small) da mixagem final × roteiro: WER 6,1%; por fala, todas ≤ 25% |
| Legendas | blocos ≥ 0,5 s, até 2 linhas; legenda de som "(toc, toc)" |
| Testes de código | 16 testes unitários (inclui upload idempotente com API falsa: timeout, sessão concluída sem resposta, sessão expirada, travas) e teste de fumaça de ponta a ponta (`npm run smoke`) |
| Retomada | etapas puladas quando entradas não mudam; escolha editorial persistida; cache de voz e transcrição |

### Avaliação audiovisual efetivamente realizada

- **Visual — feita por mim (IA):** folha de contato dos 32 beats e quadros em resolução cheia de 7 momentos e da
  miniatura. Corrigi ao longo de 6 versões: esfera escondida pela faixa institucional, palavra órfã nas legendas,
  legenda branca pesada sobre papel, miniatura com quadro errado, créditos sem acento na descrição.
  Limitação restante: a foto m1 (1024 px) ampliada fica levemente mole nos planos de detalhe.
- **Áudio — NÃO ouvido.** Não tenho capacidade de escuta. Volume, pausas e inteligibilidade foram medidos (acima);
  **entonação, naturalidade da voz e o timing cômico exigem sua escuta.** A colocação das pausas segue o roteiro e
  aparece na forma de onda (`build/verify/waveform.png`), mas isso não prova que funcionam como comédia.
- A aprovação humana fica registrada com `npm run dnn -- review <id> --approve`; hoje o status é **pendente**.

## 5. O que depende de credenciais ou decisão

| Item | Situação |
|---|---|
| Upload ao YouTube (OAuth, sessão resumível, reconciliação, legendas, miniatura) | **implementado e testado só com API falsa.** Precisa de projeto Google Cloud com YouTube Data API v3, cliente OAuth "App para computador" (`YT_CLIENT_ID/SECRET`) e `npm run dnn -- youtube:auth`. Para agenda, o app OAuth precisa estar "Em produção" (em "Teste", o token expira em 7 dias). Desligado por padrão; público e agendamento bloqueados por configuração. |
| Projeto não auditado → vídeo travado em privado | fontes oficiais conflitam (referência em inglês diz que não há mais trava; página de ajuda ainda descreve). O upload relê a privacidade remota e avisa. |
| Provedor de texto pela API Anthropic | implementado, **não validado** (sem chave). O padrão é o agente (Claude Code) escrever os JSON. |
| Voz paga (ElevenLabs) | implementada, **não validada** (sem chave e sem orçamento). |
| Agendamento | não ativado (ver `docs/agendamento.md`). |

## 6. Tempo e custo observados

**Tempo de máquina** (medido pelo pipeline neste ambiente de 4 vCPU):

| Etapa | Tempo |
|---|---|
| Pesquisa (validação + checagem de links) | 9–14 s |
| Mídia (verificação de licença + download) | 1–4 s |
| Voz: síntese de 27 falas + transcrição | 82,5 s (primeira vez); 1,7 s com cache |
| Render (88,5 s de vídeo) + normalização | 132–137 s (render puro 119–123 s) |
| Verificação | 47–51 s |
| Pacote (descrição, SRT, miniatura, documentos) | 1–4 s |
| **Execução completa do zero** | **≈ 4,5 min** |

O piloto passou por 6 versões de roteiro; cada nova renderização custou ~3 min.

**Tempo de sessão:** das 20h12 às ~21h50 UTC (~1h40) para infraestrutura, pesquisa, piloto e documentação.
A parte do piloto propriamente dita (da escolha do produto ao arquivo final) levou ~45 min.

**Custos — observados:**
- Serviços pagos contratados: **nenhum**. Chamadas à API do YouTube: **0**. API Anthropic: **não usada**.
- Voz, transcrição e render: locais, sem cobrança por uso.
- Uso do Claude Code: debitado do seu plano. Tokens dos subagentes, conforme as notificações: pesquisa de
  produtos 361.494; documentação 287.485; Routines 173.989 (total 822.968). **Os tokens da sessão principal não
  são visíveis para mim** — não estimei.
- Firecrawl (conector seu): 3 raspagens feitas por mim, 1 crédito cada (informado pela ferramenta); o subagente de
  pesquisa também usou Firecrawl, sem contagem registrada.
- Downloads: modelos de voz ~312 MB, Whisper small ~464 MB, Chrome headless ~99 MB (uma vez por ambiente).

**Custos — estimados:** nenhum valor monetário estimado, porque nenhum provedor pago foi acionado.

## 7. Avaliação imparcial do piloto

**O que funciona.** A estrutura dramática existe e progride: confiança, demonstração, escalada (três designers,
ametista, desdém pela tesoura), interrupção pela colher, silêncio, recuperação frágil ("a colher não tem edição de
Natal") e colapso pela citação do próprio fabricante. As piadas mais fortes não são inventadas: vêm de fatos
documentados. O vendedor nunca anuncia a piada. A identidade visual é discreta e consistente.

**O que é fraco.**
1. **A voz é o elo mais fraco.** O Kokoro é inteligível, mas sintético. Um falso documentário depende de
   micro-hesitações, e a voz não as produz sob comando; as pausas existem só entre falas.
2. **O material visual é limitado:** três fotos paradas e nenhuma filmagem. O "zoom de reação" e as cartelas
   compensam parcialmente; ainda é, em parte, uma apresentação de fotos bem montada.
3. **O hábito retratado é europeu.** "Ovo quente no porta-ovo" é menos familiar no Brasil; a abertura ("problema
   que o brasileiro ignora há gerações") tenta transformar isso em piada, mas pode afastar parte do público.
4. **Pendência de licença:** a foto compartilha-igual (seção 3).

**Recomendação.** Antes de publicar, ouça o piloto. Se a voz não sustentar o timing, a melhoria de maior efeito é
uma voz profissional (provedor pago, com sua autorização e um teto por episódio), não mais engenharia.
