// Hand-written validators: nothing from the AI reaches the UI unless it passes these.
const str = (v, name, max = 4000) => {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`${name} must be a non-empty string`);
  return v.slice(0, max);
};
const arr = (v, name, min = 0) => {
  if (!Array.isArray(v) || v.length < min) throw new Error(`${name} must be an array with at least ${min} items`);
  return v;
};
const diff = (v) => (['Easy', 'Medium', 'Hard'].includes(v) ? v : 'Easy');
const strList = (v, name, min, maxItems, maxLen) => arr(v, name, min).slice(0, maxItems).map((x) => str(x, name, maxLen));

export function validateSolution(o) {
  if (!o || typeof o !== 'object') throw new Error('not an object');
  return {
    title: str(o.title, 'title', 120),
    difficulty: diff(o.difficulty),
    approach: str(o.approach, 'approach'),
    concepts: strList(o.concepts, 'concepts', 1, 8, 60),
    hints: strList(o.hints, 'hints', 1, 4, 500),
    examples: arr(o.examples, 'examples', 1).slice(0, 4).map((e) => ({
      input: String(e?.input ?? '').slice(0, 500) || '(none)',
      output: str(e?.output, 'example output', 500),
    })),
    starterCode: str(o.starterCode, 'starterCode', 3000),
    sampleInput: typeof o.sampleInput === 'string' ? o.sampleInput.slice(0, 1000) : '',
    tests: (Array.isArray(o.tests) ? o.tests : []).slice(0, 8)
      .map((t) => ({ input: String(t?.input ?? '').slice(0, 2000), output: String(t?.output ?? '').slice(0, 2000) })).filter((t) => t.output.trim()),
    solution: { code: str(o.solution?.code, 'solution.code', 8000), explanation: str(o.solution?.explanation, 'solution.explanation') },
    timeComplexity: str(o.timeComplexity, 'timeComplexity', 40),
    spaceComplexity: str(o.spaceComplexity, 'spaceComplexity', 40),
  };
}

export function validateImageQuestion(o) {
  if (!o || typeof o !== 'object') throw new Error('not an object');
  return { question: typeof o.question === 'string' ? o.question.slice(0, 5000) : '', note: typeof o.note === 'string' ? o.note.slice(0, 300) : '' };
}

export function validateRelated(o) {
  if (!o || typeof o !== 'object') throw new Error('not an object');
  const related = arr(o.related, 'related', 3).slice(0, 3).map((r) => ({
    title: str(r?.title, 'related.title', 120),
    difficulty: diff(r?.difficulty),
    statement: str(r?.statement, 'related.statement', 1500),
    concepts: strList(r?.concepts, 'related.concepts', 1, 5, 60),
  }));
  // LeetCode picks are optional: drop malformed ones instead of failing the whole answer.
  const leetcode = (Array.isArray(o.leetcode) ? o.leetcode : []).map((l) => {
    const number = Math.round(Number(l?.number));
    const slug = String(l?.slug ?? '').trim().toLowerCase();
    const title = String(l?.title ?? '').trim();
    if (!Number.isFinite(number) || number < 1 || number > 4000 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || !title) return null;
    return { number, title: title.slice(0, 120), slug, difficulty: diff(l?.difficulty), why: String(l?.why ?? '').slice(0, 200) };
  }).filter(Boolean).slice(0, 3);
  return { related, leetcode };
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(Number(n)) ? Number(n) : lo)));
const complexity = (c, name) => ({ notation: str(c?.notation, `${name}.notation`, 40), explanation: str(c?.explanation, `${name}.explanation`, 900) });

export function validateAnalysis(o) {
  if (!o || typeof o !== 'object') throw new Error('not an object');
  const rating = ['Excellent', 'Good', 'Fair', 'Needs work'].includes(o.efficiency?.rating) ? o.efficiency.rating : 'Good';
  return {
    summary: str(o.summary, 'summary', 800),
    efficiency: { score: clamp(o.efficiency?.score, 0, 100), rating, verdict: str(o.efficiency?.verdict, 'efficiency.verdict', 400) },
    timeComplexity: complexity(o.timeComplexity, 'timeComplexity'),
    spaceComplexity: complexity(o.spaceComplexity, 'spaceComplexity'),
    memory: { estimate: str(o.memory?.estimate, 'memory.estimate', 80), explanation: str(o.memory?.explanation, 'memory.explanation', 1200) },
    issues: (Array.isArray(o.issues) ? o.issues : []).slice(0, 6).map((i) => ({
      severity: ['info', 'warning', 'bug'].includes(i?.severity) ? i.severity : 'info', message: str(i?.message, 'issue', 500) })),
    suggestions: (Array.isArray(o.suggestions) ? o.suggestions : []).slice(0, 5).map((x) => str(x, 'suggestion', 500)),
    concepts: (Array.isArray(o.concepts) ? o.concepts : []).slice(0, 8).map((x) => str(x, 'concept', 60)),
    codeQuality: o.codeQuality && typeof o.codeQuality === 'object'
      ? { score: clamp(o.codeQuality.score, 0, 100), verdict: str(o.codeQuality.verdict, 'codeQuality.verdict', 400) } : null,
  };
}

export function validateCoach(o) {
  if (!o || typeof o !== 'object') throw new Error('not an object');
  return { what: str(o.what, 'what', 600), why: str(o.why, 'why', 900), hint1: str(o.hint1, 'hint1', 500), hint2: str(o.hint2, 'hint2', 700),
    fix: { explanation: str(o.fix?.explanation, 'fix.explanation', 900), code: str(o.fix?.code, 'fix.code', 4000) } };
}

export function validateTrace(o, lineCount) {
  if (!o || typeof o !== 'object') throw new Error('not an object');
  const steps = arr(o.steps, 'steps', 1).slice(0, 80).map((s) => {
    const line = Math.round(Number(s?.line));
    if (!Number.isFinite(line) || line < 1 || line > lineCount) return null;
    const vars = {};
    if (s.vars && typeof s.vars === 'object' && !Array.isArray(s.vars)) for (const [k, v] of Object.entries(s.vars).slice(0, 12)) vars[String(k).slice(0, 40)] = String(v).slice(0, 80);
    return { line, note: String(s?.note ?? '').slice(0, 200), vars, output: String(s?.output ?? '').slice(0, 200) };
  }).filter(Boolean);
  if (!steps.length) throw new Error('no valid steps');
  return { summary: String(o.summary ?? '').slice(0, 300), truncated: Boolean(o.truncated), steps };
}

export function validateCompare(o) {
  if (!o || typeof o !== 'object') throw new Error('not an object');
  return { summary: str(o.summary, 'summary', 900), improvements: (Array.isArray(o.improvements) ? o.improvements : []).slice(0, 5).map((x) => str(x, 'improvement', 400)) };
}
