import type { Progress } from './progress';
import { hasNestedLoops, stripNoise, userFunctions } from './codeSignals';

export interface Skill { id: string; name: string; icon: string; desc: string; tier: number; req: { id: string; min: number }[]; pattern: RegExp }
export const MASTERED = 5;
export const LEARNING = 1;
export const PRACTICING = 3;

// Skills unlock as their prerequisites get practice points. Points come from programs you run, problems you solve and code you analyze.
export const SKILLS: Skill[] = [
  { id: 'variables', name: 'Variables & Types', icon: '📦', tier: 0, req: [], desc: 'Store and combine values with variables, data types and operators.', pattern: /variable|data type|integer|arithmetic|operator|input|output|primitive/ },
  { id: 'conditionals', name: 'If / Else', icon: '🔀', tier: 1, req: [{ id: 'variables', min: 1 }], desc: 'Make decisions in code with if, else and switch.', pattern: /\b(if|else|switch|conditionals?|conditions?|branching)\b/ },
  { id: 'loops', name: 'Loops', icon: '🔁', tier: 1, req: [{ id: 'variables', min: 1 }], desc: 'Repeat work with for and while loops.', pattern: /\b(loops?|for|while)\b|iterat/ },
  { id: 'strings', name: 'Strings', icon: '🔤', tier: 1, req: [{ id: 'variables', min: 1 }], desc: 'Work with text: characters, searching, building and reversing.', pattern: /string|char/ },
  { id: 'arrays', name: 'Arrays & Lists', icon: '🧱', tier: 2, req: [{ id: 'loops', min: 1 }], desc: 'Hold many values together and process them with loops.', pattern: /array|list|matrix|sort|search|collection/ },
  { id: 'methods', name: 'Functions', icon: '🧩', tier: 2, req: [{ id: 'conditionals', min: 1 }], desc: 'Split code into reusable functions (methods) with parameters and return values.', pattern: /method|function|recursion|parameter|return/ },
  { id: 'nested', name: 'Nested Loops', icon: '🌀', tier: 2, req: [{ id: 'loops', min: 2 }], desc: 'Loops inside loops: patterns, tables and 2D data.', pattern: /nested|pattern|matrix|2d/ },
  { id: 'oop', name: 'OOP', icon: '🏗️', tier: 3, req: [{ id: 'methods', min: 2 }], desc: 'Model things with classes and objects.', pattern: /\bclass(es)?\b|\bobjects?\b|\boop\b|inheritance|polymorphism|encapsulation|\binterfaces?\b/ },
];

// Which skills a question or an AI analysis is about (from its list of concepts).
export const matchSkills = (concepts: string[]): string[] => {
  const text = concepts.join(' | ').toLowerCase();
  return SKILLS.filter((s) => s.pattern.test(text)).map((s) => s.id);
};

const VARIABLES = /\b(?:int|long|short|float|double|char|bool|boolean|byte|String|string|let|const|var|auto)\b[^;\n]*[=;,]|\b\w+\s*=[^=]|\bscanf\s*\(|\binput\s*\(|\bcin\s*>>/;
const CONDITIONALS = /\b(?:if|else|elif|switch|case)\b/;
const LOOPS = /\b(?:for|while|do)\b|\.(?:forEach|map|filter|reduce)\s*\(|\bfor_each\b/;
const STRINGS = /\bString\b|\bstd::string\b|\bstring\s+\w|\bchar\s*\*|\bf""|\bstr\s*\(|\.(?:length|charAt|substring|split|toUpperCase|toLowerCase|trim|indexOf|includes|startsWith|endsWith|replace|upper|lower|strip|startswith|endswith|isdigit|isalpha|toCharArray|equals|compareTo)\s*\(|\b(?:strlen|strcmp|strcpy|strcat|strstr|toupper|tolower|isalpha|isdigit)\s*\(/;
const ARRAYS = /\bnew\s+\w+\s*\[|\w\s*\[\s*\]|\bArrayList\b|\bList\s*<|\bvector\s*<|\bArrays\.|\.(?:push|append)\s*\(|\b(?:int|char|double|float|long)\s+\w+\s*\[|\blist\s*\(|\b\w+\s*\[\s*[\w+\-*]+\s*\]|(?:=|\(|,|return)\s*\[/;

// The skills a program practices, read from its source. Used so that running real code moves the skill tree, with no AI needed.
export function detectSkills(code: string, lang: string): string[] {
  const s = stripNoise(code, lang).replace(/\bmain\s*\([^)]*\)/g, 'main()'); // every Java/C main has String[] args / char* argv: not a skill
  const out: string[] = [];
  if (VARIABLES.test(s)) out.push('variables');
  if (CONDITIONALS.test(s)) out.push('conditionals');
  if (LOOPS.test(s)) out.push('loops');
  if (STRINGS.test(s)) out.push('strings');
  if (ARRAYS.test(s)) out.push('arrays');
  if (userFunctions(s, lang).length > 0) out.push('methods');
  if (LOOPS.test(s) && hasNestedLoops(s, lang)) out.push('nested');
  const classes = (s.match(lang === 'python' ? /^[ \t]*class\s+\w+/gm : lang === 'cpp' ? /\b(?:class|struct)\s+\w+/g : /\bclass\s+\w+/g) ?? []).length;
  if (lang !== 'c' && (classes >= (lang === 'java' ? 2 : 1) || /\b(?:extends|implements|interface)\b/.test(s))) out.push('oop');
  return out;
}

export type SkillLabel = 'Locked' | 'Ready' | 'Learning' | 'Practicing' | 'Mastered';
export function skillState(p: Pick<Progress, 'skills'>, s: Skill) {
  const points = p.skills[s.id] ?? 0;
  const unlocked = s.req.every((r) => (p.skills[r.id] ?? 0) >= r.min);
  const label: SkillLabel = points >= MASTERED ? 'Mastered' : points >= PRACTICING ? 'Practicing' : points >= LEARNING ? 'Learning' : unlocked ? 'Ready' : 'Locked';
  return { points, unlocked, label, pct: Math.min(100, (points / MASTERED) * 100) };
}
