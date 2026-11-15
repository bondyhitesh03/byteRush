import { createContext, useContext } from 'react';
import type { QLang } from './languages';

// The language the learner is using right now, so code blocks, printouts and starters match it.
export const LangContext = createContext<QLang>('java');
export const useLang = (): QLang => useContext(LangContext);
