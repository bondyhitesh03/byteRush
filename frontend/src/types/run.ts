export interface CompileError { line: number; message: string }
export interface RunResult {
  status: 'ok' | 'compile_error' | 'runtime_error' | 'timeout' | 'unavailable' | 'error';
  stdout?: string; stderr?: string; timeMs?: number; truncated?: boolean;
  errors?: CompileError[]; message?: string; phase?: 'compile' | 'run';
}
export type Language = 'java'; // add more here when new runners exist
