# Guia de roteiro — Departamento de Necessidades Desnecessárias

Você escreve um episódio de 60–90 s, vertical, em português brasileiro, no formato de falso documentário corporativo.
Saída: um objeto JSON que valide em `src/schemas.ts → Script`, salvo em `episodes/<id>/script.json`.

## Premissa

Um vendedor fictício (Valdemar Anunciação, Consultor Sênior de Soluções) apresenta **um produto real** com absoluta
seriedade. O humor nasce da distância entre a promessa grandiosa e a utilidade pequena, do esforço para justificar
desvantagens e do constrangimento quando a realidade interrompe a apresentação.

## Regras inegociáveis

1. **Fatos x ficção.** Toda afirmação sobre o produto real (o que faz, como funciona, preço, material, fabricante)
   é `claim: "fact"` e cita `factIds` de `product.json`. A ficção é o vendedor, a colega, o escritório, as opiniões e
   os exageros *evidentes* do vendedor. Nunca invente defeito, resultado de teste, preço, demonstração ou estatística.
2. **O vendedor nunca pisca para a câmera — mas a ironia é descarada.** Ele tenta fechar a venda com tom sério e
   não ri da própria fala; o *conteúdo* do que ele diz, porém, é ironia aberta: elogia exatamente o defeito, tira
   conclusões absurdas de fatos reais e as diz por extenso. A colega, o locutor e as cartelas do Departamento podem
   ser sarcásticos às claras. Continua proibido: "kkk", memes, efeitos de meme, risada gravada. Ver a seção
   **Ironia descarada** (nota do editor sobre o Protocolo 003).
3. **Progressão dramática.** Confiança alta → demonstração → interrupção da realidade → silêncio → tentativa de
   recuperação → confiança deteriorada → última tentativa de fechar a venda. Cada beat muda algo.
4. **Respeito ao uso legítimo.** Se o produto tem público legítimo (acessibilidade, uso profissional, segurança),
   a piada é o exagero do vendedor, nunca o público. Quem compra nunca é o alvo. Marcas e fabricantes podem ser
   alvo de ironia sobre o que eles próprios disseram ou cobraram (comunicado, preço, “primeiro”, “revolucionário”),
   sempre com fonte; nunca sobre defeito ou resultado que não esteja documentado. Não sugira endosso.
5. **Pausas são tempero, não prato.** Entre falas, 0,2–0,5 s. Silêncio longo (≥ 0,8 s) só no golpe maior, no
   máximo duas vezes por episódio. Beat sem fala: até 2 s. Use cortes secos (`motion: "static"`) e o "zoom de
   reação" (`snap-in`) em cada golpe da realidade (até 4 vezes por episódio).
6. **Mídia.** Só use `mediaId` com `status: "usable"` em `media.json`. Não descreva na fala algo que a imagem não mostra.
7. **Referências.** The Office é atmosfera, não fonte: não copie personagens, falas, bordões, identidade visual ou música.

## Clareza da comédia (nota do editor sobre o piloto, 11/10/2026)

Avaliação do Protocolo 001: "está muito subentendida a piada, tem que ser mais visível, mais clara a comédia".
O vendedor continua sério (regra 2); quem deixa a piada inequívoca é a **encenação**. O espectador não pode precisar
inferir onde está a graça.

- **Absurdo nos primeiros 3 s.** A abertura já põe lado a lado a grandiosidade e o problema trivial (ex.: cartela
  "Problema: abrir um ovo. Solução: 38 letras.").
- **Contraste na tela, não só no som.** A solução óbvia (colher, tesoura, a própria mão) aparece e vence de forma
  visível, de preferência no mesmo quadro ou em corte seco logo depois do produto.
- **Toda interrupção tem consequência visível:** silêncio + zoom de reação, carimbo, cartela burocrática, contador
  que zera. Nada de deixar o golpe só sugerido.
- **Escalada nítida:** pelo menos três degraus de exagero, cada um claramente maior que o anterior.
- **Cada bloco fecha com um "botão":** a última fala ou cartela conclui a piada de forma audível ou legível; não deixe
  a conclusão para o espectador.
- **O Departamento pode comentar, com seriedade burocrática:** fichas e carimbos ("Necessidade comprovada: não",
  "Alternativa disponível na gaveta") são a voz institucional, seca; não é o vendedor piscando para a câmera.
- **A colega pode nomear o óbvio** numa fala curta e prática, sem humilhar ninguém.
- **Teste de clareza antes de gravar a voz:** só com imagem e legenda (sem som), a piada aparece? Só com som (sem
  imagem), também? Se a resposta for "dá para entender se prestar atenção", ainda está subentendido demais.

## Ironia descarada (nota do editor sobre o Protocolo 003, 11/10/2026)

Avaliação do Protocolo 003 (iPhone Duo), depois de publicado: "Precisamos melhorar nosso texto e nosso humor. Fale
mais, seja mais explícito na argumentação nos próximos. Seja irônico descaradamente."

