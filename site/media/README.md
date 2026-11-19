# Website media

Everything here is captured from the real ByteRush app.

- `*.webp`: screenshots (2400 px wide)
- `playground.mp4`, `errors.mp4`, `notebook.mp4`, `notes.mp4`: screen recordings, with a `-poster.jpg` each

## Adding the AI recordings

Three spots on the page are waiting for recordings that need the AI (a Gemini key and internet):

| File | Shows |
|---|---|
| `coach.mp4` | The Error Coach: explanation, hint, stronger hint, fix |
| `photo.mp4` | Uploading a photo of a question and getting a verified solution |
| `grading.mp4` | Submitting a solution and the hidden tests and score coming in |

To add one: put the `.mp4` (and optionally a `coach-poster.jpg` etc.) in this folder, then list it in `manifest.json`:

```json
{ "recordings": ["coach.mp4", "photo.mp4", "grading.mp4"] }
```

Push, and the placeholder on the page is replaced by your recording automatically.
