// Saves a text file. Chrome/Edge: a "Save as" dialog that starts on the Desktop. Other browsers: a normal download.
interface SavePickerWindow {
  showSaveFilePicker?: (o: { suggestedName: string; startIn?: string; types?: { description: string; accept: Record<string, string[]> }[] }) =>
    Promise<{ createWritable: () => Promise<{ write: (d: string) => Promise<void>; close: () => Promise<void> }> }>;
}

export function downloadViaLink(name: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveFile(name: string, content: string, mime: string): Promise<'saved' | 'cancelled' | 'downloaded'> {
  const w = window as unknown as SavePickerWindow;
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({ suggestedName: name, startIn: 'desktop', types: [{ description: name, accept: { [mime]: [`.${name.split('.').pop()}`] } }] });
      const writer = await handle.createWritable();
      await writer.write(content); await writer.close();
      return 'saved';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  downloadViaLink(name, content, mime);
  return 'downloaded';
}
