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
   para quadros estáticos (`motion: "static"`) e o "zoom de reação" (`snap-in`) com parcimônia (no máximo 2 vezes).
   Não acelere tudo.
6. **Mídia.** Só use `mediaId` com `status: "usable"` em `media.json`. Não descreva na fala algo que a imagem não mostra.
7. **Referências.** The Office é atmosfera, não fonte: não copie personagens, falas, bordões, identidade visual ou música.

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
