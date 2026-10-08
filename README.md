# ByteRush
(The project folder is still called `algocoach`; that is fine.)

## One-time setup
1. Node 20+, Docker Desktop running, then: `docker pull eclipse-temurin:21-jdk`
2. Start backend and frontend (below), open the **Settings** tab, and paste a free Gemini key
   (create one at https://aistudio.google.com/app/apikey). No .env editing needed.

## Run
```
cd backend  && npm install && npm run dev     # :3001 (localhost only)
cd frontend && npm install && npm run dev     # :5173
```

## Features
- **Language dropdown** (top right): **Java** or **HTML & CSS**. The HTML & CSS playground has an HTML editor and a CSS editor (each can be
  minimized with its arrow) next to a live preview, and downloads `index.html` + `style.css` (Chrome/Edge let you pick the Desktop). **💾 Save page** keeps named pages in your browser
  (📁 My pages: open, rename, delete) and **⛶ Full page** shows the preview full screen with desktop / tablet / mobile widths.
- **Playground**: real Java compile + run in a Docker sandbox, with an Input tab (stdin). **Analyze** rates efficiency, complexity and
  estimated memory. **Visualize** replays your code line by line (AI-simulated trace) and highlights the running line in the editor.
  **Explain this error** is an Error Coach: explanation, then hint, stronger hint, and only then the fix.
- **Questions**: **Get solution** and **Find similar questions** (3 questions + LeetCode picks) are separate AI requests. History keeps everything.
- **Practice**: Run with your own input, or **Submit** to grade against verified hidden tests. Score = 70 correctness
  + 15 efficiency + 15 code quality (the last two on request, 1 AI request, scaled by tests passed).
- **Notebook**: paste your own question and code on a notebook-style page, save it as Q1, Q2, ... (numbers never get reused),
  then **Run** (with input), **Analyze**, **Dry run** (step-by-step trace) and **Similar** (3 questions + LeetCode picks). Stored per browser in public mode.
  The notebook has **folders** (a built-in General folder plus your own, e.g. Arrays; deleting a folder moves its questions to General)
  and a **⭐ Starred** section for important questions.
- **Progress**: dashboard, skill tree, achievements, and attempt history with side-by-side comparison + AI explanation.
- **Settings**: Gemini key add/remove/test, model name, Dark / Light / System theme.
- XP comes only from real actions and is capped per day. Stored in your browser. One missed day never breaks a streak.
- Test cases are checked against the reference solution when the solution is generated, and hidden tests never leave the server.
- Not yet: daily challenge, personalized recommendations, backup/export, Supabase.

## Sharing it publicly (public mode)
Public mode makes the app safe(r) for strangers: every visitor pastes their **own** free Gemini key (stored only in their browser,
never on the server), history is separate per browser, the server's Settings can't be changed, and requests are rate limited per IP.
The server never uses a key of its own in this mode.

Quick demo from your own computer (free, temporary link):
```
cd frontend && npm run build                 # builds the site; the backend then serves it
cd ../backend && npm run start:public        # PUBLIC_MODE=true, TRUST_PROXY=1, localhost:3001
brew install cloudflared                     # once
cloudflared tunnel --url http://localhost:3001
```
Share the https://....trycloudflare.com address it prints. It only works while your computer is on and those commands run.

On a real server (needs Docker): run the backend with `PUBLIC_MODE=true HOST=0.0.0.0` behind a reverse proxy with HTTPS
(set `TRUST_PROXY=1` only if a proxy is in front). Use a dedicated machine: visitors' Java runs there, inside Docker
(no network, 256 MB, 1 CPU, 5 s limit), but it is still code from strangers.
Limits: 300 requests/min per IP overall, 20/min for running code and AI features; history older than 30 days of inactivity is deleted.
