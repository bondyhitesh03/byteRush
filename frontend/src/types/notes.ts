// A note can be tied to one entry of the Questions page or one page of the Notebook.
export interface NoteLink { kind: 'question' | 'notebook'; id: string; title: string }
export interface MyNoteFields { title: string; body: string; code: string; stdin: string; tags: string[]; pinned: boolean; link: NoteLink | null }
export interface MyNote extends MyNoteFields { id: string; createdAt: string; updatedAt: string }
export interface MyNoteSummary { id: string; title: string; preview: string; updatedAt: string; tags: string[]; pinned: boolean; link: NoteLink | null }
