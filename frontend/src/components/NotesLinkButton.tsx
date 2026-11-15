import { useState } from 'react';
import type { MyNoteSummary, NoteLink } from '../types/notes';

interface Props {
  notes: MyNoteSummary[]; // the notes already linked to this entry
  link: NoteLink; // what a new note would be linked to
  seedBody: string; // the starting text of a new note
  onOpen: (link: NoteLink, seedBody: string) => Promise<string | null>; // opens the newest linked note, or creates one; returns an error message on failure
}

// "📝 Take notes" on a question or notebook page: opens the note linked to it (or starts one), in the Notes page.
export default function NotesLinkButton({ notes, link, seedBody, onOpen }: Props) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const go = async () => {
    if (busy) return;
    setBusy(true); setProblem('');
    const m = await onOpen(link, seedBody);
    setBusy(false);
    if (m) setProblem(m);
  };
  return (<>
    <button onClick={() => void go()} disabled={busy} title={notes.length ? `Open ${notes.length === 1 ? 'the note' : 'your newest note'} linked to this` : 'Start a note linked to this'}>
      {busy ? 'Opening…' : notes.length ? `📝 Open notes (${notes.length})` : '📝 Take notes'}
    </button>
    {problem && <span className="bad small">{problem}</span>}
  </>);
}
