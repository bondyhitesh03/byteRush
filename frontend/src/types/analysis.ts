export interface Complexity { notation: string; explanation: string }
export interface Analysis {
  summary: string;
  efficiency: { score: number; rating: 'Excellent' | 'Good' | 'Fair' | 'Needs work'; verdict: string };
  timeComplexity: Complexity; spaceComplexity: Complexity;
  memory: { estimate: string; explanation: string };
  issues: { severity: 'info' | 'warning' | 'bug'; message: string }[];
  suggestions: string[]; concepts: string[];
  codeQuality?: { score: number; verdict: string } | null;
}