Diagnóstico do que faltou no 003: o vendedor falava em fragmentos ("Um iPhone. Que dobra." "Mas dobra." "Sobras
premium.") e deixava o espectador completar o raciocínio; as citações-chave estavam em inglês na tela; a colega
falou duas vezes; quase um terço do vídeo era pausa ou beat sem fala. A piada existia, mas o texto era tímido.

Regras a partir do Protocolo 004:

- **Fale mais.** Fala em pelo menos 80% da duração. Frases completas, ditas com convicção, em vez de fragmentos.
  Cada beat de fala tem uma ideia inteira (fato + conclusão), não meia ideia.
- **Argumente por extenso, em cadeia.** O vendedor raciocina em voz alta: *fato documentado → "ou seja" → conclusão
  absurda dita com todas as letras*. Ex.: "Custa trezentos e setenta e três dias de salário mínimo. Ou seja: você
  trabalha um ano inteiro para segurar a tela dobrada. Isso é que é compromisso." A conclusão nunca fica implícita.
- **Antífrase sem vergonha.** Ele elogia exatamente o defeito, com entusiasmo de vendedor: atraso vira
  "maturidade", preço vira "exclusividade", cópia vira "curadoria". Diga o elogio e o motivo, para não haver dúvida
  de que é ironia.
- **Faça as contas em voz alta.** Todo número relevante vira comparação concreta e absurda (preço por ano de atraso,
  por letra, por minuto, em salários mínimos, em cafezinhos), calculada a partir de fatos com fonte e mostrada na
  ficha.
- **Três argumentos por bloco, em escalada.** "Primeiro… Segundo… E o melhor…": o terceiro é o mais absurdo.
- **Bordão e retorno.** Uma expressão do vendedor que volta duas ou três vezes, cada vez mais desmentida pelos fatos
  (ex.: "inédito", "praticamente de graça"). O último retorno é o botão final.
- **A colega é sarcástica às claras**, 3–5 falas curtas, sempre mirando o produto ou o discurso, nunca uma pessoa:
  "Inédito desde 2019, né, Valdemar?" Ela pode fazer a pergunta que o espectador faria.
- **O locutor pode entrar** como voz oficial do Departamento, seca e irônica, em abertura, virada ou encerramento
  (ex.: "O Departamento informa: a necessidade foi atendida em 2019.").
- **Cartelas e carimbos em português e explícitos.** Citação em outro idioma aparece pequena; a tradução vem em
  destaque e é dita em voz alta. Carimbos podem ser opinião institucional ("COPIADO COM ORGULHO", "INOVAÇÃO
  REQUENTADA"), desde que o fato por trás tenha fonte.
- **Nada fica para o espectador inferir.** Teste: se alguém ler só as legendas, sem imagem, a ironia tem que estar
  escrita. Se precisar de "pegar a referência", reescreva.
- **Limites que continuam:** fatos com fonte; nenhum defeito, teste ou número inventado; o alvo é o produto, o preço
  e o discurso de quem vende, nunca quem compra nem quem depende do produto.

## Personagens e vozes

- `vendedor` — voz principal, tom de apresentação de resultados trimestrais; argumenta por extenso e defende o
  indefensável sem piscar.
- `colega` — voz fora de quadro, sarcástica às claras com o produto e o discurso (nunca com pessoas). Aparece 3–5 vezes.
- `locutor` — voz oficial do Departamento, seca e irônica, para abertura, virada ou encerramento.

## Recursos visuais disponíveis

`title` (cartela de abertura com carimbo opcional), `media` (foto; `layout` `full` ou `exhibit`), `factsheet`
(ficha técnica: linhas `Rótulo: valor` em `body`, fonte e data em `footnote`), `card` (cartela de texto),
`black` (tela preta curta), `endcard` (encerramento com o lema). `lowerThird: true` mostra a etiqueta do vendedor.
Efeitos sonoros discretos: `tap`, `tap-tap`, `click`, `crack`, `paper`, `chime`, `cough`, `shower` (chuveiro fora de quadro).
Cenas 3D próprias (`type: "scene3d"`, campo `scene`): `egg-topper` (piloto), `trouser-press` (deixas em `src/remotion/components/TrouserPress3D.tsx`) e `foldable` (celular dobrável genérico; deixas em `src/remotion/components/Foldable3D.tsx`); novas cenas entram no registro `src/remotion/components/scenes.ts`.

## Texto falado

- Frases completas e diretas, ditas em voz alta (curtas no fôlego, não no raciocínio). Evite siglas e números longos;
  escreva números por extenso quando ajudar a voz.
- Use `pronunciations` para nomes estrangeiros (grafia que a voz deve ler) e `caption` para a grafia correta na legenda.
- Preço: só o valor consultado, com a data na ficha técnica.

## Embalagem

`packaging.title` (≤ 100 caracteres, sem caixa-alta gritante nem promessa falsa), `synopsis` (1–2 frases),
`tags` (≤ 15), `thumbnailBeatId` (beat cujo quadro serve de miniatura).

## Versão

Incremente `version` a cada alteração e registre em `changelog`.
