import { AsyncLocalStorage } from 'node:async_hooks';
// Holds the visitor's own key/model for the duration of one request (never stored, never logged).
export const aiContext = new AsyncLocalStorage();
