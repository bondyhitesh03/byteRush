import { starterFor, type QLang } from '../utils/languages';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export interface Example { input: string; output: string }
export interface Solution { code: string; explanation: string }
export interface Related { title: string; difficulty: Difficulty; statement: string; concepts: string[] }
export interface LeetCode { number: number; title: string; slug: string; difficulty: Difficulty; why: string }
export interface SolutionData {
  title: string; difficulty: Difficulty; approach: string; concepts: string[]; hints: string[]; examples: Example[];
  starterCode: string; sampleInput?: string; testCount?: number; solution: Solution; timeComplexity: string; spaceComplexity: string;
}
// One history entry = one asked question, with an optional solution and optional similar questions.
export interface Entry { id: string; question: string; title: string; createdAt: string; updatedAt: string; attemptCount?: number; solution?: SolutionData; related?: Related[]; leetcode?: LeetCode[] }
export interface HistoryItem {
  id: string; title: string; question: string; createdAt: string; updatedAt: string;
  difficulty?: Difficulty; hasSolution: boolean; hasRelated: boolean;
}
// What the practice screen and print sheet need
export interface PracticeProblem {
  title: string; difficulty: Difficulty; statement: string; concepts: string[];
  examples?: Example[]; hints?: string[]; starterCode: string; sampleInput?: string; testCount?: number; solution?: Solution;
}
export const EMPTY_STARTER = starterFor('java');
export const DIFF_ICON: Record<Difficulty, string> = { Easy: '🟢', Medium: '🟡', Hard: '🔴' };
export const relatedToPractice = (r: Related, lang: QLang = 'java'): PracticeProblem => ({ ...r, starterCode: starterFor(lang) });
export function entryToPractice(e: Entry, lang: QLang = 'java'): PracticeProblem {
  const s = e.solution;
  if (!s) return { title: e.title, difficulty: 'Easy', statement: e.question, concepts: [], starterCode: starterFor(lang) };
  return { title: s.title, difficulty: s.difficulty, statement: e.question, concepts: s.concepts, examples: s.examples, hints: s.hints, starterCode: s.starterCode, sampleInput: s.sampleInput, testCount: s.testCount, solution: s.solution };
}
