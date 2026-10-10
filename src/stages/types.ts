import type {Config} from '../core/config.js';
import type {EpisodeState, StageName} from '../schemas.js';
import type {epPaths} from '../core/paths.js';

export interface Flags {
  force: Set<string>;
  pick?: string;
  /** Justificativa registrada quando a escolha automatica e substituida (--pick). */
  pickReason?: string;
  confirmUpload?: boolean;
  privacy?: 'private' | 'unlisted' | 'public';
  publishAt?: string;
  offline?: boolean;
}

export interface Ctx {
  id: string;
  state: EpisodeState;
  cfg: Config;
  p: ReturnType<typeof epPaths>;
  flags: Flags;
  save: () => void;
}

export interface StageResult {
  outputs: string[];
  note?: string;
}

export interface Stage {
  name: StageName;
  /** Hash das entradas. Se igual ao da ultima execucao concluida, a etapa e pulada. */
  inputHash(ctx: Ctx): string;
  run(ctx: Ctx): Promise<StageResult>;
}

/** Etapa nao pode prosseguir sem acao externa (credencial, decisao, arquivo do agente). Nao e falha. */
export class BlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockedError';
  }
}
