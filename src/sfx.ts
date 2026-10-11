// Efeitos sonoros sintetizados pelo proprio projeto com FFmpeg (sem dependencia de bancos de audio
// e sem pendencia de licenca). Sons discretos, de ambiente de escritorio: a comedia nao depende de efeito.
import fs from 'node:fs';
import path from 'node:path';
import {run} from './core/exec.js';

type Recipe = {seconds: number; filter: string};

const R = 48000;

export const SFX: Record<string, Recipe> = {
  // Batida seca em superficie dura (colher na casca, dedo na mesa)
  tap: {seconds: 0.25, filter: `anoisesrc=d=0.25:c=white:r=${R}:a=0.9,bandpass=f=1800:w=900,afade=t=out:st=0.002:d=0.06:curve=exp,volume=2.2`},
  // Duas batidas curtas
  'tap-tap': {
    seconds: 0.6,
    filter: `anoisesrc=d=0.6:c=white:r=${R}:a=0.9,bandpass=f=1700:w=900,volume='if(lt(t,0.07),1,if(between(t,0.28,0.35),1,0))':eval=frame,afade=t=out:st=0.4:d=0.2,volume=2`,
  },
  // Clique mecanico (mola, trava)
  click: {seconds: 0.12, filter: `anoisesrc=d=0.12:c=white:r=${R}:a=1,highpass=f=2500,afade=t=out:st=0.001:d=0.025:curve=exp,volume=1.6`},
  // Estalo de casca: rajada granulada curta
  crack: {seconds: 0.35, filter: `anoisesrc=d=0.35:c=brown:r=${R}:a=1,highpass=f=900,tremolo=f=55:d=0.9,afade=t=out:st=0.01:d=0.2:curve=exp,volume=2.5`},
  // Papel/folha manuseada
  paper: {seconds: 0.7, filter: `anoisesrc=d=0.7:c=pink:r=${R}:a=0.5,highpass=f=1200,tremolo=f=9:d=0.7,afade=t=in:d=0.08,afade=t=out:st=0.4:d=0.3`},
  // Vinheta corporativa discreta (duas notas)
  chime: {
    seconds: 1.6,
    filter: `sine=f=659.25:d=1.6:r=${R},volume='0.35*exp(-3*t)':eval=frame[a];sine=f=987.77:d=1.6:r=${R},volume='0.3*exp(-3*(t-0.18))*gte(t,0.18)':eval=frame[b];[a][b]amix=inputs=2:normalize=0`,
  },
  // Chuveiro ao fundo (fora de quadro): ruido de agua abafado, com entrada e saida suaves
  shower: {
    seconds: 3.2,
    filter: `anoisesrc=d=3.2:c=pink:r=${R}:a=0.6,highpass=f=350,lowpass=f=5200,tremolo=f=13:d=0.25,afade=t=in:d=0.35,afade=t=out:st=2.5:d=0.7,volume=0.9`,
  },
  // Tosse contida fora de quadro (constrangimento) — ruido com envelope duplo
  cough: {
    seconds: 0.7,
    filter: `anoisesrc=d=0.7:c=pink:r=${R}:a=0.8,bandpass=f=600:w=500,volume='if(lt(t,0.18),1,if(between(t,0.3,0.42),0.7,0))':eval=frame,afade=t=out:st=0.45:d=0.25,volume=1.4`,
  },
};

/** Ambiente de sala: ruido rosa abafado + zumbido de lampada muito baixo. */
export const ROOM_TONE: Recipe = {
  seconds: 120,
  filter: `anoisesrc=d=120:c=pink:r=${R}:a=0.05,lowpass=f=700,highpass=f=80[n];sine=f=120:d=120:r=${R},volume=0.004[h];[n][h]amix=inputs=2:normalize=0`,
};

export async function ensureSfx(id: string, dir: string): Promise<string> {
  const recipe = id === 'room-tone' ? ROOM_TONE : SFX[id];
  if (!recipe) throw new Error(`Efeito sonoro desconhecido: ${id}. Disponiveis: ${Object.keys(SFX).join(', ')}`);
  fs.mkdirSync(dir, {recursive: true});
  const out = path.join(dir, `${id}.wav`);
  if (!fs.existsSync(out)) {
    await run('ffmpeg', ['-y', '-v', 'error', '-filter_complex', `${recipe.filter},aformat=sample_rates=${R}:channel_layouts=mono`, '-t', String(recipe.seconds), out]);
  }
  return out;
}
