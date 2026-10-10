# Proposta de agendamento

**Nada está agendado.** A ativação depende de duas decisões suas: **frequência** e **orçamento**. Abaixo, o que foi
testado, as opções e a recomendação.

## O que foi verificado neste ambiente (sessão em nuvem do Claude Code)

| Item | Resultado |
|---|---|
| Máquina | 4 vCPU, 15 GB RAM, ~30 GB de disco (o mesmo perfil documentado para Routines: ~4 vCPU / 16 GB / 30 GB) |
| FFmpeg 6.1, Node 22, Python 3.13 | presentes |
| Render Remotion com Chromium pré-instalado | **funciona** (`/opt/pw-browsers/.../headless_shell`) |
| Render com o Chrome baixado pelo próprio Remotion | **funciona** (download de ~99 MB) |
| Voz local Kokoro + transcrição Whisper | funciona na CPU (a síntese leva alguns segundos por fala) |
| Rede: Openverse, upload.wikimedia.org, huggingface.co, npm, PyPI | acessíveis |
| Rede: commons.wikimedia.org (API de ação) | **HTTP 429** (limite por IP); o pipeline usa `api.wikimedia.org` e Openverse, com backoff |
| Tempo do piloto (máquina) | execução completa do zero ≈ 4,5 min: voz 82 s, render 132 s, verificação 50 s (detalhe em `docs/relatorio-piloto.md`) |

Conclusão: a renderização **cabe** numa execução em nuvem com o perfil testado (≈ 2,2 min de render para 88 s de vídeo, bem abaixo do teto de 2 h para comandos em segundo plano). Ressalva honesta: testei numa
sessão interativa, não numa Routine disparada; as Routines rodam no mesmo tipo de ambiente, mas o limite de duração
de uma execução não está documentado.

## Fatos sobre as opções (documentação consultada em 10/10/2026)

- **Routines (Claude Code na nuvem)**: prévia de pesquisa; intervalo mínimo de 1 h; cada execução é uma sessão nova
  que clona o repositório e usa o ambiente configurado (rede, variáveis, script de setup); consome o uso do plano
  (sem cobrança separada de VM); empurra commits para branches `claude/...`. Notificação de término não documentada.
  Variáveis de ambiente do ambiente são visíveis a quem usa o ambiente (não são cofre); "network secrets"
  (Pro/Max) injetam cabeçalho de autorização sem expor o valor, mas não está documentado se servem para trocar
  refresh token OAuth do Google.
- **Tarefas agendadas do Claude Desktop**: rodam na sua máquina; o app precisa estar aberto e o computador acordado.
- **`claude -p` via cron/systemd local**: funciona com token de longa duração (`claude setup-token`); você mantém o
  agendador.
- **GitHub Actions**: runners com 4 vCPU/16 GB em repositório público (2 vCPU/8 GB em privado), 6 h por job;
  artefatos de repositório público são visíveis publicamente.
- **YouTube**: upload custa 1 unidade num balde próprio (100 envios/dia); legendas 400 unidades (de 10.000/dia);
  app OAuth em modo "Teste" tem refresh token que **expira em 7 dias** — para agenda, publicar o app ("Em produção").

## Recomendação

Duas Routines na nuvem, ambas sem publicação pública:

1. **Pesquisa recorrente** — semanal (ex.: segunda, 09:07 BRT).
   Claude roda a skill `produzir-episodio` até a etapa de pesquisa: 8–12 candidatos com fontes e mídia licenciada,
   grava em `data/backlog/AAAA-MM-DD.json` e abre um PR com a tabela comparativa. Custo: uso do plano; sem render.
2. **Produção periódica** — 1 episódio por semana para começar (ex.: quarta, 09:07 BRT).
   Escolhe do backlog, escreve o roteiro, gera voz, renderiza, verifica e abre PR com roteiro, relatório e folha de
   contato. **Onde fica o MP4?** O repositório é público, então o vídeo não vai para o git. Duas saídas simples:
   - **(a) recomendada, após autorizar o canal:** upload **privado** automático no YouTube; você assiste no Studio,
     aprova com `review --approve` e agenda a publicação (`upload --publish-at`). Exige app OAuth "Em produção" e
     o refresh token guardado como segredo do ambiente.
   - **(b) sem YouTube:** tornar o repositório privado e anexar o MP4 ao PR por Git LFS ou release privada.

Publicação pública continua manual até você decidir o contrário (`youtube.allowPublic`).

### Se a Routine não comportar o render

Alternativa mais simples: separar o render num workflow do GitHub Actions disparado quando o PR do episódio recebe
o rótulo `render` (o runner instala FFmpeg e o venv, roda `npm run dnn -- run <id> --from voice`, publica o MP4
como artefato). Em repositório público o artefato é público, então isso pressupõe repositório privado (runner de
2 vCPU: render mais lento, ainda dentro do limite de 6 h).

## Decisões pendentes (suas)

1. Frequência inicial (sugestão: pesquisa semanal + 1 episódio por semana).
2. Orçamento: só o plano atual (provedor `agent`, voz local, custo marginal zero) ou API paga (texto/voz) com teto
   por episódio em `budget.maxUsdPerEpisode`.
3. Repositório público ou privado (afeta onde o MP4 e os rascunhos ficam).
4. Autorizar a integração com o canal (projeto Google Cloud, cliente OAuth, app "Em produção").
5. Voz: manter Kokoro (gratuita, Apache-2.0, sotaque sintético perceptível) ou contratar provedor comercial.
