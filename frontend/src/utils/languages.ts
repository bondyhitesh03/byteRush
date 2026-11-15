// Languages that have a playground, questions and a notebook.
export type QLang = 'java' | 'python' | 'c' | 'cpp' | 'js';
export interface LangSpec { id: QLang; name: string; icon: string; monaco: string; file: string; mime: string; starter: string }

export const LANGS: Record<QLang, LangSpec> = {
  java: { id: 'java', name: 'Java', icon: '☕', monaco: 'java', file: 'Main.java', mime: 'text/x-java-source',
    starter: 'public class Main {\n    public static void main(String[] args) {\n        // Write your code here\n\n    }\n}\n' },
  python: { id: 'python', name: 'Python', icon: '🐍', monaco: 'python', file: 'main.py', mime: 'text/x-python', starter: '# Write your code here\n\n' },
  c: { id: 'c', name: 'C', icon: '🔵', monaco: 'c', file: 'main.c', mime: 'text/x-c',
    starter: '#include <stdio.h>\n\nint main() {\n    // Write your code here\n\n    return 0;\n}\n' },
  cpp: { id: 'cpp', name: 'C++', icon: '🟣', monaco: 'cpp', file: 'main.cpp', mime: 'text/x-c++src',
    starter: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n\n    return 0;\n}\n' },
  js: { id: 'js', name: 'JavaScript', icon: '🟨', monaco: 'javascript', file: 'script.js', mime: 'text/javascript',
    starter: '// Write your code here\n// Tip: console.log() shows output in the console. Use input() to read a line from the Input tab.\n\n' },
};
export const starterFor = (lang: QLang): string => LANGS[lang].starter;
