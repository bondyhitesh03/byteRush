export interface TestResult { n: number; visible: boolean; passed: boolean; status: string; timeMs?: number; input?: string; expected?: string; actual?: string }
export interface GradeResult {
  attemptId: string; passed: number; total: number; correctness: number; results: TestResult[];
  compileError?: { errors: { line: number; message: string }[]; stderr: string };
}
export interface FinalScore { score: number; correctness: number; efficiency: number; quality: number; time: string; space: string; effVerdict: string; qualityVerdict: string }
export interface Attempt { id: string; code: string; passed: number; total: number; correctness: number; score: number | null; createdAt: string }
export interface QuestionStat { entryId: string; title: string; attempts: number; solved: boolean; bestScore: number | null; bestPassed: number; total: number }
export interface Stats { attempted: number; solved: number; attempts: number; accuracy: number; avgScore: number | null; bestScore: number | null; per: QuestionStat[]; activity: string[] }
export interface Coach { what: string; why: string; hint1: string; hint2: string; fix: { explanation: string; code: string } }
export interface TraceStep { line: number; note: string; vars: Record<string, string>; output: string }
export interface Trace { summary: string; truncated: boolean; steps: TraceStep[] }
export interface Compare { summary: string; improvements: string[] }
