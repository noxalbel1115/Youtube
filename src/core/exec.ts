import {spawn} from 'node:child_process';
import {redact} from './log.js';

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Executa um processo sem shell (argumentos nunca sao interpolados). */
export function run(cmd: string, args: string[], opts: {input?: string; cwd?: string; allowFail?: boolean; env?: NodeJS.ProcessEnv} = {}): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {cwd: opts.cwd, env: opts.env ?? process.env, stdio: ['pipe', 'pipe', 'pipe']});
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => {
      const res = {code: code ?? -1, stdout, stderr};
      if (code !== 0 && !opts.allowFail) {
        reject(new Error(`${cmd} saiu com codigo ${code}: ${redact(stderr.slice(-2000))}`));
      } else resolve(res);
    });
    if (opts.input !== undefined) child.stdin.write(opts.input);
    child.stdin.end();
  });
}

export async function ffprobeJson(file: string): Promise<any> {
  const r = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  return JSON.parse(r.stdout);
}
