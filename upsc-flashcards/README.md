# UPSC Active Recall Flashcards

Web app for UPSC prelims active recall:

- Loads questions directly from the provided Google Sheet.
- Lets user choose a subject and solve one flashcard at a time.
- Records each response as **Oh Yes** / **Oh No**.
- Keeps **Oh No** backlog in browser local storage for future revision.
- Lets user re-practice only backlog questions.
- Exports current session responses to CSV.

## Question source

The app is preconfigured to load from:

`https://docs.google.com/spreadsheets/d/12PVJKdL7yL--R5xmIH3D0y88V9Vj2yNyBZrWuj2oiv8/edit?usp=sharing`

## Run locally

```bash
python3 -m http.server 8000
```

Then open:

- `http://localhost:8000/upsc-flashcards/`

## Fallback

If Google Sheet loading fails (network/CORS restrictions), use manual Excel upload in the fallback section.


## Preview in browser tools

If your preview opens repository root and shows **Not Found**, open either:

- `/` (now redirects automatically to `/upsc-flashcards/`)
- `/upsc-flashcards/` directly
