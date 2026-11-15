// Where ByteRush keeps its data (settings, history, notebook). Desktop launchers set BYTERUSH_DATA to a folder in your home
// directory so updates to the app never touch your data. Default (development / servers): backend/data.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA_DIR = process.env.BYTERUSH_DATA
  ? path.resolve(process.env.BYTERUSH_DATA)
  : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
