# Website media

Everything here is captured from the real ByteRush app.

- `*.webp`: screenshots (2400 px wide)
- `*.mp4`: screen recordings, each with a `-poster.jpg`
  - `playground`, `errors`, `notebook`, `notes`: recorded fully offline
  - `coach`, `photo`, `grading`: the AI features. The explanations, hints, photo reading, solution,
    hidden-test results and score are real Gemini answers, fetched through the online demo with a Gemini key.

## Optional recordings

Any extra spot marked with `data-optional-media="media/<file>.mp4"` in `index.html` fills in automatically once
the file is here and listed in `manifest.json`:

```json
{ "recordings": ["<file>.mp4"] }
```
