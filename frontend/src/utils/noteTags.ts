// Tags for notes. Same rules as the server (backend/services/notesStore.js), so what you see is what gets saved.
export const MAX_TAGS = 8;
export const MAX_TAG_LEN = 24;

// lower case, no "#", one line, at most MAX_TAG_LEN characters
export const cleanTag = (t: string): string => t.replace(/[\u0000-\u001f]/g, ' ').replace(/^[#\s]+/, '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, MAX_TAG_LEN).trim();

// Adds the tag(s) in `raw` (commas separate several). Returns the same list when nothing was added.
export function addTags(tags: string[], raw: string): string[] {
  const next = [...tags];
  for (const part of raw.split(',')) {
    const t = cleanTag(part);
    if (t && !next.includes(t) && next.length < MAX_TAGS) next.push(t);
  }
  return next.length === tags.length ? tags : next;
}

// Every tag used across notes, most used first.
export function tagCounts(lists: string[][]): { tag: string; count: number }[] {
  const m = new Map<string, number>();
  for (const l of lists) for (const t of l) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
