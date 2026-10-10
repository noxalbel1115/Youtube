import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wordErrorRate, chunkCaption, applyPronunciations} from '../src/core/text.js';
import {parseCommonsLicense} from '../src/providers/media/verify.js';
import {timeCaptions} from '../src/stages/timeline.js';
import {redact} from '../src/core/log.js';
import {newState, invalidateAfter} from '../src/core/state.js';

test('WER ignora pontuacao e acentos', () => {
  assert.equal(wordErrorRate('É liberdade.', 'e liberdade'), 0);
  assert.equal(wordErrorRate('ajusta as guias', 'ajusta as dias'), 1 / 3);
});

test('legendas: blocos curtos e quebra apos pontuacao', () => {
  const c = chunkCaption('Você insere o papel, ajusta as guias e aguarda a inicialização. É liberdade.');
  assert.ok(c.every((x) => x.length <= 30), JSON.stringify(c));
  assert.ok(c.at(-1)!.endsWith('liberdade.'));
});

test('pronuncia: substitui palavra inteira, sem tocar em partes de palavras', () => {
  assert.equal(applyPronunciations('O Hutzler 571 e o Hutzlerzinho', {Hutzler: 'Rútzler'}), 'O Rútzler 571 e o Hutzlerzinho');
});

test('licenca Commons: escolhe a mais permissiva oferecida', () => {
  assert.deepEqual(parseCommonsLicense('{{Information|author=X}}\n{{self|cc-by-sa-4.0|GFDL}}').license, 'by-sa');
  assert.equal(parseCommonsLicense('{{Cc-by-4.0}}').license, 'by');
  assert.equal(parseCommonsLicense('{{self|cc-zero}}').license, 'cc0');
  assert.equal(parseCommonsLicense('nada aqui').license, 'unknown');
});

test('tempos de legenda usam palavras do ASR quando a contagem bate', () => {
  const words = ['Você', 'insere', 'o', 'papel.'].map((w, i) => ({word: w, start: i * 0.5, end: i * 0.5 + 0.4}));
  const r = timeCaptions('Você insere o papel.', 2.0, words);
  assert.equal(r.length, 1);
  assert.equal(r[0].start, 0);
  assert.equal(r[0].end, 2.0);
});

test('redacao remove segredos dos logs', () => {
  process.env.YT_CLIENT_SECRET = 'segredo-super-secreto-123';
  assert.equal(redact('erro com segredo-super-secreto-123 e ya29.abcDEF'), 'erro com [REDACTED] e ya29.[REDACTED]');
});

test('mudar uma etapa invalida as seguintes, mas nunca o upload', () => {
  const s = newState('ep001-x');
  for (const k of Object.keys(s.stages)) s.stages[k].status = 'done';
  invalidateAfter(s, 'script');
  assert.equal(s.stages.voice.status, 'pending');
  assert.equal(s.stages.render.status, 'pending');
  assert.equal(s.stages.media.status, 'done');
  assert.equal(s.stages.upload.status, 'done');
});
