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
2. **O vendedor nunca anuncia a piada.** Ele tenta fechar a venda. Nada de piscadela para a câmera, sarcasmo,
   "kkk", memes, efeitos exagerados ou comentário irônico do narrador.
3. **Progressão dramática.** Confiança alta → demonstração → interrupção da realidade → silêncio → tentativa de
   recuperação → confiança deteriorada → última tentativa de fechar a venda. Cada beat muda algo.
4. **Respeito ao uso legítimo.** Se o produto tem público legítimo (acessibilidade, uso profissional, segurança),
   a piada é o exagero do vendedor, nunca o público. Não ridicularize marca nem fabricante; não sugira endosso.
5. **Pausas são material.** Use `holdBefore`/`holdAfter` para silêncios (0,8–2,0 s nos momentos certos), cortes secos
   para quadros estáticos (`motion: "static"`) e o "zoom de reação" (`snap-in`) em cada golpe da realidade (até 4
   vezes por episódio). Não acelere tudo.
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

## Personagens e vozes

- `vendedor` — voz principal, tom de apresentação de resultados trimestrais.
- `colega` — voz fora de quadro, curta, prática, sem intenção de humilhar. Aparece 1–2 vezes.
- `locutor` — opcional, institucional (abertura/encerramento). Use pouco.

## Recursos visuais disponíveis

`title` (cartela de abertura com carimbo opcional), `media` (foto; `layout` `full` ou `exhibit`), `factsheet`
(ficha técnica: linhas `Rótulo: valor` em `body`, fonte e data em `footnote`), `card` (cartela de texto),
`black` (tela preta curta), `endcard` (encerramento com o lema). `lowerThird: true` mostra a etiqueta do vendedor.
Efeitos sonoros discretos: `tap`, `tap-tap`, `click`, `crack`, `paper`, `chime`, `cough`.

## Texto falado

- Frases curtas, ditas em voz alta. Evite siglas e números longos; escreva números por extenso quando ajudar a voz.
- Use `pronunciations` para nomes estrangeiros (grafia que a voz deve ler) e `caption` para a grafia correta na legenda.
- Preço: só o valor consultado, com a data na ficha técnica.

## Embalagem

`packaging.title` (≤ 100 caracteres, sem caixa-alta gritante nem promessa falsa), `synopsis` (1–2 frases),
`tags` (≤ 15), `thumbnailBeatId` (beat cujo quadro serve de miniatura).

## Versão

Incremente `version` a cada alteração e registre em `changelog`.
