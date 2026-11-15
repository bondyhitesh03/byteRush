// The languages ByteRush can write solutions for and grade. Each one tells the AI how to write a runnable solution.
export const QUESTION_LANGS = {
  java: { name: 'Java',
    starter: 'public class Main whose main already creates a Scanner on System.in when input is needed, followed by a comment like // Write your solution here',
    rules: "a single file with 'public class Main', standard library only. It must read its input from standard input (System.in, e.g. with Scanner) in exactly the format used by examples[].input and print the result with System.out.println. If the question needs no input, read none. It must compile and be correct." },
  python: { name: 'Python',
    starter: 'a Python 3 script that reads input with input() when needed, followed by a comment like # Write your solution here',
    rules: 'a single Python 3 script, standard library only. It must read its input from standard input with input() (or sys.stdin) in exactly the format used by examples[].input and print the result with print(). If the question needs no input, read none. It must run without errors and be correct.' },
  c: { name: 'C',
    starter: 'a C program with #include <stdio.h> and an int main(void) that already reads input with scanf when needed, followed by a comment like // Write your solution here',
    rules: 'a single C file (C17), standard library only, with int main(void) that returns 0. It must read its input from standard input (scanf or fgets) in exactly the format used by examples[].input and print the result with printf. If the question needs no input, read none. It must compile with gcc and be correct.' },
  cpp: { name: 'C++',
    starter: 'a C++ program with #include <iostream>, using namespace std and an int main() that already reads input with cin when needed, followed by a comment like // Write your solution here',
    rules: 'a single C++17 file, standard library only, with int main() that returns 0. It must read its input from standard input (cin) in exactly the format used by examples[].input and print the result with cout. If the question needs no input, read none. It must compile with g++ and be correct.' },
  js: { name: 'JavaScript',
    starter: 'JavaScript that reads input with the provided input() function when needed, followed by a comment like // Write your solution here',
    rules: 'a single JavaScript file for Node.js with NO imports and NO require. Read input ONLY with the provided function input(), which returns the next line of standard input as a string, or null when there are no more lines (inputAll() returns all of it). Print results with console.log. Top-level await is allowed. If the question needs no input, read none. It must run without errors and be correct.' },
};
export const langOf = (v) => (typeof v === 'string' && Object.hasOwn(QUESTION_LANGS, v) ? v : 'java');
export const langName = (v) => QUESTION_LANGS[langOf(v)].name;
