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

test('WER: numerais por extenso equivalem a digitos', () => {
  assert.equal(wordErrorRate('Quarenta e nove reais e noventa centavos.', '49 reais e 90 centavos.'), 0);
  assert.equal(wordErrorRate('mil e duzentos', '1200'), 0);
});

test('legendas: blocos curtos e quebra apos pontuacao', () => {
  const c = chunkCaption('Você insere o papel, ajusta as guias e aguarda a inicialização. É liberdade.');
  assert.ok(c.every((x) => x.length <= 32), JSON.stringify(c));
  assert.equal(c.at(-1), 'É liberdade.');
  assert.deepEqual(chunkCaption('A casca se rompe em volta do topo. Sem faca.'), ['A casca se rompe', 'em volta do topo.', 'Sem faca.']);
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

test('licenca Commons: GFDL com migration=relicense vale como CC BY-SA 3.0', () => {
  const r = parseCommonsLicense('{{Information|author=Soljaguar}}\n{{GFDL|migration=relicense}}');
  assert.equal(r.license, 'by-sa');
  assert.equal(r.version, '3.0');
  assert.equal(parseCommonsLicense('{{GFDL}}').license, 'unknown');
});

test('trilha 3D: junta deixas iguais consecutivas e marca o impacto no "clack"', async () => {
  const {buildTrack} = await import('../src/remotion/track.js');
  const beat = (id: string, cue: string | undefined, start: number, dur: number, sfx: number[] = []) =>
    ({id, startFrame: start, durationFrames: dur, visual: {type: cue ? 'scene3d' : 'card', cue}, sfx: sfx.map((frame) => ({file: 'x', frame, volume: 1})), roomTone: true}) as any;
  const track = buildTrack([beat('a', 'hero', 0, 10), beat('b', 'hero', 10, 5), beat('c', undefined, 15, 5), beat('d', 'drop', 20, 10, [27])]);
  assert.deepEqual(track, [
    {cue: 'hero', start: 0, end: 15},
    {cue: 'drop', start: 20, end: 30, impact: 27},
  ]);
});

test('voz ElevenLabs sem assinatura paga confirmada nao tem base de uso para publicar', async () => {
  const {voiceLicenseIssue} = await import('../src/providers/tts/index.js');
  const {loadConfig} = await import('../src/core/config.js');
  const cfg = loadConfig();
  cfg.providers.tts.elevenlabs.commercialLicenseConfirmed = false;
  assert.match(voiceLicenseIssue(['elevenlabs'], cfg) ?? '', /assinatura paga/);
  assert.equal(voiceLicenseIssue(['kokoro'], cfg), null);
  cfg.providers.tts.elevenlabs.commercialLicenseConfirmed = true;
  assert.equal(voiceLicenseIssue(['elevenlabs', 'kokoro'], cfg), null);
});

test('rotulo do caso vem do numero do episodio', async () => {
  const {caseLabelFor} = await import('../src/stages/timeline.js');
  assert.equal(caseLabelFor('ep002-prensa-de-calcas'), 'PROTOCOLO 002');
  assert.equal(caseLabelFor('ep001-eierschalensollbruchstellenverursacher'), 'PROTOCOLO 001');
});

test('cenas 3D: o piloto continua registrado e cada cena tem trilha de estudio', async () => {
  const {SCENES, DEFAULT_SCENE} = await import('../src/remotion/components/scenes.js');
  assert.ok(SCENES[DEFAULT_SCENE]);
  for (const def of Object.values(SCENES)) assert.ok(def.previewTrack.length > 0);
});

test('WER: numerais so se juntam em ordem decrescente e dentro da mesma frase', () => {
  assert.equal(wordErrorRate('Cento e oitenta e nove libras e sessenta. Quatro e vinte por minuto.', '189 libras e 60, 4 e 20 por minuto.'), 0);
  assert.equal(wordErrorRate('Desde mil novecentos e trinta.', 'Desde 1930.'), 0);
  assert.equal(wordErrorRate('dois mil e quinhentos', '2500'), 0);
  assert.equal(wordErrorRate('Faltam quarenta e quatro minutos.', 'Faltam 44 minutos.'), 0);
});

test('WER: diferenca so na divisao entre palavras nao conta como erro', () => {
  assert.equal(wordErrorRate('A almofada aquecida foi inspirada no Concorde.', 'A almofa daquecida foi inspirada no Concorde.'), 0);
  assert.equal(wordErrorRate('guarda chuva', 'guarda-chuva'), 0);
  assert.equal(wordErrorRate('a almofada', 'a almofadas'), 0.5);
});

test('WER em ingles: numerais por extenso, "a hundred" e libras com simbolo', () => {
  assert.equal(wordErrorRate('Forty-five minutes. One pair of trousers at a time.', '45 minutes, one pair of trousers at a time.', 'en'), 0);
  assert.equal(wordErrorRate('One hundred and eighty-nine pounds sixty.', '£189.60.', 'en'), 0);
  assert.equal(wordErrorRate('For almost a hundred years.', 'For almost 100 years.', 'en'), 0);
  assert.equal(wordErrorRate('Four pounds twenty a minute.', '£4.20 a minute.', 'en'), 0);
  assert.equal(wordErrorRate('Forty-four minutes to go.', '44 minutes to go.', 'en'), 0);
  assert.equal(wordErrorRate('£189.60. £4.20 a minute.', '189 lbs. 60, 4 lbs. 20 a minute.', 'en'), 0);
  // padrao continua sendo portugues
  assert.equal(wordErrorRate('Quarenta e cinco minutos.', '45 minutos.'), 0);
});
