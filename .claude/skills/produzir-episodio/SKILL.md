---
name: produzir-episodio
description: Produz um episodio do canal "Departamento de Necessidades Desnecessarias" de ponta a ponta (pesquisa de produtos reais, selecao, roteiro, voz, render, verificacao, pacote). Use quando pedirem um novo episodio, pesquisa de candidatos, ou quando uma Routine agendada disparar a producao.
---

# Produzir episódio

Você opera o pipeline deste repositório. O código faz as etapas determinísticas; você faz a pesquisa e o roteiro
(provedor `agent`), sempre gravando JSON que o pipeline valida. Leia `prompts/pesquisa.md` e `prompts/roteiro.md`.

## Passos

1. `./scripts/setup.sh` (idempotente) e `npm run dnn -- doctor`. Se algo faltar, pare e relate.
2. Próximo ID: veja `episodes/` e `data/history.json`; crie com `npm run dnn -- new epNNN-slug-provisorio`.
3. **Pesquisa** (WebSearch/WebFetch + APIs do Commons e do Openverse): 8–12 candidatos reais, com fontes datadas,
   fatos com `sourceIds`, preço só se visto na página, mídia só com licença explícita (CC0/PD/BY/BY-SA) e
   `providerRef`. Grave `episodes/<id>/research/candidates.json`. Nunca invente URL, preço ou licença.
4. `npm run dnn -- run <id>` → valida pesquisa, seleciona, verifica licenças na origem e baixa mídia; para pedindo
   o roteiro. Confira `media.json`: só itens `usable` podem entrar no roteiro.
5. **Roteiro**: escreva `episodes/<id>/script.json` seguindo `prompts/roteiro.md` (fatos x ficção, progressão,
   pausas, vendedor nunca anuncia a piada). Rode `npm run dnn -- run <id>` de novo.
6. Se a etapa `voice` acusar falas com transcrição divergente, ajuste `pronunciations`/texto, incremente `version`
   e rode de novo. Mesma coisa para avisos de `verify`.
7. Inspecione visualmente `build/verify/contact-sheet.jpg` e quadros em `build/verify/frames/` (leia as imagens) e a
   forma de onda `build/verify/waveform.png`. Registre o que viu em `verify-report.json → manualReview.notes`, mas
   **não** marque como aprovado: aprovação é humana (`npm run dnn -- review <id> --approve`).
8. Commit dos arquivos de texto do episódio (pesquisa, seleção, produto, mídia, roteiro, relatório, pacote) num
   branch `claude/episodio-<id>` e abra PR com: produto escolhido e por quê, tabela de candidatos, roteiro, checks
   automáticos, observações da inspeção e o que depende de decisão humana. O MP4 não vai para o git.

## Limites

- Nunca rode `upload` sem instrução explícita do usuário na tarefa; mesmo então, só privado ou agendado conforme
  `config/channel.json`. Nunca altere `youtube.allowPublic`, `uploadEnabled` ou orçamento por conta própria.
- Não contrate serviços nem ative provedores pagos. Nunca use `--authorize-paid-tts` sem instrução explícita do
  usuário na tarefa: a voz atual (ElevenLabs) é paga, então sem essa instrução a etapa `voice` fica bloqueada —
  registre o bloqueio no PR em vez de trocar a voz para o Kokoro por conta própria.
- Nunca marque `providers.tts.elevenlabs.commercialLicenseConfirmed` por conta própria.
- Produtos de acessibilidade ou profissionais: a piada é o exagero do vendedor, nunca o público.
