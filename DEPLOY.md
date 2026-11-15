# Put ByteRush online (free)

The goal: one link anyone can open, with Java running on the server, no installs for visitors.

## What you need
- A free GitHub account and a free Render account (no card needed for Render's free plan).
- 20 minutes.

## 1. Upload the project to GitHub
```
cd ~/algocoach
git init && git add . && git commit -m "ByteRush"
```
Create an empty repository on github.com, then run the two commands GitHub shows ("push an existing repository").
Check that no secrets are included (this should print nothing): `git ls-files | grep -E "\.env$|settings.json|history.json|notebook.json"`

## 2. Deploy on Render
1. render.com -> sign up with GitHub -> **New +** -> **Blueprint** -> choose your repo -> **Apply**.
   (Or **New +** -> **Web Service** -> your repo -> Language: **Docker** -> Instance type: **Free**.)
2. Wait for the build (about 5-10 minutes the first time). You get a link like `https://byterush.onrender.com`.
3. Open it. Java runs without anything installed. AI features ask each visitor for their own free Gemini key (Settings).

## What to expect on the free plan
- The site **sleeps after about 15 minutes without visitors** and takes around a minute to wake up.
- The free machine is small (512 MB RAM, a fraction of a CPU), so compiling and running Java can take several seconds.
  The settings in the Dockerfile are tuned for that (longer timeouts, one run at a time).
- The disk is temporary: **saved questions, notebook and attempts on the server are cleared when the site restarts**.
  Saved HTML & CSS pages, XP and your key live in each visitor's browser and are not affected.
  For permanent storage use step 3 (optional, also free).

## 3. Optional: permanent storage with Supabase (free)
1. supabase.com -> New project (any name, pick a password, wait ~2 minutes).
2. **SQL Editor** -> paste the contents of `supabase.sql` -> **Run**.
3. **Project Settings -> API**: copy the **Project URL** and the **service_role** key (the secret one, never share it).
4. Render -> your service -> **Environment** -> add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` -> save (it redeploys).
5. The startup log should say `storage: supabase`. Free Supabase projects pause after about a week without use; open the dashboard to wake it.

## Safety notes (read once)
- Visitors' Java code runs inside your container as the unprivileged user `nobody` with CPU, memory, file and process limits
  and no access to the server's files or environment. Where the host allows it, the network is blocked too (the startup log shows `networkBlocked`).
- It is a student-project level sandbox, not a bank vault. Do not put secrets other than the Supabase key on the server,
  and keep the rate limits on (they are on by default in public mode).
- Each visitor uses **their own** Gemini key, stored only in their browser. Your key is never used.

## Other free options
- **Share the code** and let people run it on their own computer (needs Node and Docker).
- **Temporary link** from your Mac with a Cloudflare tunnel (see README, "Sharing it publicly").
- An always-free cloud VM (for example Oracle Cloud, which asks for a card to verify identity) is faster than Render's free plan;
  use the same Dockerfile there.
