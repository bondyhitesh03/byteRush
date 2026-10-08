// Output comparison used for grading: ignores trailing spaces and blank lines at the end.
export const normOut = (s) => String(s ?? '').replace(/\r/g, '').split('\n').map((l) => l.trimEnd()).join('\n').trim();
