import {STAGES, type StageName} from '../schemas.js';
import {loadState, saveState, nowIso, invalidateAfter, recordError, addCost} from '../core/state.js';
import {loadConfig} from '../core/config.js';
import fs from 'node:fs';
import path from 'node:path';
import {epPaths, ROOT} from '../core/paths.js';
import {log} from '../core/log.js';
import {BlockedError, type Ctx, type Flags, type Stage} from './types.js';
import {researchStage} from './research.js';
import {selectStage} from './select.js';
import {mediaStage} from './media.js';
import {scriptStage} from './script.js';
import {voiceStage} from './voice.js';
import {timelineStage} from './timeline.js';
import {renderStage} from './render.js';
import {verifyStage} from './verify.js';
import {packageStage} from './package.js';
import {uploadStage} from './upload.js';

export const STAGE_IMPLS: Record<StageName, Stage> = {
  research: researchStage,
  select: selectStage,
  media: mediaStage,
  script: scriptStage,
  voice: voiceStage,
  timeline: timelineStage,
  render: renderStage,
  verify: verifyStage,
  package: packageStage,
  upload: uploadStage,
};

export async function runPipeline(id: string, opts: {from?: StageName; to?: StageName; flags: Flags}): Promise<number> {
  const cfg = loadConfig();
  const state = loadState(id);
  const p = epPaths(id);
  const ctx: Ctx = {id, state, cfg, p, flags: opts.flags, save: () => saveState(state)};
  if (opts.flags.authorizePaidTts) {
    state.paidTtsAuthorization = {at: nowIso(), note: opts.flags.authorizePaidTts};
    saveState(state);
  }

  const fromIdx = opts.from ? STAGES.indexOf(opts.from) : 0;
  // Por padrao o pipeline para antes do upload: upload so roda quando pedido explicitamente.
  const toIdx = opts.to ? STAGES.indexOf(opts.to) : STAGES.indexOf('package');

  for (const name of STAGES.slice(fromIdx, toIdx + 1)) {
    const stage = STAGE_IMPLS[name];
    const st = state.stages[name];
    let hash: string;
    try {
      hash = stage.inputHash(ctx);
    } catch (e) {
      hash = `unavailable:${Date.now()}`;
    }
    const forced = opts.flags.force.has(name) || opts.flags.force.has('all');
    // Pula se as entradas sao as mesmas da ultima execucao bem-sucedida e as saidas ainda existem
    // (inclusive quando uma etapa anterior foi refeita mas produziu o mesmo resultado).
    const outputsExist = st.outputs.length > 0 && st.outputs.every((o) => fs.existsSync(path.join(ROOT, o)));
    const sameInputs = st.inputHash === hash && (st.status === 'done' || (st.status === 'pending' && outputsExist));
    if (sameInputs && !forced && name !== 'upload') {
      if (st.status !== 'done') {
        st.status = 'done';
        st.note = `${st.note ?? ''} (reaproveitada: entradas identicas)`.trim();
        ctx.save();
      }
      log.info(`[${name}] ja concluida com as mesmas entradas — pulando`);
      continue;
    }
    state.currentStage = name;
    st.status = 'running';
    st.attempts += 1;
    st.startedAt = nowIso();
    st.error = undefined;
    ctx.save();
    log.step(`[${name}] iniciando (tentativa ${st.attempts})`);
    const t0 = Date.now();
    try {
      const res = await stage.run(ctx);
      const changed = st.inputHash !== hash;
      st.status = 'done';
      st.finishedAt = nowIso();
      st.seconds = Math.round((Date.now() - t0) / 100) / 10;
      st.inputHash = hash;
      st.outputs = res.outputs;
      st.note = res.note;
      addCost(state, {stage: name, item: 'wall-clock', kind: 'observed', amount: st.seconds, unit: 'seconds', basis: 'tempo medido pelo runner (ultima execucao)'});
      const prevTotal = state.costs.find((c) => c.stage === name && c.item === 'wall-clock-acumulado')?.amount ?? 0;
      addCost(state, {stage: name, item: 'wall-clock-acumulado', kind: 'observed', amount: Math.round((prevTotal + st.seconds) * 10) / 10, unit: 'seconds', basis: 'soma de todas as execucoes concluidas desta etapa'});
      if (changed) invalidateAfter(state, name);
      ctx.save();
      log.info(`[${name}] concluida em ${st.seconds}s${res.note ? ' — ' + res.note : ''}`);
    } catch (e) {
      st.finishedAt = nowIso();
      st.seconds = Math.round((Date.now() - t0) / 100) / 10;
      if (e instanceof BlockedError) {
        st.status = 'blocked';
        st.note = e.message;
        ctx.save();
        log.warn(`[${name}] BLOQUEADA: ${e.message}`);
        return 2;
      }
      st.status = 'failed';
      st.error = recordError(state, name, e);
      ctx.save();
      log.error(`[${name}] FALHOU: ${st.error}`);
      return 1;
    }
  }
  return 0;
}
