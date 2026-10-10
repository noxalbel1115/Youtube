# Guia de pesquisa — candidatos a episódio

Objetivo: propor 8–12 **produtos reais** excêntricos, superespecializados ou desproporcionais ao problema que resolvem,
e devolver JSON que valide em `src/schemas.ts → CandidatesFile` (salvo em `episodes/<id>/research/candidates.json`).

## Critérios

- **Contraste** problema pequeno × solução grandiosa; **potencial de história** (há um momento óbvio em que alguém
  resolve a tarefa com a mão, uma faca, uma colher?); **clareza visual**; **material disponível**;
  **confiabilidade** das informações; **novidade** (não repetir: {{HISTORICO}}).
- Não confunda **tecnologia assistiva** ou **ferramenta profissional** com inutilidade. Registre o uso legítimo e o
  risco de a piada atingir quem depende do produto.

## Fontes (obrigatório)

- Prefira fabricante e loja oficial; depois varejistas grandes; enciclopédias só como apoio.
- Para cada fonte: `url`, `title`, `publisher`, `kind`, `accessedAt` (data da consulta), `confirms` (o que confirma).
- `facts`: afirmações curtas e verificáveis, cada uma com `sourceIds`. Nada de inferência.
- `price`: só se você viu o valor na página; informe moeda, data e fonte. Caso contrário, `null`.

## Mídia (obrigatório e eliminatório)

Encontrar mídia pública **não** é autorização. Só entram itens com licença explícita que permita reutilização:
CC0, domínio público, CC BY, CC BY-SA (nesta ordem de preferência). Excluir NC, ND, "uso editorial", fotos de
fabricante sem permissão escrita e capturas de vídeo de terceiros.

- Fontes práticas: Wikimedia Commons (API `api.wikimedia.org/core/v1/commons/...`), Openverse (`api.openverse.org`,
  agrega Flickr e Commons com licença), páginas de vídeos com licença CC BY declarada.
- Para cada item: `provider`, `providerRef` (id Openverse ou `File:...` no Commons), `landingUrl`, `fileUrl`,
  `license`, `licenseVersion`, `creator`, `showsExactProduct` e uma descrição honesta do que a imagem mostra.

## Notas (1–5)

`contrast`, `story`, `visual`, `media`, `reliability` — justifique em `comedyAngle` e `risks`.
