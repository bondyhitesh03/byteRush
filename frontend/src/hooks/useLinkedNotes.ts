import { useEffect, useState } from 'react';
import { listLinkedNotes } from '../services/api';
import type { MyNoteSummary, NoteLink } from '../types/notes';

// The notes tied to one question / notebook page. Loads again when the id changes or when `active` turns on (a hidden page is not asked).
export function useLinkedNotes(kind: NoteLink['kind'], id: string | undefined, active = true): MyNoteSummary[] {
  const [found, setFound] = useState<{ key: string; items: MyNoteSummary[] }>({ key: '', items: [] });
  const key = id ? `${kind}:${id}` : '';
  useEffect(() => {
    if (!id || !active) return;
    let live = true;
    void listLinkedNotes(kind, id).then((items) => { if (live) setFound({ key: `${kind}:${id}`, items }); });
    return () => { live = false; };
  }, [kind, id, active]);
  return key && found.key === key ? found.items : [];
}
