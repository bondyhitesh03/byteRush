import type { Analysis } from './analysis';
import type { LeetCode, Related } from './question';

export interface Folder { id: string; name: string; builtin?: boolean }
export interface Note {
  id: string; number: number; folderId: string; starred: boolean; title: string; question: string; code: string; stdin: string; createdAt: string; updatedAt: string;
  analysis?: Analysis; analyzedCode?: string; related?: Related[]; leetcode?: LeetCode[];
}
export interface NoteSummary { id: string; number: number; title: string; updatedAt: string; folderId: string; starred: boolean; hasAnalysis: boolean; hasSimilar: boolean }
