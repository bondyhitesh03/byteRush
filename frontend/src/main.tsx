import { createRoot } from 'react-dom/client';
import { loader } from '@monaco-editor/react';
import App from './App';
import './styles.css';
// Load the code editor from ByteRush itself (copied in by scripts/copy-monaco.mjs), not from a CDN, so it works offline.
loader.config({ paths: { vs: new URL('monaco/vs', document.baseURI).href.replace(/\/$/, '') } });
createRoot(document.getElementById('root')!).render(<App />);
