# osiexplain.com

A website I created to assist me in teaching the OSI 7 Layer model to my students.

![Animated overview of OSI Explain: the 7-layer OSI stack, practice quiz, OSI vs TCP/IP comparison, glossary and Wireshark packet captures](assets/overview.gif)

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Overview of all seven layers, mnemonics, FAQ and a progress tracker |
| `layer1_physical.html` … `layer7_application.html` | One deep-dive page per layer: interactive demo, Wireshark examples, quiz, FAQ. Layer 3 also has a subnet calculator and practice mode (`subnet-tool.js`) |
| `quiz.html` | 20-question practice exam spanning all seven layers |
| `packet-journey.html` | Step-through of one HTTPS request down all seven layers, across routers and back up |
| `tcp-ip-vs-osi.html` | Side-by-side comparison with the four-layer TCP/IP model |
| `glossary.html` | ~145 networking terms, filterable, deep-linkable, with a flashcard mode |
| `404.html` | Not-found page (S3 error document) |

Shared assets: `styles.css`, `main.js`, `subnet-tool.js` (Layer 3 only), `favicon.svg`, `og-image.svg` / `og-image.png`,
`apple-touch-icon.png`, `robots.txt`, `sitemap.xml`.

`assets/` holds README-only media (e.g. the overview GIF above) and is excluded
from the S3 sync — it ships to GitHub but never to the live site.

## Conventions

- **No build step and no dependencies.** Plain HTML, one stylesheet, one shared
  script. Open any page straight from disk and it works.
- **`styles.css` is the single source of truth for shared styling.** Page-level
  `<style>` blocks should only hold rules unique to that page — duplicating a
  shared rule there silently overrides the responsive media query at the bottom
  of `styles.css`.
- **`main.js` is progressive enhancement only.** Theme switching, the quiz
  engine, progress tracking and copy buttons all degrade to readable static HTML
  if the script fails or JavaScript is off.
- **Theme before first paint.** Every page has a one-line inline script straight
  after `<body>` that applies the saved theme, so dark-mode users don't see a
  light flash. Copy it into any new page; `main.js` takes over after load.
- **Cache busting.** `styles.css`, `main.js` and `subnet-tool.js` are referenced
  with a `?v=YYYYMMDD` query string. Bump it on every page when any of them
  changes, otherwise S3 and browser caches serve the old version.
- **Quizzes** live in the HTML, not in JavaScript, so they are indexable and
  usable without scripting. Markup shape:
  `.quiz[data-quiz-id] > .quiz-list > .quiz-question[data-answer="N"]`, with
  options as `.quiz-options button[data-option="N"]`.
- **Progress** is stored in `localStorage` under `osi:progress` (and known
  flashcards under `osi:flashcards-known`) and never leaves the browser.
- **Copy buttons** appear on any element carrying a `data-copy` attribute; an
  empty value means "copy my own text content".

## Deployment

Pushing to `main` triggers `.github/workflows/main.yml`, which syncs the
repository to S3 (`--delete`, excluding `.git`, `.github`, `README.md`,
`LICENSE` and `assets/`). Set the bucket's error document to `404.html`.
